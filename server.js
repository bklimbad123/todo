require('dotenv').config();

const http = require('node:http');
const { URL } = require('node:url');
const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./db');
const parseBody = require('./parseBody');

const PORT = Number.parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SALT_ROUNDS = 10;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in the environment');
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new HttpError(400, `${field} must be at most ${maxLength} characters`);
  }
  return normalized;
}

function parseDueDate(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Due date must be valid');
  }
  return date;
}

function validateCredentials(body, includeProfile = false) {
  const firstName = includeProfile ? requireString(body?.firstName, 'First name', 100) : '';
  const lastName = includeProfile ? requireString(body?.lastName, 'Last name', 100) : '';
  const gender = includeProfile ? requireString(body?.gender, 'Gender', 30) : '';
  const email = requireString(body?.email, 'Email', 254).toLowerCase();
  const password = body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new HttpError(400, 'Password must be between 8 and 72 characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return { firstName, lastName, gender, email, password };
}

function authenticate(req) {
  const authorization = req.headers.authorization;
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, 'Authentication required');
  }

  try {
    const decoded = jwt.verify(match[1], JWT_SECRET);
    if (!decoded || typeof decoded !== 'object' || typeof decoded.userId !== 'string' || typeof decoded.email !== 'string') {
      throw new Error('Invalid token payload');
    }
    req.user = { userId: decoded.userId, email: decoded.email };
    return req.user;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}

async function serveStatic(res, fileName, contentType) {
  try {
    const content = await fs.readFile(path.join(PUBLIC_DIR, fileName));
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new HttpError(404, 'Route Not Found');
    }
    throw error;
  }
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (req.method === 'GET' && pathname === '/') {
    await serveStatic(res, 'index.html', 'text/html; charset=utf-8');
    return;
  }
  if (req.method === 'GET' && pathname === '/styles.css') {
    await serveStatic(res, 'styles.css', 'text/css; charset=utf-8');
    return;
  }
  if (req.method === 'GET' && pathname === '/app.js') {
    await serveStatic(res, 'app.js', 'application/javascript; charset=utf-8');
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const { firstName, lastName, gender, email, password } = validateCredentials(await parseBody(req), true);
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      throw new HttpError(409, 'An account with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    try {
      await prisma.user.create({ data: { firstName, lastName, gender, email, password: hashedPassword } });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new HttpError(409, 'An account with this email already exists');
      }
      throw error;
    }
    sendJson(res, 201, { success: true, message: 'User registered' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { email, password } = validateCredentials(await parseBody(req));
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    sendJson(res, 200, { success: true, token, user: { id: user.id, email: user.email } });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/todos') {
    const user = authenticate(req);
    const todos = await prisma.todo.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' }
    });
    sendJson(res, 200, { success: true, data: todos });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/todos') {
    const user = authenticate(req);
    const body = await parseBody(req);
    const title = requireString(body?.title, 'Title', 255);
    const description = body?.description == null ? null : requireString(body.description, 'Description', 10000);
    const dueAt = parseDueDate(body?.dueAt);
    const todo = await prisma.todo.create({
      data: { title, description, dueAt, userId: user.userId }
    });
    sendJson(res, 201, { success: true, data: todo });
    return;
  }

  const todoMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
  if (todoMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const user = authenticate(req);
    const id = todoMatch[1];
    const existingTodo = await prisma.todo.findFirst({ where: { id, userId: user.userId } });
    if (!existingTodo) {
      throw new HttpError(404, 'Todo not found');
    }

    if (req.method === 'PUT') {
      const body = await parseBody(req);
      const data = {};
      if (Object.hasOwn(body ?? {}, 'title')) {
        data.title = requireString(body.title, 'Title', 255);
      }
      if (Object.hasOwn(body ?? {}, 'description')) {
        data.description = body.description == null ? null : requireString(body.description, 'Description', 10000);
      }
      if (Object.hasOwn(body ?? {}, 'dueAt')) {
        data.dueAt = parseDueDate(body.dueAt);
      }
      if (Object.hasOwn(body ?? {}, 'isCompleted')) {
        if (typeof body.isCompleted !== 'boolean') {
          throw new HttpError(400, 'isCompleted must be a boolean');
        }
        data.isCompleted = body.isCompleted;
      }
      if (Object.keys(data).length === 0) {
        throw new HttpError(400, 'Provide at least one todo field to update');
      }
      const updatedTodo = await prisma.todo.update({ where: { id }, data });
      sendJson(res, 200, { success: true, data: updatedTodo });
      return;
    }

    await prisma.todo.delete({ where: { id } });
    sendJson(res, 200, { success: true, message: 'Deleted' });
    return;
  }

  throw new HttpError(404, 'Route Not Found');
}

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    if (error instanceof HttpError || Number.isInteger(error.statusCode)) {
      sendJson(res, error.statusCode, { success: false, message: error.message });
      return;
    }
    console.error(error);
    sendJson(res, 500, { success: false, error: error.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`Todo app server listening on http://localhost:${PORT}`);
});

function shutDown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once('SIGINT', shutDown);
process.once('SIGTERM', shutDown);
