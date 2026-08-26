# IOT Project

A Node.js and Express web application for monitoring and controlling IoT devices. The browser interface is served from the `public/` directory and the backend listens on port 3000.

## Requirements

- Node.js and npm
- SQL Server or SQL Server Express
- Python 3 (only for the Git automation scripts)

## Setup

1. Install the Node.js dependencies:

   ```powershell
   npm install
   ```

2. Configure the database connection settings in `server.js` for the computer where the application will run.
3. Start the server:

   ```powershell
   node server.js
   ```

4. Open `http://localhost:3000` in a browser.

## Git Automation

Run the following command from any directory. Replace the path with the location of this repository on the current computer:

```powershell
py "C:\path\to\IOT_project\readme_auto_update.py" --branch dev
```

The script updates the generated change summary below, then uses `git_auto_update.py` to commit and push the current branch. Git Credential Manager must be authenticated to a GitHub account with write access.

## Security Notes

Do not commit database passwords, session secrets, or API keys. Move local secrets into environment variables before sharing this repository or deploying it.

<!-- AUTO-UPDATE:START -->
## Automatic Change Summary

No project changes detected.
<!-- AUTO-UPDATE:END -->
