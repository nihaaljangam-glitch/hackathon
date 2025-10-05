# backend.py
from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.responses import FileResponse, HTMLResponse
from sqlmodel import SQLModel, Field, create_engine, Session, select
from pydantic import BaseModel
import bcrypt, time, os, requests, json, logging

LOG = logging.getLogger("hackathon")
LOG.setLevel(logging.INFO)

# ---------- CONFIG ----------
DB_FILE = "hackathon.db"
DB_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(DB_URL, echo=False, connect_args={"check_same_thread": False})

BANNED_WORDS = ["trash", "idiot", "hate", "stupid", "nonsense"]
AI_GENERATE_URL = "http://localhost:11434/api/generate"  # Ollama HTTP endpoint
AI_MODEL = "mistral"

app = FastAPI(title="Hack the Classroom Backend")

# ---------- MODELS ----------
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str
    password_hash: str

class Question(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    body: str
    user_id: int = Field(foreign_key="user.id")
    flags: int = 0
    hidden: bool = False
    upvotes: int = 0
    downvotes: int = 0
    created_at: float = Field(default_factory=lambda: time.time())

class Answer(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="question.id")
    body: str
    user_id: int = Field(foreign_key="user.id")
    role: str = "student"   # "student", "mentor", "ai"
    flags: int = 0
    hidden: bool = False
    upvotes: int = 0
    downvotes: int = 0
    created_at: float = Field(default_factory=lambda: time.time())

# ---------- INIT ----------
@app.on_event("startup")
def startup():
    LOG.info("Creating DB and tables if needed (file=%s)", DB_FILE)
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as s:
        yield s

# ---------- AI (streaming-safe) ----------
def generate_ai_answer(title: str, body: str) -> str:
    prompt = f"Q: {title}\n{body}\n\nAnswer:"
    try:
        resp = requests.post(
            AI_GENERATE_URL,
            json={"model": AI_MODEL, "prompt": prompt},
            stream=True,
            timeout=60,
        )
    except Exception as e:
        LOG.exception("AI request failed")
        return f"🤖 (AI error: {e})"

    if resp.status_code != 200:
        LOG.warning("AI endpoint returned status %s", resp.status_code)
        # try to return text if present
        try:
            return "🤖 (AI unavailable: " + resp.text[:200] + ")"
        except Exception:
            return "🤖 (AI unavailable)"

    full_text = ""
    for raw in resp.iter_lines(decode_unicode=True):
        if not raw:
            continue
        # each line might be JSON or plain text
        try:
            obj = json.loads(raw)
            # many formats use 'response' or 'text' or 'content'
            piece = obj.get("response") or obj.get("text") or obj.get("content") or ""
            if isinstance(piece, str):
                full_text += piece
        except Exception:
            # fallback: if line not JSON, append raw
            try:
                full_text += raw
            except Exception:
                pass
    if not full_text.strip():
        return "🤖 (AI returned empty)"
    return "🤖 " + full_text.strip()

def ai_autoflag(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    for bad in BANNED_WORDS:
        if bad in t:
            return True
    return False

# ---------- SCHEMAS ----------
class AskIn(BaseModel):
    title: str
    body: str
    user_id: int

class AnswerIn(BaseModel):
    question_id: int
    body: str
    user_id: int
    role: str = "student"

# ---------- AUTH ----------
@app.post("/api/register")
def register(name: str = Body(...), email: str = Body(...), password: str = Body(...), session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(400, "Email already registered")
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    u = User(name=name, email=email, password_hash=hashed)
    session.add(u); session.commit(); session.refresh(u)
    return {"ok": True, "user_id": u.id, "name": u.name}

@app.post("/api/login")
def login(email: str = Body(...), password: str = Body(...), session: Session = Depends(get_session)):
    u = session.exec(select(User).where(User.email == email)).first()
    if not u or not bcrypt.checkpw(password.encode(), u.password_hash.encode()):
        raise HTTPException(401, "Invalid credentials")
    return {"ok": True, "user_id": u.id, "name": u.name}

# ---------- QUESTIONS ----------
@app.get("/api/questions")
def get_questions(session: Session = Depends(get_session)):
    qs = session.exec(select(Question).where(Question.hidden == False)).all()
    return [q.__dict__ for q in qs]

@app.get("/api/top-questions")
def top_questions(session: Session = Depends(get_session)):
    qs = session.exec(select(Question).where(Question.hidden == False)).all()
    sorted_qs = sorted(qs, key=lambda q: (q.upvotes - q.downvotes), reverse=True)[:50]
    return [q.__dict__ for q in sorted_qs]

@app.get("/api/questions/{qid}")
def get_question(qid: int, session: Session = Depends(get_session)):
    q = session.get(Question, qid)
    if not q:
        raise HTTPException(404, "Not found")
    answers = session.exec(select(Answer).where(Answer.question_id == qid, Answer.hidden == False)).all()
    # Sort: AI first, then mentors, then students; within group by created_at desc
    def rank(a):
        r = 2
        if a.role == "ai": r = 0
        elif a.role == "mentor": r = 1
        return (r, -a.created_at)
    answers_sorted = sorted(answers, key=rank)
    return {"question": q.__dict__, "answers": [a.__dict__ for a in answers_sorted]}

@app.post("/api/ask")
def ask(req: AskIn, session: Session = Depends(get_session)):
    title = req.title.strip()
    body = req.body.strip()
    if not title:
        raise HTTPException(400, "Title required")
    q = Question(title=title, body=body, user_id=req.user_id)
    if ai_autoflag(title) or ai_autoflag(body):
        q.flags = 3
        q.hidden = True
    session.add(q); session.commit(); session.refresh(q)
    if not q.hidden:
        ai_text = generate_ai_answer(title, body)
        ai_answer = Answer(question_id=q.id, body=ai_text, user_id=0, role="ai")
        session.add(ai_answer); session.commit()
    return {"ok": True, "id": q.id}

@app.post("/api/answer")
def answer(req: AnswerIn, session: Session = Depends(get_session)):
    q = session.get(Question, req.question_id)
    if not q:
        raise HTTPException(404, "Question not found")
    a = Answer(question_id=req.question_id, body=req.body.strip(), user_id=req.user_id, role=req.role)
    session.add(a); session.commit(); session.refresh(a)
    return {"ok": True, "id": a.id, **a.__dict__}

# ---------- FLAG + VOTE ----------
@app.post("/api/flag")
def flag(target_type: str = Body(...), target_id: int = Body(...), session: Session = Depends(get_session)):
    Model = Question if target_type == "question" else Answer
    item = session.get(Model, target_id)
    if not item:
        raise HTTPException(404, "Not found")
    item.flags = (item.flags or 0) + 1
    if item.flags >= 3:
        item.hidden = True
    session.add(item); session.commit()
    return {"ok": True, "flags": item.flags, "hidden": item.hidden}

@app.post("/api/vote")
def vote(target_type: str = Body(...), target_id: int = Body(...), delta: int = Body(...), session: Session = Depends(get_session)):
    Model = Question if target_type == "question" else Answer
    item = session.get(Model, target_id)
    if not item:
        raise HTTPException(404, "Not found")
    if delta > 0:
        item.upvotes = (item.upvotes or 0) + 1
    else:
        item.downvotes = (item.downvotes or 0) + 1
    session.add(item); session.commit()
    return {"ok": True, "upvotes": item.upvotes, "downvotes": item.downvotes}

# ---------- PROFILE ----------
@app.get("/api/profile/{uid}")
def profile(uid: int, session: Session = Depends(get_session)):
    user = session.get(User, uid)
    if not user:
        raise HTTPException(404, "User not found")
    questions = session.exec(select(Question).where(Question.user_id == uid)).all()
    answers = session.exec(select(Answer).where(Answer.user_id == uid)).all()
    return {
        "name": user.name,
        "email": user.email,
        "questions": [{"id": q.id, "title": q.title, "flags": q.flags, "hidden": q.hidden} for q in questions],
        "answers": len(answers),
        "flags_total": sum((q.flags or 0) for q in questions) + sum((a.flags or 0) for a in answers),
        "questions_count": len(questions)
    }

# ---------- FRONTEND SERVING ----------
def _serve_file(name: str):
    name = os.path.basename(name)
    if os.path.exists(name):
        return FileResponse(name)
    raise HTTPException(404, "file not found")

@app.get("/", response_class=HTMLResponse)
def root():
    return _serve_file("index.html")

@app.get("/portal", response_class=HTMLResponse)
def portal():
    return _serve_file("portal.html")

@app.get("/view", response_class=HTMLResponse)
def view_page():
    return _serve_file("view.html")

@app.get("/{filename}")
def static_files(filename: str):
    if filename in {"app.js", "portal.js", "view.js"} and os.path.exists(filename):
        return _serve_file(filename)
    raise HTTPException(404, "Not found")