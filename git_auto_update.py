import subprocess

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
            if "/" not in file_path:  # only top-level files
                root_changes.append(file_path)

    # Step 4: Build commit message
    commit_msg = "Auto-update (Dev branch):\n"
    if root_changes:
        commit_msg += f"Root folder changes: {', '.join(root_changes)}\n"
    if public_changes:
        commit_msg += f"Public folder changes: {', '.join(public_changes)}\n"

    # Step 5: Commit
    run_git_command(["git", "commit", "-m", commit_msg])

    # Step 6: Push to dev branch
    run_git_command(["git", "push", "origin", "Dev"])

    print("Changes committed and pushed to Dev branch successfully!")

if __name__ == "__main__":
    main()
