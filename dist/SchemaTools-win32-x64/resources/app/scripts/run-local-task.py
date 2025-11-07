#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local Task Runner
Dispatches and executes schema-related scripts locally

Usage:
    python run-local-task.py --task [clean|fetch|merge|schema]
"""

import os
import sys
import subprocess
from pathlib import Path

WORKFLOW = Path("inputs-files/workflow")

TASKS = {
    "clean": Path("scripts/clean-products-csv.py"),
    "fetch": Path("scripts/fetch-google-reviews.py"),
    "merge": Path("scripts/merge-reviews.py"),
    "schema": Path("scripts/generate-product-schema.py"),
}

def run_task(task):
    """Execute a task by running its corresponding Python script"""
    if task not in TASKS:
        print(f"❌ Unknown task: {task}")
        print(f"Available tasks: {', '.join(TASKS.keys())}")
        sys.exit(1)

    script = TASKS[task]
    
    # Check if script exists
    if not script.exists():
        print(f"❌ Script not found: {script}")
        sys.exit(1)
    
    print(f"🚀 Running {task} task using: {script}")
    
    # Set up environment
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    # Ensure we're in the project root directory
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)

    try:
        # Run the script and capture output in real-time
        process = subprocess.run(
            [sys.executable, str(script)],
            env=env,
            check=True,
            capture_output=False,  # Stream output directly
            text=True,
            encoding='utf-8'
        )
        print(f"\n✅ Task '{task}' completed successfully.")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Task '{task}' failed with exit code {e.returncode}")
        return e.returncode
    except Exception as e:
        print(f"\n❌ Task '{task}' error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python run-local-task.py --task [clean|fetch|merge|schema]")
        sys.exit(1)
    
    if sys.argv[1] != "--task":
        print("❌ Expected --task flag")
        sys.exit(1)
    
    task = sys.argv[2]
    if not task:
        print("❌ Missing task argument")
        sys.exit(1)
    
    exit_code = run_task(task)
    sys.exit(exit_code)

