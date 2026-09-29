const authView = document.querySelector('#auth-view');
const todoView = document.querySelector('#todo-view');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const todoMessage = document.querySelector('#todo-message');
const logoutButton = document.querySelector('#logout-button');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const todoForm = document.querySelector('#todo-form');
const listSelect = document.querySelector('#todo-list-id');
const newListName = document.querySelector('#new-list-name');
const createListButton = document.querySelector('#create-list');

let authMode = 'login';
let filter = 'all';
let todos = [];
let lists = [];

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
  lists = [];
}

function showWorkspace(user) {
  authView.classList.add('hidden');
  todoView.classList.remove('hidden');
  logoutButton.classList.remove('hidden');
  document.querySelector('#welcome-copy').textContent = `Signed in as ${user.email}. A clear list makes a little room for everything else.`;
  loadLists();
  loadTodos();
}

async function loadLists() {
  try {
    const result = await request('/api/lists');
    lists = result.data;
    listSelect.replaceChildren(new Option('Select a list', '', true, true));
    for (const list of lists) listSelect.append(new Option(list.name, list.id));
  } catch (error) {
    setMessage(todoMessage, error.message);
  }
}

async function createList() {
  const name = newListName.value.trim();
  if (!name) return;
  createListButton.disabled = true;
  try {
    const result = await request('/api/lists', {
      method: 'POST', body: JSON.stringify({ name })
    });
    lists.push(result.data);
    listSelect.append(new Option(result.data.name, result.data.id));
    listSelect.value = result.data.id;
    newListName.value = '';
    setMessage(todoMessage, 'List created.', true);
  } catch (error) {
    setMessage(todoMessage, error.message);
  } finally {
    createListButton.disabled = false;
  }
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
  document.querySelector('#registration-fields').classList.toggle('hidden', isLogin);
  document.querySelector('#first-name').required = !isLogin;
  document.querySelector('#last-name').required = !isLogin;
  document.querySelector('#gender').required = !isLogin;
  document.querySelector('#auth-submit').textContent = isLogin ? 'Sign in' : 'Create account';
  document.querySelector('#password').autocomplete = isLogin ? 'current-password' : 'new-password';
  setMessage(authMessage, '');
}

function actionButton(label, handler) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.textContent = label;
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
    if (todo.dueAt) {
      const dueDate = document.createElement('p');
      dueDate.className = 'todo-due-date';
      dueDate.textContent = `Due ${new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(todo.dueAt))}`;
      content.append(dueDate);
    }

    const actions = document.createElement('div');
    actions.className = 'todo-actions';
    actions.append(actionButton('Edit', () => editTodo(todo)));
    actions.append(actionButton('Delete', () => deleteTodo(todo)));
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
      method: 'POST', body: JSON.stringify({
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        gender: formData.get('gender'),
        email: formData.get('email'),
        password: formData.get('password')
      })
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
      method: 'POST', body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description') || null,
        dueAt: formData.get('dueAt') || null,
        listId: formData.get('listId') || null
      })
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
createListButton.addEventListener('click', createList);

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