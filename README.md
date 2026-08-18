# ChatBot
A document-focused AI chatbot that allows users to interact with records stored in a Google Drive folder. It uses the Gemini API to understand the provided documents and answer questions, generate summaries, compare records, and present information in structured formats with source references where available.


To Run App :

This in Test Phase

add test user i 

https://console.cloud.google.com/auth/audience

And To Run Application

cd <project-path>\ChatBot\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000