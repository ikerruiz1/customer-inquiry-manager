"""Unit tests for the DATABASE_URL assembly performed in app.core.config."""
import json

import pytest


@pytest.fixture
def settings_class():
    from app.core import config

    return config.Settings


def _settings_with_secret(settings_class, creds):
    return settings_class(
        DB_CREDENTIALS=json.dumps(creds),
        GROUNDING_CONTEXT_PATH="company_profile.example.json",
    )


def test_aws_database_url_forces_ssl(settings_class):
    """RDS runs with rds.force_ssl=1, so the URL must negotiate TLS.

    Without ssl=require asyncpg connects in plaintext and every query dies with
    "no pg_hba.conf entry ... no encryption". That broke the inquiry API, the
    invite endpoint, the inbound email poller and the SLA watcher all at once.
    """
    settings = _settings_with_secret(
        settings_class,
        {
            "username": "postgres",
            "password": "p",
            "host": "customer-inquiry-manager-dev-db.cx4eumw0i3e2.eu-west-1.rds.amazonaws.com",
            "port": 5432,
            "database": "inquirydb",
        },
    )

    assert settings.DATABASE_URL.startswith("postgresql+asyncpg://postgres:p@")
    assert settings.DATABASE_URL.endswith("/inquirydb?ssl=require")


def test_aws_database_url_keeps_credentials_and_target(settings_class):
    """The ssl argument must be appended, never replace host, port or database."""
    settings = _settings_with_secret(
        settings_class,
        {
            "username": "app_user",
            "password": "secret",
            "host": "db.internal",
            "port": 6543,
            "database": "tickets",
        },
    )

    assert "app_user:secret@db.internal:6543/tickets" in settings.DATABASE_URL


def test_local_sqlite_url_is_untouched(settings_class):
    """Local development keeps the default SQLite URL with no ssl argument."""
    settings = settings_class(DB_CREDENTIALS=None)

    assert "ssl=" not in settings.DATABASE_URL