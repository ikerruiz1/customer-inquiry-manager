# Remote state backend, declared as a partial configuration.
#
# No attribute values are set here on purpose. Every value is supplied at init time from the
# outputs of the bootstrap module (`terraform/bootstrap/`), so the environment configuration
# never hardcodes a bucket name that only the bootstrap knows how to create:
#
#   terraform init -reconfigure \
#     -backend-config="bucket=<bucket>" \
#     -backend-config="key=<key>" \
#     -backend-config="region=<region>"
#
# Locking relies on S3 native locking rather than a DynamoDB table. DynamoDB state locking is
# deprecated by both HashiCorp and AWS and is scheduled for removal, so introducing a table
# today would carry a known expiry date. `use_lockfile` requires Terraform 1.10 or later.
terraform {
  backend "s3" {
    use_lockfile = true
    encrypt      = true
  }
}