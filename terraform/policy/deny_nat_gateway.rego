package main

deny[msg] {
	some name
	input.resource.aws_nat_gateway[name]
	msg := sprintf("Resource 'aws_nat_gateway.%v' is prohibited. PrivateLink endpoints must be used.", [name])
}
