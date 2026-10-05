package main

# Unit tests for the high availability predicates. The predicates are deliberately separated from
# the `deny` rules so they can be exercised directly: `with input` does not propagate into a
# `data.main.deny` reference under the Rego v0 dialect this repository uses, so testing the
# predicates is the only way to prove the rules fire.
#
# Run with:  opa test --v0-compatible terraform/policy/
#
# The compliance cases matter as much as the violation cases: a rule that denies valid
# configuration breaks every future apply and gets disabled, which is worse than having no rule.

test_single_az_db_detected {
	db_missing_multi_az({"multi_az": false})
}

test_multiaz_db_accepted {
	not db_missing_multi_az({"multi_az": true})
}

test_db_without_subnet_group_detected {
	db_missing_subnet_group({"multi_az": true})
}

test_db_with_subnet_group_accepted {
	not db_missing_subnet_group({"multi_az": true, "db_subnet_group_name": "customer-inquiry-manager-dev-db-subnet-group"})
}

test_single_subnet_group_detected {
	subnet_group_single_az({"subnet_ids": ["subnet-a"]})
}

test_two_subnet_group_accepted {
	not subnet_group_single_az({"subnet_ids": ["subnet-a", "subnet-b"]})
}

test_single_subnet_alb_detected {
	alb_single_az({"subnets": ["subnet-a"]})
}

test_two_subnet_alb_accepted {
	not alb_single_az({"subnets": ["subnet-a", "subnet-b"]})
}

test_slow_health_check_detected {
	health_check_too_slow({"failure_threshold": 10})
}

test_fast_health_check_accepted {
	not health_check_too_slow({"failure_threshold": 3})
}