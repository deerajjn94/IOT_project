import argparse
import subprocess
import sys
from pathlib import Path


class GitCommandError(RuntimeError):
    """Raised when a Git command fails."""


def run_git_command(command, repo_root):
    """Run a Git command from the repository and return its output."""
    result = subprocess.run(
        command,
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        details = result.stderr.strip() or result.stdout.strip()
        raise GitCommandError(f"{' '.join(command)} failed: {details}")
    return result.stdout.strip()


def get_repository_root():
    """Find the Git repository containing this script."""
    script_directory = Path(__file__).resolve().parent
    try:
        return Path(
            run_git_command(["git", "rev-parse", "--show-toplevel"], script_directory)
        )
    except GitCommandError as error:
        raise GitCommandError(
            f"This script must be inside a Git repository: {error}"
        ) from error


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Commit local changes and push the current Git branch."
    )
    parser.add_argument(
        "--branch",
        help="Expected branch to push (defaults to the currently checked out branch).",
    )
    parser.add_argument(
        "--remote",
        default="origin",
        help="Git remote to push (default: origin).",
    )
    return parser.parse_args()


def main():
    arguments = parse_arguments()
    repository_root = get_repository_root()

    branch = run_git_command(["git", "branch", "--show-current"], repository_root)
    if not branch:
        raise GitCommandError("The repository is in detached HEAD state.")
    if arguments.branch and arguments.branch != branch:
        raise GitCommandError(
            f"Currently on '{branch}', but --branch requested '{arguments.branch}'."
        )

    run_git_command(["git", "add", "--all"], repository_root)
    staged_files_output = run_git_command(
        ["git", "diff", "--cached", "--name-only", "-z"], repository_root
    )
    staged_files = [path for path in staged_files_output.split("\0") if path]

    if staged_files:
        root_changes = [path for path in staged_files if "/" not in path]
        public_changes = [path for path in staged_files if path.startswith("public/")]
        other_changes = [
            path for path in staged_files if path not in root_changes + public_changes
        ]

        commit_parts = [f"Auto-update ({branch} branch):"]
        if root_changes:
            commit_parts.append(f"Root folder changes: {', '.join(root_changes)}")
        if public_changes:
            commit_parts.append(f"Public folder changes: {', '.join(public_changes)}")
        if other_changes:
            commit_parts.append(f"Other changes: {', '.join(other_changes)}")

        run_git_command(
            ["git", "commit", "-m", "\n".join(commit_parts)], repository_root
        )
    else:
        print("No changes to commit.")

    run_git_command(
        ["git", "pull", "--rebase", arguments.remote, branch], repository_root
    )
    run_git_command(
        ["git", "push", arguments.remote, f"{branch}:{branch}"], repository_root
    )
    print(f"Branch '{branch}' committed and pushed to {arguments.remote} successfully.")


if __name__ == "__main__":
    try:
        main()
    except (GitCommandError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
