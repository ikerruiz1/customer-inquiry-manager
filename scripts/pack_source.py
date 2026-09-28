import zipfile
import os

exclude_dirs = {'.venv', 'node_modules', 'dist', '.git', '__pycache__', '.pytest_cache'}
exclude_files = {'source.zip'}

with zipfile.ZipFile('source.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            if f not in exclude_files and not f.endswith('.pyc'):
                full_path = os.path.join(root, f)
                arc_path = os.path.relpath(full_path, '.')
                z.write(full_path, arc_path)

print(f"source.zip successfully created: {os.path.getsize('source.zip')} bytes")
