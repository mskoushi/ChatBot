# Private Document Chatbot — V1

A simple AI chatbot that lets you connect a **Google Drive folder of scanned PDFs** and ask questions about them using the **Gemini API**.

---

## Features

- Connect any publicly-shared Google Drive folder
- Lists all PDF documents in the folder
- Select which documents to use per session
- Natural language Q&A, summaries, comparisons, and structured extraction
- Works with scanned/image-based PDFs (Gemini handles OCR natively)
- Source citations for every answer
- Conversation history within a session

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.11+ | |
| Google AI Studio API key | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Google Cloud API key (Drive API) | Enable **Google Drive API** at [console.cloud.google.com](https://console.cloud.google.com/apis/library/drive.googleapis.com) |
| Google Drive folder | Must be shared as **"Anyone with the link can view"** |

> **Note:** The same Google Cloud project key can be used for both Gemini and Drive if both APIs are enabled on it.

---

## Installation

```bash
# 1. Navigate to the backend directory
cd doc-chatbot-v1/backend

# 2. Create and activate a virtual environment
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# Edit .env and fill in your API keys
```

---

## Configuration (`.env`)

```ini
# Google AI Studio API key
GEMINI_API_KEY=your_gemini_api_key_here

# Model — gemini-2.0-flash is fast and capable; use gemini-2.0-pro for highest quality
GEMINI_MODEL=gemini-2.0-flash

# Google Cloud API key with Drive API enabled
GOOGLE_DRIVE_API_KEY=your_google_drive_api_key_here
```

---

## Running the Application

```bash
# From the backend/ directory
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open your browser at: **http://localhost:8000**

The backend serves the frontend automatically — no separate frontend server needed.

---

## API Documentation

Interactive API docs are available at:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/drive/connect` | Connect a Google Drive folder |
| `POST` | `/api/documents/select` | Select and ingest documents |
| `POST` | `/api/chat/message` | Send a chat message |
| `DELETE` | `/api/chat/session` | Clear session |
| `GET` | `/api/chat/history/{session_id}` | Get conversation history |

---

## User Flow

1. **Connect** — Paste a Google Drive folder URL and click Connect
2. **Select** — Choose which PDFs to query (or select all)
3. **Chat** — Ask questions in natural language

### Example Questions

- *What is the amount mentioned in Record_001.pdf?*
- *Compare Record_001.pdf and Record_003.pdf*
- *Which records mention ABC Corporation?*
- *Summarize Record_005.pdf*
- *Give me the date, amount and status from all records in a table*

---

## Security

- API keys are stored in `.env` only (never in source code)
- `.env` is excluded by `.gitignore`
- The browser communicates only with the backend — API keys are never exposed to the client
- Gemini Files API storage is temporary (48 hours)

---

## V1 Limitations

- Google Drive folders must be publicly shared ("Anyone with the link")
- Session state is in-memory (resets on server restart)
- No automatic synchronization — reconnect the folder to pick up new files
- Large files (>50 MB) may time out during processing

## Future V2

- OAuth for private Google Drive access
- OCR pipeline for better accuracy on complex scans
- Vector database (Qdrant) for large document collections
- Local LLM support
- Persistent sessions and document versioning
