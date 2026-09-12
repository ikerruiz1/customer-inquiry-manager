package main

# ==============================================================================
# Enterprise Policy: ECS Fargate Compute & Container Security
# ==============================================================================
# Security Mandates (CIS AWS Benchmark 5.2 / NIST SP 800-190 Container Security):
# 1. ECS task definitions must enforce 'awsvpc' network mode (dedicated ENI per task).
# 2. ECS task definitions must enforce Fargate serverless compatibility.
# 3. ECS containers must stream audit logs to CloudWatch (awslogs).
# ==============================================================================

# Reject ECS tasks that do not use dedicated 'awsvpc' network mode
deny[msg] {
    some name
    task := input.resource.aws_ecs_task_definition[name]
    task.network_mode != "awsvpc"
    msg := sprintf("CONTAINER SECURITY VIOLATION: Resource 'aws_ecs_task_definition.%v' must use network_mode='awsvpc' for micro-segmentation.", [name])
}

# Reject ECS tasks that do not declare Fargate compatibility
deny[msg] {
    some name
    task := input.resource.aws_ecs_task_definition[name]
    not contains(task.requires_compatibilities[_], "FARGATE")
    msg := sprintf("COMPUTE GOVERNANCE VIOLATION: Resource 'aws_ecs_task_definition.%v' must enforce 'FARGATE' compatibility.", [name])
}

# Reject ECS tasks without CloudWatch logs configuration
deny[msg] {
    some name
    task := input.resource.aws_ecs_task_definition[name]
    not contains(task.container_definitions, "awslogs")
    msg := sprintf("AUDIT TRAIL VIOLATION: Resource 'aws_ecs_task_definition.%v' containers must configure 'awslogs' logDriver.", [name])
}
