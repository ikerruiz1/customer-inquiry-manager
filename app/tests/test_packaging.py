"""Regression tests for the CodePipeline source packaging exclusions.

`scripts/package_source.py` walks the filesystem rather than the Git index,
so a file that is correctly ignored by Git can still be packaged and
uploaded to the pipeline bucket. These tests pin the exclusion contract
that prevents local secrets and internal documentation from leaking into
the build artifact.
"""

import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGER = REPO_ROOT / "scripts" / "package_source.py"


@pytest.fixture(scope="module")
def packaged_entries(tmp_path_factory):
    """Package the real repository once and return the archive entry names."""
    output = tmp_path_factory.mktemp("packaging") / "source.zip"
    subprocess.run(
        [sys.executable, str(PACKAGER), str(output)],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    )
    with zipfile.ZipFile(output) as archive:
        return set(archive.namelist())


@pytest.mark.parametrize(
    "excluded",
    [
        ".env",
        ".env.local",
        ".env.production",
        "AGENTS.md",
        "customer_inquiries.db",
        "source.zip",
        "terraform/environments/dev/terraform.tfvars",
    ],
)
def test_local_secrets_are_not_packaged(packaged_entries, excluded):
    assert excluded not in packaged_entries


@pytest.mark.parametrize("prefix", ["docs/", "scratch/", ".venv/", ".git/"])
def test_excluded_directories_are_not_packaged(packaged_entries, prefix):
    assert not any(entry.startswith(prefix) for entry in packaged_entries)


@pytest.mark.parametrize(
    "retained",
    [
        ".env.example",
        "company_profile.example.json",
        "requirements.txt",
        "Dockerfile",
        "buildspec.yml",
        "app/main.py",
        "app/core/config.py",
        "terraform/modules/vpc/main.tf",
        "terraform/policy/deny_nat_gateway.rego",
        "frontend/package.json",
    ],
)
def test_build_inputs_are_retained(packaged_entries, retained):
    assert retained in packaged_entries


def test_no_terraform_state_is_packaged(packaged_entries):
    assert not any(entry.endswith((".tfstate", ".tfstate.backup")) for entry in packaged_entries)
