# ==============================================================================
# Amazon Cognito User Pool with Enforced Software Token TOTP MFA
# ==============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-user-pool"

  # Zero-Trust MFA Enforcement (RFC 6238 Software Tokens)
  mfa_configuration = "ON"

  software_token_mfa_configuration {
    enabled = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    mutable             = true
    required            = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-user-pool"
    Environment = var.environment
  }
}

# Application Client for API & Console Authentication
resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.project_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
}

# Role-Based Access Control (RBAC) User Pool Groups
resource "aws_cognito_user_group" "tier1_agents" {
  name         = "Tier1_Agents"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Support Agents authorized to claim and resolve customer inquiries"
  precedence   = 10
}

resource "aws_cognito_user_group" "operations_managers" {
  name         = "Operations_Managers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Supervisors authorized for HITL resolution and MLOps classification overrides"
  precedence   = 5
}
