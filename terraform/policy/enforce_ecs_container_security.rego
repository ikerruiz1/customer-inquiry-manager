package main

deny[msg] {
	some name
	task := input.resource.aws_ecs_task_definition[name]
	task.network_mode != "awsvpc"
	msg := sprintf("Resource 'aws_ecs_task_definition.%v' must configure network_mode='awsvpc'.", [name])
}

deny[msg] {
	some name
	task := input.resource.aws_ecs_task_definition[name]
	not contains(task.requires_compatibilities[_], "FARGATE")
	msg := sprintf("Resource 'aws_ecs_task_definition.%v' must specify 'FARGATE' compatibility.", [name])
}

deny[msg] {
	some name
	task := input.resource.aws_ecs_task_definition[name]
	not contains(task.container_definitions, "awslogs")
	msg := sprintf("Resource 'aws_ecs_task_definition.%v' must configure 'awslogs' log driver.", [name])
}
