package main

# ==============================================================================
# Enterprise Policy: S3 Object Storage Data Protection & DLP
# ==============================================================================
# Security Mandates (SOC 2 Type II / ISO 27001 / PCI-DSS):
# 1. Every S3 Public Access Block MUST enable all 4 protective flags:
#    - block_public_acls = true
#    - block_public_policy = true
#    - ignore_public_acls = true
#    - restrict_public_buckets = true
# 2. S3 buckets MUST NEVER allow public read/write ACLs ("public-read", "public-read-write").
# ==============================================================================

# Reject S3 Public Access Blocks that fail to enable all 4 protection flags
deny[msg] {
    some name
    pab := input.resource.aws_s3_bucket_public_access_block[name]
    pab.block_public_acls != true
    msg := sprintf("DATA PROTECTION VIOLATION: Resource 'aws_s3_bucket_public_access_block.%v' must have block_public_acls=true.", [name])
}

deny[msg] {
    some name
    pab := input.resource.aws_s3_bucket_public_access_block[name]
    pab.block_public_policy != true
    msg := sprintf("DATA PROTECTION VIOLATION: Resource 'aws_s3_bucket_public_access_block.%v' must have block_public_policy=true.", [name])
}

deny[msg] {
    some name
    pab := input.resource.aws_s3_bucket_public_access_block[name]
    pab.ignore_public_acls != true
    msg := sprintf("DATA PROTECTION VIOLATION: Resource 'aws_s3_bucket_public_access_block.%v' must have ignore_public_acls=true.", [name])
}

deny[msg] {
    some name
    pab := input.resource.aws_s3_bucket_public_access_block[name]
    pab.restrict_public_buckets != true
    msg := sprintf("DATA PROTECTION VIOLATION: Resource 'aws_s3_bucket_public_access_block.%v' must have restrict_public_buckets=true.", [name])
}

# Reject legacy public S3 bucket ACLs
deny[msg] {
    some name
    bucket := input.resource.aws_s3_bucket[name]
    public_acls := ["public-read", "public-read-write", "authenticated-read"]
    public_acls[_] == bucket.acl
    msg := sprintf("SECURITY VIOLATION: Resource 'aws_s3_bucket.%v' declares public ACL '%v'. All buckets must remain private.", [name, bucket.acl])
}
