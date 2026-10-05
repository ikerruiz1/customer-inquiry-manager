package main

# High Availability is a property Terraform silently accepts when absent: `multi_az = false`
# and an unconstrained subnet group both apply without error, so nothing in the plan output
# signals that the deployment is single-AZ. These rules make the absence a hard failure so the
# pipeline rejects it, instead of relying on reviewers to notice.
#
# Each check is expressed as a named predicate over an explicit resource. Keeping the predicate
# separate from the `deny` rule lets it be unit tested directly, which `with input` cannot do
# for a `data.main.deny` reference under the Rego v0 dialect this repository uses.

db_missing_multi_az(db) {
	db.multi_az != true
}

db_missing_subnet_group(db) {
	not db.db_subnet_group_name
}

subnet_group_single_az(sg) {
	count(sg.subnet_ids) < 2
}

alb_single_az(lb) {
	count(lb.subnets) < 2
}

health_check_too_slow(hc) {
	hc.failure_threshold > 3
}

deny[msg] {
	some name
	db := input.resource.aws_db_instance[name]
	db_missing_multi_az(db)
	msg := sprintf("Resource 'aws_db_instance.%v' must set multi_az=true. A single-AZ database turns one Availability Zone failure into a 45 to 60 second outage on P1/P2 workloads.", [name])
}

deny[msg] {
	some name
	db := input.resource.aws_db_instance[name]
	db_missing_subnet_group(db)
	msg := sprintf("Resource 'aws_db_instance.%v' must reference an explicit db_subnet_group_name. Without one, RDS falls back to the VPC default subnet group, which spans every tier including public subnets.", [name])
}

# A subnet group with a single subnet cannot host the standby of a Multi-AZ instance, so the
# multi_az flag alone would promise availability that the placement cannot deliver.
deny[msg] {
	some name
	sg := input.resource.aws_db_subnet_group[name]
	subnet_group_single_az(sg)
	msg := sprintf("Resource 'aws_db_subnet_group.%v' must reference at least 2 subnets in distinct Availability Zones.", [name])
}

# An Application Load Balancer answers requests from whichever nodes remain, so attaching it to
# a single subnet makes it single-AZ regardless of how many tasks the cluster runs.
deny[msg] {
	some name
	lb := input.resource.aws_lb[name]
	alb_single_az(lb)
	msg := sprintf("Resource 'aws_lb.%v' must be attached to at least 2 subnets in distinct Availability Zones.", [name])
}

deny[msg] {
	some name
	hc := input.resource.aws_route53_health_check[name]
	health_check_too_slow(hc)
	msg := sprintf("Resource 'aws_route53_health_check.%v' must use failure_threshold <= 3. A higher threshold delays DNS failover past the recovery point objective.", [name])
}