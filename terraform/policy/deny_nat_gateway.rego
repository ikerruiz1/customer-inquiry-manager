package main

# ==============================================================================
# Enterprise Policy: Zero-Internet Egress Invariant
# ==============================================================================
# Architectural Mandate: AWS NAT Gateways are strictly prohibited.
# All egress to AWS services (Bedrock, S3, Cognito, ECR, CloudWatch, Secrets Manager)
# must traverse AWS PrivateLink Interface Endpoints and S3 Gateway Endpoint.
# ==============================================================================

deny[msg] {
    some name
    input.resource.aws_nat_gateway[name]
    msg := sprintf("ARCHITECTURE VIOLATION: Resource 'aws_nat_gateway.%v' is prohibited. Zero-Internet Egress via AWS PrivateLink Interface Endpoints is mandatory.", [name])
}
