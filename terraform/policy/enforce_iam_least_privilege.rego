package main

deny[msg] {
	some name
	policy := input.resource.aws_iam_policy[name]
	contains(policy.policy, "\"*\"")
	contains(policy.policy, "\"Action\"")
	msg := sprintf("Resource 'aws_iam_policy.%v' contains wildcard Action '*'. Granular actions are required.", [name])
}

deny[msg] {
	some name
	attachment := input.resource.aws_iam_role_policy_attachment[name]
	endswith(attachment.policy_arn, "AdministratorAccess")
	msg := sprintf("Attachment '%v' references AdministratorAccess. Full administrative policies are prohibited.", [name])
}
