# --- Base image: includes Ollama server ---
FROM ollama/ollama:latest

# --- Install Python ---
RUN apt-get update && apt-get install -y python3 python3-pip

# --- Set working directory ---
WORKDIR /app

# --- Copy project files into container ---
COPY . /app

# --- Install Python dependencies ---
RUN pip install --no-cache-dir -r requirements.txt

# --- Pre-pull the Mistral model (so it’s ready immediately) ---
RUN ollama pull mistral

# --- Expose FastAPI port ---
EXPOSE 8000

CMD /bin/sh -c "ollama serve & sleep 8 && uvicorn backend:app --host 0.0.0.0 --port 8000"