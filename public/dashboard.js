const APP_KEY = 'todo';
const token = localStorage.getItem(`${APP_KEY}-token`);
const todoForm = document.querySelector('#todo-form');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const todoMessage = document.querySelector('#todo-message');
const listSelect = document.querySelector('#todo-list-id');
const newListName = document.querySelector('#new-list-name');
const createListButton = document.querySelector('#create-list');
let lists = [];
let todos = [];
let guestLists = new Set();
let guestTodos = new Set();
let filter = 'all';
const workspaceMode = document.querySelector('#workspace-mode');
const signInLink = document.querySelector('#sign-in-link');
const logoutButton = document.querySelector('#logout-button');

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
    if (response.status === 401) {
      localStorage.removeItem(`${APP_KEY}-token`);
      window.location.href = '/';
    }
    throw new Error(result.message || 'Something went wrong.');
  }
  return result;
}

function renderTodos() {
  const currentTodos = token ? todos : [...guestTodos];
  const visibleTodos = currentTodos.filter((todo) => {
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

  const completed = currentTodos.filter((todo) => todo.isCompleted).length;
  const active = currentTodos.length - completed;
  document.querySelector('#all-count').textContent = currentTodos.length;
  document.querySelector('#active-count').textContent = active;
  document.querySelector('#completed-count').textContent = completed;
  document.querySelector('#progress-number').textContent = `${completed}/${currentTodos.length}`;
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

async function createList() {
  const name = newListName.value.trim();
  if (!name) return;
  createListButton.disabled = true;
  try {
    if (token) {
      const list = (await request('/api/lists', { method: 'POST', body: JSON.stringify({ name }) })).data;
      lists.push(list);
      listSelect.append(new Option(list.name, list.id));
      listSelect.value = list.id;
      newListName.value = '';
      setMessage('List created.', true);
      return;
    }

    const exists = [...guestLists].some((list) => list.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setMessage('A list with this name already exists.');
      return;
    }

    const list = { id: crypto.randomUUID(), name };
    guestLists = new Set(guestLists);
    guestLists.add(list);
    listSelect.append(new Option(list.name, list.id));
    listSelect.value = list.id;
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
    if (token) {
      const updated = (await request(`/api/todos/${encodeURIComponent(id)}`, {
        method: 'PUT', body: JSON.stringify(changes)
      })).data;
      todos = todos.map((todo) => todo.id === id ? updated : todo);
      renderTodos();
      return;
    }

    const currentTodos = [...guestTodos];
    const existingTodo = currentTodos.find((todo) => todo.id === id);
    if (!existingTodo) return;
    const updated = { ...existingTodo, ...changes };
    guestTodos = new Set(currentTodos.map((todo) => todo.id === id ? updated : todo));
    renderTodos();
  } catch (error) {
    setMessage(error.message);
  }
}

function editTodo(todo) {
  const title = prompt('Task title', todo.title);
  if (title === null || !title.trim()) return;
  const description = prompt('Task note (optional)', todo.description || '');
  if (description === null) return;
  updateTodo(todo.id, { title: title.trim(), description: description.trim() || null });
}

async function deleteTodo(todo) {
  if (!confirm(`Delete "${todo.title}"?`)) return;
  if (token) {
    try {
      await request(`/api/todos/${encodeURIComponent(todo.id)}`, { method: 'DELETE' });
    } catch (error) {
      setMessage(error.message);
      return;
    }
    todos = todos.filter((item) => item.id !== todo.id);
    renderTodos();
    return;
  }

  guestTodos = new Set([...guestTodos].filter((item) => item.id !== todo.id));
  renderTodos();
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(`${APP_KEY}-token`);
  window.location.href = '/';
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
  const todo = {
    title: data.get('title').trim(),
    description: data.get('description').trim() || null,
    dueAt: data.get('dueAt') ? new Date(data.get('dueAt')).toISOString() : null,
    listId: data.get('listId')
  };
  try {
    if (token) {
      const created = (await request('/api/todos', { method: 'POST', body: JSON.stringify(todo) })).data;
      todos.unshift(created);
      todoForm.reset();
      listSelect.value = '';
      renderTodos();
      return;
    }

    const hasDuplicateTitle = [...guestTodos].some(
      (item) => item.listId === todo.listId && item.title.trim().toLowerCase() === todo.title.toLowerCase()
    );
    if (hasDuplicateTitle) {
      setMessage('A task with this title already exists in this list.');
      return;
    }

    const created = { ...todo, id: crypto.randomUUID(), isCompleted: false };
    guestTodos = new Set([created, ...guestTodos]);
    todoForm.reset();
    listSelect.value = '';
    renderTodos();
  } catch (error) {
    setMessage(error.message);
  } finally {
    submit.disabled = false;
  }
});

workspaceMode.textContent = token ? 'Saved account' : 'Temporary workspace';
signInLink.classList.toggle('hidden', Boolean(token));
logoutButton.classList.toggle('hidden', !token);
document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
document.querySelector('#workspace-date').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());
if (token) {
  Promise.all([request('/api/lists'), request('/api/todos')])
    .then(([listResult, todoResult]) => {
      lists = listResult.data;
      todos = todoResult.data;
      listSelect.replaceChildren(new Option('Select a list', '', true, true));
      for (const list of lists) listSelect.append(new Option(list.name, list.id));
      renderTodos();
    })
    .catch((error) => setMessage(error.message));
} else {
  renderTodos();
}
