# ChatBot

A document-focused AI chatbot that allows users to interact with records stored
in a Google Drive folder. It uses the Gemini API to understand documents and
answer questions, generate summaries, compare records, and present information
with source references where available.

## Prerequisites

- Windows PowerShell, or an equivalent terminal on macOS/Linux
- Python 3.11 or newer
- Internet access for the Gemini and Google Drive APIs
- A Google AI Studio API key for Gemini
- A Google Drive folder containing PDF files
- A Google Cloud API key with the Google Drive API enabled

For a private Google Drive folder, configure a Google OAuth 2.0 Web client ID
instead of using a public folder. Add test users in the Google Cloud OAuth
consent screen while the application is in testing:
<https://console.cloud.google.com/auth/audience>

## Installation

From the project root, create and activate a virtual environment, then install
the backend dependencies:

```powershell
cd <project-path>\ChatBot\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks script execution, activate the environment from Command
Prompt instead:

```bat
.venv\Scripts\activate.bat
```

## Configuration

Create `backend\.env` from the example file:

```powershell
copy .env.example .env
```

Set these values in `.env`:

```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key_here
GOOGLE_CLIENT_ID=your_google_oauth_web_client_id_here
```

Get a Gemini key from <https://aistudio.google.com/app/apikey>. Enable the
Google Drive API for the Google Cloud project used by
`GOOGLE_DRIVE_API_KEY`:
<https://console.cloud.google.com/apis/library/drive.googleapis.com>

`GOOGLE_CLIENT_ID` is optional when using a folder shared as **Anyone with the
link can view**. It is required for the browser's Google authorization flow
when accessing private Drive folders. Configure the OAuth client with the
application's local origin, usually `http://localhost:8000`.

## Run the Application

From the `backend` directory with the virtual environment activated:

```powershell
python -m uvicorn main:app --reload --port 8000
```

Open the application at <http://localhost:8000>.

API documentation is available at:

- Swagger UI: <http://localhost:8000/api/docs>
- ReDoc: <http://localhost:8000/api/redoc>

The backend serves the frontend automatically, so a separate frontend server
is not required.

## Google Drive Requirements

- Use a valid Google Drive folder URL in the application.
- The folder must contain PDF documents.
- For API-key access, share the folder as **Anyone with the link can view**.
- For private folders, authorize the application with Google and add the test
	account to the OAuth consent screen.

## Notes

- Do not commit `.env`; it contains API credentials.
- Uploaded Gemini files are temporary and expire after approximately 48 hours.
- Session state is stored in memory and is lost when the server restarts.