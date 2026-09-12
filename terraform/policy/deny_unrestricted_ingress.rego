package main

# ==============================================================================
# Enterprise Policy: Perimeter Ingress Boundary Control
# ==============================================================================
# Security Mandate:
# Non-ALB security groups (RDS, ECS tasks, VPC endpoints) must NEVER allow
# unrestricted inbound traffic from 0.0.0.0/0.
# Only the public Application Load Balancer is permitted to receive public ingress.
# ==============================================================================

deny[msg] {
    some name
    sg := input.resource.aws_security_group[name]
    not startswith(name, "alb")
    some i
    ingress := sg.ingress[i]
    ingress.cidr_blocks[_] == "0.0.0.0/0"
    msg := sprintf("PERIMETER VIOLATION: Security group '%v' allows unrestricted ingress from 0.0.0.0/0. Only the public ALB may accept public ingress.", [name])
}
