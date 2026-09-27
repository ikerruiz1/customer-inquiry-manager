output "pipeline_name" {
  description = "Name of the CodePipeline"
  value       = aws_codepipeline.pipeline.name
}

output "codebuild_project_name" {
  description = "Name of CodeBuild Project"
  value       = aws_codebuild_project.build.name
}
