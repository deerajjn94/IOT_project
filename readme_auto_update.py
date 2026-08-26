import argparse
import subprocess
import sys
from datetime import datetime, timezone
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
    return result.stdout


def get_repository_root():
    script_directory = Path(__file__).resolve().parent
    return Path(
        run_git_command(["git", "rev-parse", "--show-toplevel"], script_directory).strip()
    )


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Update the README change summary, then commit and push it."
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


def get_changed_files(repo_root):
    output = run_git_command(
        ["git", "status", "--porcelain=v1", "--untracked-files=all", "-z"],
        repo_root,
    )
    files = []
    records = [record for record in output.split("\0") if record]
    for record in records:
        file_path = record[3:]
        if file_path.lower() not in {"readme.md", "readme_auto_update.py"}:
            files.append(file_path)
    return sorted(set(files))


def update_readme(repo_root, changed_files):
    readme_path = repo_root / "README.md"
    current_content = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""
    start_marker = "<!-- AUTO-UPDATE:START -->"
    end_marker = "<!-- AUTO-UPDATE:END -->"

    if changed_files:
        file_lines = "\n".join(f"- `{file_path}`" for file_path in changed_files)
        summary = (
            f"{start_marker}\n"
            "## Automatic Change Summary\n\n"
            f"Last checked: {datetime.now(timezone.utc).isoformat()}\n\n"
            "Changes detected:\n\n"
            f"{file_lines}\n"
            f"{end_marker}"
        )
    else:
        summary = (
            f"{start_marker}\n"
            "## Automatic Change Summary\n\n"
            "No project changes detected.\n"
            f"{end_marker}"
        )

    if start_marker in current_content and end_marker in current_content:
        start_index = current_content.index(start_marker)
        end_index = current_content.index(end_marker) + len(end_marker)
        updated_content = current_content[:start_index] + summary + current_content[end_index:]
    else:
        separator = "\n\n" if current_content else ""
        updated_content = current_content.rstrip() + separator + summary + "\n"

    readme_path.write_text(updated_content, encoding="utf-8")


def main():
    arguments = parse_arguments()
    repository_root = get_repository_root()
    changed_files = get_changed_files(repository_root)
    update_readme(repository_root, changed_files)
    print(f"Updated {repository_root / 'README.md'}.")

    updater_path = repository_root / "git_auto_update.py"
    command = [sys.executable, str(updater_path), "--remote", arguments.remote]
    if arguments.branch:
        command.extend(["--branch", arguments.branch])
    result = subprocess.run(command, cwd=repository_root)
    if result.returncode != 0:
        raise GitCommandError("git_auto_update.py could not commit and push the changes.")


if __name__ == "__main__":
    try:
        main()
    except (GitCommandError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
