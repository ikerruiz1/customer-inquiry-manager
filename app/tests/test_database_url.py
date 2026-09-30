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


# The password actually generated for the dev RDS master account. It contains
# "%cB", which is a valid percent-encoding, plus "<", ":", "=", ")" and "}".
REAL_RDS_PASSWORD = "Ix}Al1Q%cB:=<DqDcoZ)%Xs-"


def _connect_kwargs(database_url):
    """Return exactly what SQLAlchemy hands to asyncpg for this URL."""
    from sqlalchemy.dialects.postgresql.asyncpg import PGDialect_asyncpg
    from sqlalchemy.engine import make_url

    _, kwargs = PGDialect_asyncpg().create_connect_args(make_url(database_url))
    return kwargs


def test_url_encoded_password_survives_sqlalchemy_parsing(settings_class):
    """Regression: the credentials must reach asyncpg byte for byte.

    Raw interpolation produced "password authentication failed for user
    postgres" because SQLAlchemy unquotes "%cB" into a replacement character.
    """
    settings = _settings_with_secret(
        settings_class,
        {
            "username": "postgres",
            "password": REAL_RDS_PASSWORD,
            "host": "db.internal",
            "port": 5432,
            "database": "inquirydb",
        },
    )

    kwargs = _connect_kwargs(settings.DATABASE_URL)

    assert kwargs["password"] == REAL_RDS_PASSWORD
    assert kwargs["user"] == "postgres"
    assert kwargs["host"] == "db.internal"
    assert kwargs["port"] == 5432
    assert kwargs["database"] == "inquirydb"


def test_asyncpg_is_told_to_require_tls(settings_class):
    """ssl=require must survive parsing so asyncpg negotiates TLS against RDS."""
    settings = _settings_with_secret(
        settings_class,
        {
            "username": "postgres",
            "password": REAL_RDS_PASSWORD,
            "host": "db.internal",
            "port": 5432,
            "database": "inquirydb",
        },
    )

    assert _connect_kwargs(settings.DATABASE_URL)["ssl"] == "require"


def test_every_reserved_character_in_password_is_encoded(settings_class):
    """No reserved character may leak raw into the URL userinfo section."""
    password = "!#$%&*()-_=+[]{}<>:?/p"
    settings = _settings_with_secret(
        settings_class,
        {
            "username": "user",
            "password": password,
            "host": "db.internal",
            "port": 5432,
            "database": "inquirydb",
        },
    )

    userinfo = settings.DATABASE_URL.split("://", 1)[1].split("@", 1)[0]
    # Only the password segment matters: the ":" between user and password is a
    # structural separator, not leaked data.
    raw_password = userinfo.split(":", 1)[1]
    # "%" cannot be checked because it is the escape marker itself, and "-._~"
    # are RFC 3986 unreserved characters that quote() legitimately leaves alone.
    # These are the characters that actually break URL structure if left raw.
    structural = set(":@/?#<>{}[]|^`\"\\ ")

    assert structural.isdisjoint(raw_password), f"leaked structural characters: {raw_password}"
    assert _connect_kwargs(settings.DATABASE_URL)["password"] == password