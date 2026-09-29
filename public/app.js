const authView = document.querySelector('#auth-view');
const todoView = document.querySelector('#todo-view');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const todoMessage = document.querySelector('#todo-message');
const logoutButton = document.querySelector('#logout-button');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const todoForm = document.querySelector('#todo-form');

let authMode = 'login';
let filter = 'all';
let todos = [];

const today = new Date();
document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric'
}).format(today);
document.querySelector('#workspace-date').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
}).format(today).toUpperCase();

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle('is-success', success);
}

async function request(path, options = {}) {
  const token = localStorage.getItem('daymark-token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && token) showAuth();
    throw new Error(result.message || 'Something went wrong. Please try again.');
  }
  return result;
}

function showAuth() {
  localStorage.removeItem('daymark-token');
  authView.classList.remove('hidden');
  todoView.classList.add('hidden');
  logoutButton.classList.add('hidden');
  todos = [];
}

function showWorkspace(user) {
  authView.classList.add('hidden');
  todoView.classList.remove('hidden');
  logoutButton.classList.remove('hidden');
  document.querySelector('#welcome-copy').textContent = `Signed in as ${user.email}. A clear list makes a little room for everything else.`;
  loadTodos();
}

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = mode === 'login';
  document.querySelector('#login-tab').classList.toggle('is-selected', isLogin);
  document.querySelector('#register-tab').classList.toggle('is-selected', !isLogin);
  document.querySelector('#login-tab').setAttribute('aria-selected', String(isLogin));
  document.querySelector('#register-tab').setAttribute('aria-selected', String(!isLogin));
  document.querySelector('#form-heading').textContent = isLogin ? 'Welcome back' : 'Start with a fresh page';
  document.querySelector('#form-caption').textContent = isLogin ? 'Pick up where you left off.' : 'Create an account to keep your tasks close.';
  document.querySelector('#auth-submit').textContent = isLogin ? 'Sign in' : 'Create account';
  document.querySelector('#password').autocomplete = isLogin ? 'current-password' : 'new-password';
  setMessage(authMessage, '');
}

function makeIcon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  iconPath.setAttribute('d', path);
  svg.append(iconPath);
  return svg;
}

function actionButton(label, iconPath, handler) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(makeIcon(iconPath));
  button.addEventListener('click', handler);
  return button;
}

function renderTodos() {
  const filtered = todos.filter((todo) => {
    if (filter === 'active') return !todo.isCompleted;
    if (filter === 'completed') return todo.isCompleted;
    return true;
  });
  todoList.replaceChildren();
  for (const todo of filtered) {
    const item = document.createElement('li');
    item.className = `todo-item${todo.isCompleted ? ' is-complete' : ''}`;

    const check = document.createElement('button');
    check.className = 'check-button';
    check.type = 'button';
    check.setAttribute('aria-label', todo.isCompleted ? `Mark ${todo.title} as to do` : `Complete ${todo.title}`);
    check.setAttribute('aria-pressed', String(todo.isCompleted));
    check.addEventListener('click', () => updateTodo(todo.id, { isCompleted: !todo.isCompleted }));

    const content = document.createElement('div');
    content.className = 'todo-content';
    const title = document.createElement('p');
    title.className = 'todo-title';
    title.textContent = todo.title;
    content.append(title);
    if (todo.description) {
      const description = document.createElement('p');
      description.className = 'todo-description';
      description.textContent = todo.description;
      content.append(description);
    }

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    actions.append(actionButton('Edit task', 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z', () => editTodo(todo)));
    actions.append(actionButton('Delete task', 'M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5', () => deleteTodo(todo)));
    item.append(check, content, actions);
    todoList.append(item);
  }

  const completed = todos.filter((todo) => todo.isCompleted).length;
  const active = todos.length - completed;
  document.querySelector('#all-count').textContent = String(todos.length);
  document.querySelector('#active-count').textContent = String(active);
  document.querySelector('#completed-count').textContent = String(completed);
  document.querySelector('#progress-number').textContent = `${completed}/${todos.length}`;
  document.querySelector('#footer-count').textContent = `${active} open ${active === 1 ? 'task' : 'tasks'}`;
  emptyState.classList.toggle('hidden', filtered.length !== 0);
  document.querySelector('#empty-title').textContent = todos.length === 0 ? 'Nothing on the list yet.' : 'All clear here.';
  document.querySelector('#empty-caption').textContent = todos.length === 0 ? 'Add a task above to get started.' : 'There are no tasks in this view.';
}

async function loadTodos() {
  try {
    const result = await request('/api/todos');
    todos = result.data;
    renderTodos();
  } catch (error) {
    setMessage(todoMessage, error.message);
  }
}

async function updateTodo(id, changes) {
  try {
    const result = await request(`/api/todos/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(changes)
    });
    todos = todos.map((todo) => todo.id === id ? result.data : todo);
    renderTodos();
    setMessage(todoMessage, 'Task updated.', true);
  } catch (error) {
    setMessage(todoMessage, error.message);
  }
}

async function editTodo(todo) {
  const title = window.prompt('Task title', todo.title);
  if (title === null) return;
  if (!title.trim()) {
    setMessage(todoMessage, 'A task title is required.');
    return;
  }
  const description = window.prompt('Task note (optional)', todo.description || '');
  if (description === null) return;
  await updateTodo(todo.id, { title, description });
}

async function deleteTodo(todo) {
  if (!window.confirm(`Delete "${todo.title}"?`)) return;
  try {
    await request(`/api/todos/${encodeURIComponent(todo.id)}`, { method: 'DELETE' });
    todos = todos.filter((item) => item.id !== todo.id);
    renderTodos();
    setMessage(todoMessage, 'Task deleted.', true);
  } catch (error) {
    setMessage(todoMessage, error.message);
  }
}

document.querySelector('#login-tab').addEventListener('click', () => setAuthMode('login'));
document.querySelector('#register-tab').addEventListener('click', () => setAuthMode('register'));
document.querySelectorAll('.filter-tab').forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('is-selected', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });
    renderTodos();
  });
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.querySelector('#auth-submit');
  submit.disabled = true;
  setMessage(authMessage, '');
  const formData = new FormData(authForm);
  try {
    const result = await request(`/api/auth/${authMode === 'login' ? 'login' : 'register'}`, {
      method: 'POST', body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') })
    });
    if (authMode === 'register') {
      setAuthMode('login');
      authForm.reset();
      setMessage(authMessage, 'Account created. Sign in to continue.', true);
    } else {
      localStorage.setItem('daymark-token', result.token);
      showWorkspace(result.user);
    }
  } catch (error) {
    setMessage(authMessage, error.message);
  } finally {
    submit.disabled = false;
  }
});

todoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = todoForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  setMessage(todoMessage, '');
  const formData = new FormData(todoForm);
  try {
    const result = await request('/api/todos', {
      method: 'POST', body: JSON.stringify({ title: formData.get('title'), description: formData.get('description') || null })
    });
    todos.unshift(result.data);
    todoForm.reset();
    renderTodos();
    setMessage(todoMessage, 'Task added.', true);
    document.querySelector('#todo-title').focus();
  } catch (error) {
    setMessage(todoMessage, error.message);
  } finally {
    submit.disabled = false;
  }
});

logoutButton.addEventListener('click', showAuth);

async function restoreSession() {
  const token = localStorage.getItem('daymark-token');
  if (!token) return;
  try {
    const result = await request('/api/todos');
    todos = result.data;
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    showWorkspace({ email: tokenPayload.email });
    renderTodos();
  } catch {
    showAuth();
  }
}

restoreSession();