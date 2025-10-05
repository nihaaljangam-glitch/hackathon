const params = new URLSearchParams(window.location.search);
const qid = params.get("id");
const userId = localStorage.getItem("user_id") || 0;
const userName = localStorage.getItem("user_name") || "Unknown";

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "/portal";
});

async function loadQuestion() {
  try {
    const res = await fetch(`/api/questions/${qid}`);
    if (!res.ok) throw new Error("Failed to load question");
    const data = await res.json();

    document.getElementById("qTitle").textContent = data.question.title;
    document.getElementById("qBody").textContent = data.question.body;

    const aiAnswer = data.answers.find(a => a.role === "ai");
    document.getElementById("aiAnswer").textContent = aiAnswer ? aiAnswer.body : "No AI answer available.";

    renderAnswers(data.answers);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

function renderAnswers(answers) {
  const container = document.getElementById("answersList");
  container.innerHTML = "";

  const mentors = answers.filter(a => a.role === "mentor");
  const students = answers.filter(a => a.role === "student");

  const makeCard = (a) => {
    const div = document.createElement("div");
    div.className = "border rounded p-3 bg-gray-50";

    div.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <span class="font-semibold">${a.role === "mentor" ? "👨‍🏫 Mentor" : "👤 Student"} (User #${a.user_id})</span>
        <small class="text-gray-500">${new Date(a.created_at * 1000).toLocaleString()}</small>
      </div>
      <p class="text-gray-800 mb-2">${a.body}</p>
      <div class="flex gap-2 text-sm">
        <button class="upvote px-2 py-1 bg-green-500 text-white rounded">▲ ${a.upvotes}</button>
        <button class="downvote px-2 py-1 bg-red-500 text-white rounded">▼ ${a.downvotes}</button>
        <button class="flag px-2 py-1 bg-yellow-400 text-white rounded">🚩</button>
      </div>
    `;

    div.querySelector(".upvote").addEventListener("click", async () => {
      await vote("answer", a.id, 1);
      loadQuestion();
    });
    div.querySelector(".downvote").addEventListener("click", async () => {
      await vote("answer", a.id, -1);
      loadQuestion();
    });
    div.querySelector(".flag").addEventListener("click", async () => {
      await flag("answer", a.id);
      loadQuestion();
    });

    return div;
  };

  mentors.forEach(a => container.appendChild(makeCard(a)));
  students.forEach(a => container.appendChild(makeCard(a)));
}

async function vote(target_type, target_id, delta) {
  await fetch("/api/vote", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ target_type, target_id, delta })
  });
}

async function flag(target_type, target_id) {
  await fetch("/api/flag", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ target_type, target_id })
  });
}

document.getElementById("postAnswer").addEventListener("click", async () => {
  const body = document.getElementById("answerBody").value.trim();
  const role = document.getElementById("role").value;
  if (!body) return alert("Please write an answer.");

  await fetch("/api/answer", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ question_id: parseInt(qid), body, user_id: parseInt(userId), role })
  });

  document.getElementById("answerBody").value = "";
  loadQuestion();
});

loadQuestion();