package main

# ==============================================================================
# Enterprise Policy: 3-Tier Database Subnet Isolation & Encryption
# ==============================================================================
# Security Mandates:
# 1. Amazon RDS PostgreSQL instances must NEVER be publicly accessible.
# 2. Amazon RDS PostgreSQL storage must be encrypted at rest (AES-256 / KMS).
# ==============================================================================

# Reject databases configured with public accessibility
deny[msg] {
    some name
    db := input.resource.aws_db_instance[name]
    db.publicly_accessible == true
    msg := sprintf("SECURITY VIOLATION: Resource 'aws_db_instance.%v' has publicly_accessible=true. Production databases must reside strictly in private subnets.", [name])
}

# Reject databases without storage encryption
deny[msg] {
    some name
    db := input.resource.aws_db_instance[name]
    db.storage_encrypted != true
    msg := sprintf("COMPLIANCE VIOLATION: Resource 'aws_db_instance.%v' must have storage_encrypted=true.", [name])
}
