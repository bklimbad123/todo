const APP_KEY = 'todo';
const token = localStorage.getItem(`${APP_KEY}-token`);
const todoForm = document.querySelector('#todo-form');
const todoList = document.querySelector('#todo-list');
const emptyState = document.querySelector('#empty-state');
const todoMessage = document.querySelector('#todo-message');
const sidebarLists = document.querySelector('#sidebar-lists');
const sidebarCreateListButton = document.querySelector('#sidebar-create-list');
const todoView = document.querySelector('.todo-view');
const noListState = document.querySelector('#no-list-state');


let selectedListId = null;
let lists = [];
let todos = [];
let guestLists = new Set();
let guestTodos = new Set();
let filter = 'all';

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

function renderSidebarLists() {
  sidebarLists.replaceChildren();

  const currentLists = token ? lists : [...guestLists];

  for (const list of currentLists) {
    const row = document.createElement('div');
    row.className = 'sidebar-list-row';

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'sidebar-list';
    button.setAttribute('aria-pressed', String(list.id === selectedListId));

    if (list.id === selectedListId) {
      button.classList.add('is-selected');
    }

    button.textContent = list.name;

    button.addEventListener('click', () => {
      selectedListId = list.id;

      renderSidebarLists();
      renderTodos();
    });

    const actions = document.createElement('div');
    actions.className = 'sidebar-list-actions';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'sidebar-list-menu-toggle';
    menuButton.textContent = '\u22ee';
    menuButton.setAttribute('aria-label', `Options for ${list.name}`);
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'sidebar-list-menu hidden';
    menu.setAttribute('role', 'menu');

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'sidebar-list-menu-item';
    editButton.textContent = 'Edit';
    editButton.setAttribute('role', 'menuitem');
    editButton.addEventListener('click', () => editList(list));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'sidebar-list-menu-item is-danger';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('role', 'menuitem');
    deleteButton.addEventListener('click', () => deleteList(list));

    menu.append(editButton, deleteButton);
    menuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !menu.classList.contains('hidden');
      closeSidebarListMenus();
      menu.classList.toggle('hidden', isOpen);
      menuButton.setAttribute('aria-expanded', String(!isOpen));
    });

    actions.append(menuButton, menu);
    row.append(button, actions);
    sidebarLists.append(row);
  }
}

function closeSidebarListMenus() {
  sidebarLists.querySelectorAll('.sidebar-list-menu').forEach((menu) => menu.classList.add('hidden'));
  sidebarLists.querySelectorAll('.sidebar-list-menu-toggle').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}


function renderTodos() {
  const hasSelectedList = Boolean(selectedListId);
  todoView.classList.toggle('hidden', !hasSelectedList);
  noListState.classList.toggle('hidden', hasSelectedList);

  if (!hasSelectedList) {
    todoList.replaceChildren();
    emptyState.classList.add('hidden');
    return;
  }

  const currentTodos = token ? todos : [...guestTodos];

  const selectedTodos = currentTodos.filter(
    (todo) => todo.listId === selectedListId
  );

  const visibleTodos = selectedTodos.filter((todo) => {

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

  const completed = selectedTodos.filter((todo) => todo.isCompleted).length;
  const active = selectedTodos.length - completed;

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
  const name = prompt('Enter list name');

  if (!name || !name.trim()) return;

  const cleanName = name.trim();

  try {
    if (token) {
      const list = (
        await request('/api/lists', {
          method: 'POST',
          body: JSON.stringify({ name: cleanName })
        })
      ).data;

      lists.push(list);

      renderSidebarLists();
      renderTodos();

      setMessage('List created.', true);

      return;
    }

    const exists = [...guestLists].some(
      (list) =>
        list.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      setMessage('A list with this name already exists.');
      return;
    }

    const list = {
      id: crypto.randomUUID(),
      name: cleanName
    };

    guestLists = new Set(guestLists);
    guestLists.add(list);

    renderSidebarLists();
    renderTodos();

    setMessage('List created.', true);

  } catch (error) {
    setMessage(error.message);
  }
}

async function editList(list) {
  const name = prompt('List name', list.name);
  if (name === null) return;

  const cleanName = name.trim();
  if (!cleanName) return;

  try {
    if (token) {
      const updatedList = (await request(`/api/lists/${encodeURIComponent(list.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: cleanName })
      })).data;
      lists = lists.map((item) => item.id === list.id ? updatedList : item);
    } else {
      const exists = [...guestLists].some(
        (item) => item.id !== list.id && item.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (exists) {
        setMessage('A list with this name already exists.');
        return;
      }
      guestLists = new Set([...guestLists].map(
        (item) => item.id === list.id ? { ...item, name: cleanName } : item
      ));
    }

    renderSidebarLists();
    setMessage('List updated.', true);
  } catch (error) {
    setMessage(error.message);
  }
}

async function deleteList(list) {
  if (!confirm(`Delete "${list.name}" and all its tasks?`)) return;

  try {
    if (token) {
      await request(`/api/lists/${encodeURIComponent(list.id)}`, { method: 'DELETE' });
      lists = lists.filter((item) => item.id !== list.id);
      todos = todos.filter((todo) => todo.listId !== list.id);
    } else {
      guestLists = new Set([...guestLists].filter((item) => item.id !== list.id));
      guestTodos = new Set([...guestTodos].filter((todo) => todo.listId !== list.id));
    }

    if (selectedListId === list.id) selectedListId = null;
    renderSidebarLists();
    renderTodos();
    setMessage('List deleted.', true);
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

async function updateTodo(id, updates) {
  try {
    if (token) {
      const updatedTodo = (await request(`/api/todos/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })).data;
      todos = todos.map((todo) => todo.id === id ? updatedTodo : todo);
    } else {
      guestTodos = new Set([...guestTodos].map(
        (todo) => todo.id === id ? { ...todo, ...updates } : todo
      ));
    }

    renderTodos();
    setMessage('Task updated.', true);
  } catch (error) {
    setMessage(error.message);
  }
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
sidebarCreateListButton.addEventListener('click', createList);
document.addEventListener('click', closeSidebarListMenus);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSidebarListMenus();
});
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

if (!selectedListId) {
  setMessage('Please select a list first.');
  return;
}

const todo = {
  title: data.get('title').trim(),
  description: data.get('description').trim() || null,
  dueAt: data.get('dueAt')
    ? new Date(data.get('dueAt')).toISOString()
    : null,
  listId: selectedListId
};

  try {
    if (token) {
      const created = (await request('/api/todos', { method: 'POST', body: JSON.stringify(todo) })).data;
      todos.unshift(created);
      todoForm.reset();
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

    renderTodos();
  } catch (error) {
    setMessage(error.message);
  } finally {
    submit.disabled = false;
  }
});

signInLink.classList.toggle('hidden', Boolean(token));
logoutButton.classList.toggle('hidden', !token);
document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
document.querySelector('#workspace-date').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());
if (token) {
  Promise.all([request('/api/lists'), request('/api/todos')])
    .then(([listResult, todoResult]) => {
      lists = listResult.data;
      todos = todoResult.data;

      renderSidebarLists();
      renderTodos();

    })
    .catch((error) => setMessage(error.message));
} else {

  renderSidebarLists();
  renderTodos();
}

