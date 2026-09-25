#!/usr/bin/env python3
import argparse
import os
import secrets
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.services.cognito_service import get_cognito_service, _OPERATOR_REGISTRY
except ImportError as err:
    print(f"Error loading application services: {err}")
    sys.exit(1)


def generate_secure_password(length: int = 14) -> str:
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
    password = custom_password or generate_secure_password()
    cognito = get_cognito_service()
    
    try:
        operator = cognito.register_operator(
            name=name,
            email=email,
            password=password,
            role=role,
        )
    except Exception:
        if email in _OPERATOR_REGISTRY:
            _OPERATOR_REGISTRY[email]["password"] = password
            operator = _OPERATOR_REGISTRY[email]
        else:
            raise
    
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

    print("\n--------------------------------------------------")
    print("  Local Operator Created")
    print("--------------------------------------------------")
    print(f"Operator ID:   {operator['id']}")
    print(f"Name:          {operator['name']}")
    print(f"Email:         {operator['email']}")
    print(f"Password:      {password}")
    print(f"Role:          {operator['role']}")
    print(f"TOTP Seed:     {operator['totp_secret']}")
    print("--------------------------------------------------\n")



def provision_cognito_operator(
    name: str,
    email: str,
    role: str,
    pool_id: str,
    region: str = "eu-west-1",
    secret_name: str = "customer-inquiry-manager/dev/operator-credentials",
):
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        print("boto3 is required for AWS Cognito provisioning: pip install boto3")
        sys.exit(1)

    import json
    from datetime import datetime, timezone

    temp_password = generate_secure_password()
    client = boto3.client("cognito-idp", region_name=region)
    sm_client = boto3.client("secretsmanager", region_name=region)

    print(f"\n[AWS Cognito] Provisioning operator '{email}' in pool '{pool_id}'...")
    try:
        try:
            client.admin_create_user(
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
            print("  [Cognito] User created successfully with temporary password.")
        except client.exceptions.UsernameExistsException:
            print("  [Cognito] Operator already exists. Rotating temporary password...")
            client.admin_set_user_password(
                UserPoolId=pool_id,
                Username=email,
                Password=temp_password,
                Permanent=False,
            )

        group_name = "Operations_Managers" if role == "Operations_Manager" else "Tier1_Agents"
        try:
            client.admin_add_user_to_group(
                UserPoolId=pool_id,
                Username=email,
                GroupName=group_name,
            )
        except Exception as grp_exc:
            print(f"  [Cognito Group Notice] {grp_exc}")

        secret_stored = False
        secret_payload = json.dumps({
            "username": email,
            "temporary_password": temp_password,
            "role": role,
            "group": group_name,
            "user_pool_id": pool_id,
            "provisioned_at": datetime.now(timezone.utc).isoformat(),
        })

        try:
            try:
                sm_client.put_secret_value(
                    SecretId=secret_name,
                    SecretString=secret_payload,
                )
                print(f"  [AWS Secrets Manager] Secret '{secret_name}' updated successfully.")
                secret_stored = True
            except ClientError as ce:
                if ce.response["Error"]["Code"] == "ResourceNotFoundException":
                    sm_client.create_secret(
                        Name=secret_name,
                        Description="Enterprise Operator Initial Provisioning Credentials",
                        SecretString=secret_payload,
                    )
                    print(f"  [AWS Secrets Manager] Secret '{secret_name}' created successfully.")
                    secret_stored = True
                else:
                    raise
        except Exception as sm_exc:
            print(f"  [Secrets Manager Notice] Deferred cloud secret synchronization: {sm_exc}")

        print("\n--------------------------------------------------")
        print("  Cognito Operator Created")
        print("--------------------------------------------------")
        print(f"User Pool ID:    {pool_id}")
        print(f"Username/Email:  {email}")
        print(f"Temporary Pass:  {temp_password}")
        print(f"Role:            {group_name}")
        if secret_stored:
            print(f"Secrets Manager: {secret_name}")
        print("--------------------------------------------------\n")
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
    parser.add_argument(
        "--secret-name",
        default="customer-inquiry-manager/dev/operator-credentials",
        help="AWS Secrets Manager secret identifier",
    )

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
            secret_name=args.secret_name,
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
