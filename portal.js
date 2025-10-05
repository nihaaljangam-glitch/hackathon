// portal.js
(async function () {
  const $ = s => document.querySelector(s);
  const topList = $('#topList');
  const recentList = $('#recentList');
  const postQ = $('#postQ');
  const refreshQ = $('#refreshQ');
  const qTitle = $('#qTitle');
  const qBody = $('#qBody');
  const postMsg = $('#postMsg');
  const profileInfo = $('#profile-info');
  const logoutBtn = $('#logoutBtn');
  const profileBtn = $('#profileBtn');

  function api(path, method='GET', body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(async res => {
      if (!res.ok) {
        const txt = await res.text().catch(()=>res.statusText);
        throw new Error(txt || res.status);
      }
      const ct = res.headers.get('Content-Type')||'';
      return ct.includes('application/json') ? res.json() : res.text();
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderQuestionCard(q) {
    const div = document.createElement('div');
    div.className = 'p-3 border rounded bg-white';
    div.innerHTML = `
      <div class="font-semibold">${escapeHtml(q.title)}</div>
      <div class="text-gray-700 text-sm mt-1">${escapeHtml(q.body.slice(0,200))}</div>
      <div class="flex gap-2 mt-2">
        <button data-id="${q.id}" class="viewBtn px-2 py-1 bg-blue-600 text-white rounded text-sm">View</button>
        <button data-id="${q.id}" class="flagBtn px-2 py-1 bg-yellow-500 text-white rounded text-sm">Flag</button>
        <button data-id="${q.id}" data-delta="1" class="voteBtn px-2 py-1 bg-green-500 text-white rounded text-sm">▲ ${q.upvotes||0}</button>
        <button data-id="${q.id}" data-delta="-1" class="voteBtn px-2 py-1 bg-red-500 text-white rounded text-sm">▼ ${q.downvotes||0}</button>
      </div>
    `;
    return div;
  }

  async function loadLists() {
    try {
      const [top, recent] = await Promise.all([api('/api/top-questions'), api('/api/questions')]);
      topList.innerHTML = ''; recentList.innerHTML = '';
      (top||[]).forEach(q => topList.appendChild(renderQuestionCard(q)));
      (recent||[]).forEach(q => recentList.appendChild(renderQuestionCard(q)));
    } catch (e) {
      console.error(e);
    }
  }

  postQ.addEventListener('click', async () => {
    postMsg.textContent = '';
    postQ.disabled = true;
    try {
      const uid = Number(localStorage.getItem('user_id') || 0);
      if (!uid) { postMsg.textContent = 'You must be logged in'; return; }
      if (!qTitle.value.trim()) { postMsg.textContent = 'Title required'; return; }
      await api('/api/ask', 'POST', { title: qTitle.value, body: qBody.value, user_id: uid });
      qTitle.value = ''; qBody.value = '';
      postMsg.style.color = 'green'; postMsg.textContent = 'Posted';
      await loadLists();
    } catch (e) {
      postMsg.style.color = 'red'; postMsg.textContent = 'Post failed';
      console.error(e);
    } finally { postQ.disabled = false; }
  });

  refreshQ.addEventListener('click', loadLists);

  document.addEventListener('click', async (ev) => {
    const v = ev.target.closest('.viewBtn');
    if (v) {
      const id = v.dataset.id;
      window.location.href = `/view?id=${encodeURIComponent(id)}`;
      return;
    }
    const f = ev.target.closest('.flagBtn');
    if (f) {
      try {
        await api('/api/flag', 'POST', { target_type: 'question', target_id: Number(f.dataset.id) });
        await loadLists();
      } catch (e) { alert('Flag failed'); console.error(e); }
      return;
    }
    const vote = ev.target.closest('.voteBtn');
    if (vote) {
      try {
        await api('/api/vote', 'POST', { target_type: 'question', target_id: Number(vote.dataset.id), delta: Number(vote.dataset.delta) });
        await loadLists();
      } catch (e) { alert('Vote failed'); console.error(e); }
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user_id'); localStorage.removeItem('user_name');
    location.href = '/';
  });

  profileBtn.addEventListener('click', async () => {
    const uid = Number(localStorage.getItem('user_id') || 0);
    if (!uid) { alert('Not logged in'); return; }
    try {
      const p = await api(`/api/profile/${uid}`);
      alert(`Name: ${p.name}\nEmail: ${p.email}\nQuestions: ${p.questions_count}\nAnswers: ${p.answers}`);
    } catch (e) { alert('Failed to load profile'); console.error(e); }
  });

  // show profile info
  const uid = Number(localStorage.getItem('user_id') || 0);
  const uname = localStorage.getItem('user_name') || 'guest';
  if (uid) profileInfo.textContent = `Signed in as ${uname} (id ${uid})`;
  else profileInfo.textContent = 'Not signed in';

  // initial load
  loadLists();
})();