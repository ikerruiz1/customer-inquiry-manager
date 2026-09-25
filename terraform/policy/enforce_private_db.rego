package main

deny[msg] {
	some name
	db := input.resource.aws_db_instance[name]
	db.publicly_accessible == true
	msg := sprintf("Resource 'aws_db_instance.%v' has publicly_accessible=true. Databases must be private.", [name])
}

deny[msg] {
	some name
	db := input.resource.aws_db_instance[name]
	db.storage_encrypted != true
	msg := sprintf("Resource 'aws_db_instance.%v' must configure storage_encrypted=true.", [name])
}
