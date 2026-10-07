"""
Source Code Packaging Utility for AWS CodePipeline S3 Artifact Ingestion.

Creates a clean, compressed source.zip containing the project repository
while excluding ephemeral files, virtual environments, node modules,
local build artifacts, and sensitive configuration files.
"""
import os
import sys
import zipfile

EXCLUDE_DIRS = {
    ".git",
    ".github",
    ".venv",
    "venv",
    "env",
    "node_modules",
    ".terraform",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "dist",
    "build",
    "reports",
    ".gemini",
    "scratch",
    ".scratch",
    "docs",
}

EXCLUDE_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "source.zip",
    "terraform.tfstate",
    "terraform.tfstate.backup",
    "terraform.tfvars",
    ".env",
    ".env.local",
    ".env.production",
    "AGENTS.md",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".tfstate",
    ".tfstate.backup",
    ".db",
    ".db-journal",
}


def package_source(output_zip: str = "source.zip", root_dir: str = ".") -> int:
    file_count = 0
    total_bytes = 0

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to avoid recursing into excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                if file in EXCLUDE_FILES:
                    continue
                if any(file.endswith(ext) for ext in EXCLUDE_EXTENSIONS):
                    continue
                if file.startswith(".env.") and not file.endswith(".example"):
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir)

                # Skip output zip itself
                if os.path.abspath(full_path) == os.path.abspath(output_zip):
                    continue

                zip_file.write(full_path, rel_path)
                file_count += 1
                total_bytes += os.path.getsize(full_path)

    size_mb = total_bytes / (1024 * 1024)
    print(f"Packaged {file_count} files ({size_mb:.2f} MB) into {output_zip}")
    return file_count


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print("Usage: python scripts/package_source.py [output_zip_path]")
        sys.exit(0)
    target = sys.argv[1] if len(sys.argv) > 1 else "source.zip"
    package_source(target)
