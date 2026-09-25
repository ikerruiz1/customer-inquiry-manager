package main

deny[msg] {
	some name
	sg := input.resource.aws_security_group[name]
	not startswith(name, "alb")
	some i
	ingress := sg.ingress[i]
	ingress.cidr_blocks[_] == "0.0.0.0/0"
	msg := sprintf("Security group '%v' allows ingress from 0.0.0.0/0. Only ALB may accept public ingress.", [name])
}
