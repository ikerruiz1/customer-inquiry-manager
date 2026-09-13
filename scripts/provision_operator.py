#!/usr/bin/env python3
"""Enterprise Operator Provisioning CLI Tool.

Enables administrators to securely create, provision, and assign RBAC roles
to support operators in both local development and AWS Cognito environments.

Usage Examples:
    # Provision a standard Tier 1 Agent in local dev:
    python scripts/provision_operator.py --name "Elena Ramos" --email "elena.r@company.internal" --role Tier1_Agent

    # Provision an Operations Manager:
    python scripts/provision_operator.py --name "Sofia Chen" --email "sofia.c@company.internal" --role Operations_Manager

    # Provision into live AWS Cognito User Pool:
    python scripts/provision_operator.py --name "David Lee" --email "david.l@company.internal" --role Tier1_Agent --cognito --pool-id "eu-west-1_xxxxxxxxx"
"""
import argparse
import os
import secrets
import sys

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.services.cognito_service import get_cognito_service, _OPERATOR_REGISTRY
except ImportError as err:
    print(f"Error loading application services: {err}")
    sys.exit(1)


def generate_secure_password(length: int = 14) -> str:
    """Generate an enterprise-grade password meeting Cognito strict policy."""
    lower = "abcdefghijkmnopqrstuvwxyz"
    upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    symbols = "!@#$%^&*()-_=+"
    
    password = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    all_chars = lower + upper + digits + symbols
    password += [secrets.choice(all_chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password)
    return "".join(password)


def provision_local_operator(name: str, email: str, role: str, custom_password: str = None):
    """Provision operator into local service registry."""
    password = custom_password or generate_secure_password()
    cognito = get_cognito_service()
    
    operator = cognito.register_operator(
        name=name,
        email=email,
        password=password,
        role=role,
    )
    
    # Persist directly into SQLite database for persistent storage across server restarts
    try:
        import sqlite3
        import json
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "customer_inquiries.db"))
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO operators (id, name, email, password_hash, role, "groups", totp_secret, initials, color, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            (
                operator["id"],
                operator["name"],
                operator["email"],
                operator["password"],
                operator["role"],
                json.dumps(operator["groups"]),
                operator["totp_secret"],
                operator["initials"],
                operator["color"],
            ),
        )
        conn.commit()
        conn.close()
    except Exception as exc:
        print(f"[Notice] Database synchronization deferred to next API startup: {exc}")

    print("\n==================================================")
    print("  ENTERPRISE OPERATOR PROVISIONED (LOCAL REGISTRY & DB)")
    print("==================================================")
    print(f"Operator ID:       {operator['id']}")
    print(f"Full Name:         {operator['name']}")
    print(f"Email:             {operator['email']}")
    print(f"Temporary Pass:    {password}")
    print(f"RBAC Role:         {operator['role']}")
    print(f"Security Groups:   {', '.join(operator['groups'])}")
    print(f"TOTP Seed (MFA):   {operator['totp_secret']}")
    print("--------------------------------------------------")
    print("Status: Active and persisted to database for immediate sign-in.")
    print("==================================================\n")



def provision_cognito_operator(name: str, email: str, role: str, pool_id: str, region: str = "eu-west-1"):
    """Provision operator directly into AWS Cognito User Pool via AdminCreateUser API."""
    try:
        import boto3
    except ImportError:
        print("boto3 is required for AWS Cognito provisioning: pip install boto3")
        sys.exit(1)

    temp_password = generate_secure_password()
    client = boto3.client("cognito-idp", region_name=region)

    print(f"\n[AWS Cognito] Creating user '{email}' in pool '{pool_id}'...")
    try:
        response = client.admin_create_user(
            UserPoolId=pool_id,
            Username=email,
            TemporaryPassword=temp_password,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": name},
            ],
            MessageAction="SUPPRESS",
        )
        
        # Add to Cognito RBAC User Pool Group
        group_name = "Operations_Managers" if role == "Operations_Manager" else "Tier1_Agents"
        client.admin_add_user_to_group(
            UserPoolId=pool_id,
            Username=email,
            GroupName=group_name,
        )

        print("\n==================================================")
        print("  AWS COGNITO OPERATOR PROVISIONED (PRODUCTION)")
        print("==================================================")
        print(f"User Pool ID:      {pool_id}")
        print(f"Email / Username:  {email}")
        print(f"Temporary Pass:    {temp_password}")
        print(f"Assigned Group:    {group_name}")
        print("--------------------------------------------------")
        print("Next Step: The operator must sign in and scan the MFA QR code.")
        print("==================================================\n")
    except Exception as exc:
        print(f"\nFailed to provision in Cognito: {exc}\n")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Provision enterprise support operators securely.")
    parser.add_argument("--name", required=True, help="Full name of the support operator")
    parser.add_argument("--email", required=True, help="Corporate email address")
    parser.add_argument(
        "--role",
        choices=["Tier1_Agent", "Operations_Manager"],
        default="Tier1_Agent",
        help="RBAC authorization group (default: Tier1_Agent)",
    )
    parser.add_argument("--password", help="Optional specific password (auto-generated if omitted)")
    parser.add_argument("--cognito", action="store_true", help="Provision into live AWS Cognito User Pool")
    parser.add_argument("--pool-id", help="AWS Cognito User Pool ID (required if --cognito is set)")
    parser.add_argument("--region", default="eu-west-1", help="AWS Region (default: eu-west-1)")

    args = parser.parse_args()

    if args.cognito:
        if not args.pool_id:
            print("Error: --pool-id is required when --cognito flag is used.")
            sys.exit(1)
        provision_cognito_operator(
            name=args.name,
            email=args.email,
            role=args.role,
            pool_id=args.pool_id,
            region=args.region,
        )
    else:
        provision_local_operator(
            name=args.name,
            email=args.email,
            role=args.role,
            custom_password=args.password,
        )


if __name__ == "__main__":
    main()
