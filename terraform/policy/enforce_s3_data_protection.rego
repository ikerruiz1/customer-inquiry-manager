package main

deny[msg] {
	some name
	pab := input.resource.aws_s3_bucket_public_access_block[name]
	pab.block_public_acls != true
	msg := sprintf("Resource 'aws_s3_bucket_public_access_block.%v' must have block_public_acls=true.", [name])
}

deny[msg] {
	some name
	pab := input.resource.aws_s3_bucket_public_access_block[name]
	pab.block_public_policy != true
	msg := sprintf("Resource 'aws_s3_bucket_public_access_block.%v' must have block_public_policy=true.", [name])
}

deny[msg] {
	some name
	pab := input.resource.aws_s3_bucket_public_access_block[name]
	pab.ignore_public_acls != true
	msg := sprintf("Resource 'aws_s3_bucket_public_access_block.%v' must have ignore_public_acls=true.", [name])
}

deny[msg] {
	some name
	pab := input.resource.aws_s3_bucket_public_access_block[name]
	pab.restrict_public_buckets != true
	msg := sprintf("Resource 'aws_s3_bucket_public_access_block.%v' must have restrict_public_buckets=true.", [name])
}

deny[msg] {
	some name
	bucket := input.resource.aws_s3_bucket[name]
	public_acls := ["public-read", "public-read-write", "authenticated-read"]
	public_acls[_] == bucket.acl
	msg := sprintf("Resource 'aws_s3_bucket.%v' declares public ACL '%v'.", [name, bucket.acl])
}
