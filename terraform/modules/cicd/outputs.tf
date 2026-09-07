output "pipeline_name" {
  description = "Name of the CodePipeline"
  value       = aws_codepipeline.pipeline.name
}

output "codebuild_project_name" {
  description = "Name of CodeBuild Project"
  value       = aws_codebuild_project.build.name
}

output "codedeploy_app_name" {
  description = "Name of CodeDeploy Application"
  value       = aws_codedeploy_app.ecs.name
}

output "codedeploy_deployment_group_name" {
  description = "Name of CodeDeploy Deployment Group"
  value       = aws_codedeploy_deployment_group.ecs.deployment_group_name
}
