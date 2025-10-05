# Hack the Classroom

An AI-powered classroom discussion platform where students, mentors, and AI collaborate to solve doubts.  
Built with FastAPI, TailwindCSS, and Ollama (Mistral).

---

## Overview

Hack the Classroom lets users:
- Ask questions and get instant AI-generated answers.
- Allow mentors and students to post their own solutions.
- Automatically detect and flag inappropriate or spammy content.
- Vote on questions with upvotes and downvotes.
- Track performance through personalized user profiles.

---

## Features

- AI-Generated Answers powered by Ollama’s Mistral model.
- User Roles: Student, Mentor, and AI response sorting.
- Flagging System: Auto and manual moderation for harmful language.
- Voting System: Upvotes and downvotes rank questions.
- Top 50 Questions Section highlights the most engaging topics.
- Profile Dashboard shows user stats and contributions.
- Secure Login using bcrypt-hashed passwords.
- Docker Support for one-command deployment.

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | HTML, TailwindCSS, JavaScript |
| Backend | FastAPI (Python) |
| Database | SQLite + SQLModel |
| AI Engine | Ollama Mistral |
| Deployment | Docker |

---

## Folder Structure

```
ai_hackathon/
│── backend.py
│── hackathon.db
│── index.html
│── portal.html
│── app.js
│── portal.js
│── view.js
│── requirements.txt
│── Dockerfile
│── README.md
```

---

## Requirements

Install dependencies:

```
pip install -r requirements.txt
```

Main dependencies:
- fastapi  
- uvicorn  
- sqlmodel  
- bcrypt  
- requests  

---

## AI Integration (Mistral)

Every question asked is automatically processed by Ollama’s Mistral model.

- The backend sends prompts like:  
  Q: <title>\n<body>\n\nAnswer:  
  to the local Ollama API endpoint:  
  http://localhost:11434/api/generate  
- Mistral generates a contextual, human-like answer.  
- If banned words are found, the system auto-flags and hides that question.

---

## Profile Page

Each profile displays:
- User’s name and email
- Total questions asked
- Total answers given
- Combined flags count
- List of all submitted questions (with visibility status)

---

## Docker Setup (Recommended)

Build Docker Image  
docker build -t hacktheclassroom .

Run the Container  
docker run -p 8000:8000 hacktheclassroom

This will:
- Start the Ollama server
- Preload the Mistral model
- Run FastAPI on port 8000

Access the Web App  
Visit: http://localhost:8000

You’ll see the login and registration page.  
Once logged in, you’ll access the AI Q&A portal.

---

## Local Development (Without Docker)

1. Install dependencies  
   pip install -r requirements.txt  

2. Start Ollama  
   ollama serve  
   ollama pull mistral  

3. Run FastAPI  
   uvicorn backend:app --reload  

Then open http://127.0.0.1:8000

---

## Environment Details

- Python ≥ 3.10  
- Ollama installed locally (https://ollama.ai)  
- Mistral model available (ollama pull mistral)

---

## Credits

"Empowering classrooms, one question at a time."

Built using:
- FastAPI for backend  
- TailwindCSS for frontend styling  
- Ollama Mistral for AI responses  
- Docker for easy deployment

---

## License

Licensed under the MIT License.  
You’re free to use, modify, and distribute — just give credit to Hack the Classroom.