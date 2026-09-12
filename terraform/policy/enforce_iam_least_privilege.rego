package main

# ==============================================================================
# Enterprise Policy: IAM Least Privilege & Privilege Escalation Prevention
# ==============================================================================
# Security Mandates (CIS AWS Benchmark 1.16 / AWS Well-Architected Security):
# 1. IAM policies must NEVER grant full administrative wildcard actions ("*").
# 2. IAM policies must specify discrete service actions (e.g. "bedrock:InvokeModel").
# ==============================================================================

# Reject IAM policies that define wildcard Action "*"
deny[msg] {
    some name
    policy := input.resource.aws_iam_policy[name]
    # Check if policy contains wildcard action
    contains(policy.policy, "\"*\"")
    # Verify if it's in the Action block
    contains(policy.policy, "\"Action\"")
    msg := sprintf("IAM GOVERNANCE VIOLATION: Resource 'aws_iam_policy.%v' contains wildcard Action '*'. Granular, least-privilege actions are mandatory.", [name])
}

# Reject attaching the AWS managed AdministratorAccess policy
deny[msg] {
    some name
    attachment := input.resource.aws_iam_role_policy_attachment[name]
    endswith(attachment.policy_arn, "AdministratorAccess")
    msg := sprintf("PRIVILEGE ESCALATION VIOLATION: Attachment '%v' references AdministratorAccess. Full admin policies are strictly forbidden.", [name])
}
