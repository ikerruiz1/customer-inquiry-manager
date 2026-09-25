"""
ECS Task Definition Processor for AWS CodeDeploy Blue/Green Pipelines.

Extracts container definitions and task properties from an existing task definition,
strips read-only AWS metadata attributes, updates container image references,
and emits a normalized taskdef.json compatible with AWS CodeDeploy and RegisterTaskDefinition.
"""
import json
import os
import sys


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print("Usage: python scripts/generate_taskdef.py [input_raw_json] [output_json]")
        return
    input_file = sys.argv[1] if len(sys.argv) > 1 else "taskdef_raw.json"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "taskdef.json"
    target_image = os.environ.get("TARGET_IMAGE")
    container_name = os.environ.get("CONTAINER_NAME", "customer-inquiry-manager")

    if not os.path.exists(input_file):
        minimal_taskdef = {
            "containerDefinitions": [
                {
                    "name": container_name,
                    "image": target_image or "customer-inquiry-manager:latest",
                }
            ]
        }
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(minimal_taskdef, f, indent=2)
        print(f"Generated fallback {output_file} from minimal template.")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        taskdef = json.load(f)

    # Strip AWS internal read-only attributes that cause RegisterTaskDefinition to fail
    read_only_keys = [
        "taskDefinitionArn",
        "revision",
        "status",
        "requiresAttributes",
        "compatibilities",
        "registeredAt",
        "registeredBy",
        "deregisteredAt",
    ]
    for key in read_only_keys:
        taskdef.pop(key, None)

    # Update the container image if specified
    if target_image:
        for container in taskdef.get("containerDefinitions", []):
            if container.get("name") == container_name:
                container["image"] = target_image

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(taskdef, f, indent=2)

    print(f"Successfully processed {input_file} into {output_file}.")


if __name__ == "__main__":
    main()
