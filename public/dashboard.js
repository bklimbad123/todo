const token = localStorage.getItem('daymark-token');
const todoForm = document.querySelector('#todo-form');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const todoMessage = document.querySelector('#todo-message');
const listSelect = document.querySelector('#todo-list-id');
const newListName = document.querySelector('#new-list-name');
const createListButton = document.querySelector('#create-list');
let todos = [];
let filter = 'all';

if (!token) window.location.href = '/login';

function setMessage(text, success = false) {
  todoMessage.textContent = text;
  todoMessage.classList.toggle('is-success', success);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.href = '/login';
    throw new Error(result.message || 'Something went wrong.');
  }
  return result;
}

function renderTodos() {
  const visibleTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.isCompleted;
    if (filter === 'completed') return todo.isCompleted;
    return true;
  });
  todoList.replaceChildren();
  for (const todo of visibleTodos) {
    const item = document.createElement('li');
    item.className = `todo-item${todo.isCompleted ? ' is-complete' : ''}`;

    const check = document.createElement('button');
    check.className = 'check-button';
    check.type = 'button';
    check.setAttribute('aria-label', todo.isCompleted ? `Mark ${todo.title} as to do` : `Complete ${todo.title}`);
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
      dueDate.textContent = `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(todo.dueAt))}`;
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
  document.querySelector('#all-count').textContent = todos.length;
  document.querySelector('#active-count').textContent = active;
  document.querySelector('#completed-count').textContent = completed;
  document.querySelector('#progress-number').textContent = `${completed}/${todos.length}`;
  document.querySelector('#footer-count').textContent = `${active} open ${active === 1 ? 'task' : 'tasks'}`;
  emptyState.classList.toggle('hidden', visibleTodos.length > 0);
}

function actionButton(text, handler) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
}

async function loadLists() {
  const result = await request('/api/lists');
  listSelect.replaceChildren(new Option('Select a list', '', true, true));
  for (const list of result.data) listSelect.append(new Option(list.name, list.id));
}

async function loadTodos() {
  const result = await request('/api/todos');
  todos = result.data;
  renderTodos();
}

async function createList() {
  const name = newListName.value.trim();
  if (!name) return;
  createListButton.disabled = true;
  try {
    const result = await request('/api/lists', { method: 'POST', body: JSON.stringify({ name }) });
    listSelect.append(new Option(result.data.name, result.data.id));
    listSelect.value = result.data.id;
    newListName.value = '';
    setMessage('List created.', true);
  } catch (error) {
    setMessage(error.message);
  } finally {
    createListButton.disabled = false;
  }
}

async function updateTodo(id, changes) {
  try {
    const result = await request(`/api/todos/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(changes)
    });
    todos = todos.map((todo) => todo.id === id ? result.data : todo);
    renderTodos();
  } catch (error) {
    setMessage(error.message);
  }
}

async function editTodo(todo) {
  const title = prompt('Task title', todo.title);
  if (title === null || !title.trim()) return;
  const description = prompt('Task note (optional)', todo.description || '');
  if (description === null) return;
  await updateTodo(todo.id, { title, description });
}

async function deleteTodo(todo) {
  if (!confirm(`Delete "${todo.title}"?`)) return;
  try {
    await request(`/api/todos/${encodeURIComponent(todo.id)}`, { method: 'DELETE' });
    todos = todos.filter((item) => item.id !== todo.id);
    renderTodos();
  } catch (error) {
    setMessage(error.message);
  }
}

document.querySelector('#logout-button').addEventListener('click', () => {
  localStorage.removeItem('daymark-token');
  window.location.href = '/login';
});
createListButton.addEventListener('click', createList);
document.querySelectorAll('.filter-tab').forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((tab) => tab.classList.toggle('is-selected', tab === button));
    renderTodos();
  });
});
todoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = todoForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  const data = new FormData(todoForm);
  try {
    const result = await request('/api/todos', {
      method: 'POST',
      body: JSON.stringify({
        title: data.get('title'),
        description: data.get('description') || null,
        dueAt: data.get('dueAt') || null,
        listId: data.get('listId')
      })
    });
    todos.unshift(result.data);
    todoForm.reset();
    listSelect.value = '';
    renderTodos();
  } catch (error) {
    setMessage(error.message);
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
document.querySelector('#workspace-date').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());
Promise.all([loadLists(), loadTodos()]).catch((error) => setMessage(error.message));
