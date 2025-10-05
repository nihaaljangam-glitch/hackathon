// app.js - login/register
(async function () {
  function $ (s) { return document.querySelector(s); }

  // Only run on index.html (login/register)
  if (!location.pathname.endsWith('/') && !location.pathname.endsWith('/index.html')) {
    return;
  }

  const loginEmail = $('#loginEmail');
  const loginPassword = $('#loginPassword');
  const loginBtn = $('#loginBtn');
  const loginMsg = $('#loginMsg');

  const regName = $('#regName');
  const regEmail = $('#regEmail');
  const regPassword = $('#regPassword');
  const regBtn = $('#regBtn');
  const regMsg = $('#regMsg');

  async function api(path, method='POST', body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `${res.status}`);
    }
    return res.json();
  }

  loginBtn.addEventListener('click', async () => {
    loginMsg.textContent = '';
    loginBtn.disabled = true;
    try {
      const resp = await api('/api/login', 'POST', { email: loginEmail.value, password: loginPassword.value });
      // store user info in localStorage
      localStorage.setItem('user_id', resp.user_id);
      localStorage.setItem('user_name', resp.name);
      // go to portal
      location.href = '/portal';
    } catch (err) {
      loginMsg.textContent = 'Login failed';
      console.error(err);
    } finally { loginBtn.disabled = false; }
  });

  regBtn.addEventListener('click', async () => {
    regMsg.textContent = '';
    regBtn.disabled = true;
    try {
      const resp = await api('/api/register', 'POST', { name: regName.value, email: regEmail.value, password: regPassword.value });
      regMsg.style.color = 'green';
      regMsg.textContent = 'Registered. You can now login.';
      regName.value = ''; regEmail.value = ''; regPassword.value = '';
    } catch (err) {
      regMsg.style.color = 'red';
      regMsg.textContent = 'Registration failed';
      console.error(err);
    } finally { regBtn.disabled = false; }
  });

})();