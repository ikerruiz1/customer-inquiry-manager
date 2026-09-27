data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "codebuild_role" {
  name = "${var.project_name}-${var.environment}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "codebuild.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "codebuild_policy" {
  name = "${var.project_name}-${var.environment}-codebuild-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
        ]
        Resource = ["${var.pipeline_artifacts_bucket_arn}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeTaskDefinition"
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:CreateReportGroup",
          "codebuild:CreateReport",
          "codebuild:UpdateReport",
          "codebuild:BatchPutTestCases",
          "codebuild:BatchPutCodeCoverages"
        ]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_attach" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = aws_iam_policy.codebuild_policy.arn
}



resource "aws_iam_role" "codepipeline_role" {
  name = "${var.project_name}-${var.environment}-codepipeline-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "codepipeline.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "codepipeline_policy" {
  name = "${var.project_name}-${var.environment}-codepipeline-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:GetBucketVersioning",
          "s3:PutObject",
        ]
        Resource = [
          var.pipeline_artifacts_bucket_arn,
          "${var.pipeline_artifacts_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild",
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:CreateDeployment",
          "codedeploy:GetDeployment",
          "codedeploy:GetDeploymentConfig",
          "codedeploy:RegisterApplicationRevision",
        ]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["ecs:*"]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codepipeline_attach" {
  role       = aws_iam_role.codepipeline_role.name
  policy_arn = aws_iam_policy.codepipeline_policy.arn
}

resource "aws_codebuild_project" "build" {
  name          = "${var.project_name}-${var.environment}-build"
  description   = "Executes Pytest, SAST/SCA security scans, multi-stage Docker build, and ECR push"
  build_timeout = 20
  service_role  = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = data.aws_region.current.name
    }
    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }
    environment_variable {
      name  = "IMAGE_REPO_NAME"
      value = "${var.project_name}-${var.environment}"
    }
    environment_variable {
      name  = "IMAGE_TAG"
      value = "latest"
    }
    environment_variable {
      name  = "ECR_REPOSITORY_URI"
      value = var.ecr_repository_url
    }
    environment_variable {
      name  = "TASK_DEFINITION_FAMILY"
      value = "${var.project_name}-${var.environment}-task"
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-build"
  }
}

resource "aws_codepipeline" "pipeline" {
  name     = "${var.project_name}-${var.environment}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = var.pipeline_artifacts_bucket_name
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "S3Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "S3"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        S3Bucket             = var.pipeline_artifacts_bucket_name
        S3ObjectKey          = "source.zip"
        PollForSourceChanges = "true"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "BuildAndScan"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployECS"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ClusterName = var.ecs_cluster_name
        ServiceName = var.ecs_service_name
        FileName    = "imagedefinitions.json"
      }
    }
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-pipeline"
  }
}
