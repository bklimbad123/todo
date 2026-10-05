const form = document.querySelector('#auth-form');
const message = document.querySelector('#auth-message');
let mode = 'login';

function setMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle('is-success', success);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Something went wrong.');
  return result;
}

function setMode(nextMode) {
  mode = nextMode;
  const login = mode === 'login';
  document.querySelector('#login-tab').classList.toggle('is-selected', login);
  document.querySelector('#register-tab').classList.toggle('is-selected', !login);
  document.querySelector('#login-tab').setAttribute('aria-selected', String(login));
  document.querySelector('#register-tab').setAttribute('aria-selected', String(!login));
  document.querySelector('#form-heading').textContent = login ? 'Welcome' : 'Create your account';
  document.querySelector('#form-caption').textContent = login ? 'Pick up where you left off.' : 'Add your details to get started.';
  document.querySelector('#registration-fields').classList.toggle('hidden', login);
  document.querySelector('#first-name').required = !login;
  document.querySelector('#last-name').required = !login;
  document.querySelector('#gender').required = !login;
  document.querySelector('#auth-submit').textContent = login ? 'Sign in' : 'Create account';
  document.querySelector('#password').autocomplete = login ? 'current-password' : 'new-password';
  setMessage('');
}

document.querySelector('#login-tab').addEventListener('click', () => setMode('login'));
document.querySelector('#register-tab').addEventListener('click', () => setMode('register'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#auth-submit');
  const data = new FormData(form);
  submit.disabled = true;
  setMessage('');
  try {
    const result = await request(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
      method: 'POST',
      body: JSON.stringify({
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        gender: data.get('gender'),
        email: data.get('email'),
        password: data.get('password')
      })
    });
    if (mode === 'register') {
      setMode('login');
      form.reset();
      setMessage('Account created. Sign in to continue.', true);
      return;
    }
    localStorage.setItem('todo-token', result.token);
    window.location.href = '/dashboard';
  } catch (error) {
    setMessage(error.message);
  } finally {
    submit.disabled = false;
  }
});

if (localStorage.getItem('todo-token')) window.location.href = '/dashboard';
