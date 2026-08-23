import subprocess
import os

def run_git_command(cmd):
    """Run a git command and return output."""
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        print("Error:", result.stderr)
    return result.stdout.strip()

def main():
    # Step 1: Check for changes
    status_output = run_git_command(["git", "status", "--porcelain"])
    if not status_output:
        print("No changes detected.")
        return

    # Step 2: Stage all changes
    run_git_command(["git", "add", "."])

    # Step 3: Collect changed files
    changed_files = status_output.splitlines()
    root_changes = []
    public_changes = []

    for line in changed_files:
        file_path = line[3:]  # skip status symbols like 'M  '
        if file_path.startswith("public/"):
            public_changes.append(file_path)
        else:
            # only top-level files (no slash) are considered root
            if "/" not in file_path:
                root_changes.append(file_path)

    # Step 4: Build commit message
    commit_msg = "Auto-update:\n"
    if root_changes:
        commit_msg += f"Root folder changes: {', '.join(root_changes)}\n"
    if public_changes:
        commit_msg += f"Public folder changes: {', '.join(public_changes)}\n"

    # Step 5: Commit
    run_git_command(["git", "commit", "-m", commit_msg])

    # Step 6: Push
    run_git_command(["git", "push", "origin", "main"])

    print("Changes committed and pushed successfully!")

if __name__ == "__main__":
    main()
