# Todo App

A full-stack to-do application with a native Node.js HTTP server, Prisma ORM, MySQL, JWT authentication, and a vanilla JavaScript single-page interface.

## Requirements

- Node.js 18 or newer
- npm
- MySQL 8.0 or newer

## 1. Configure MySQL

Create a MySQL database named `todo_db`. For example, connect to your local MySQL server and run:

```sql
CREATE DATABASE todo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Copy `.env.example` to `.env` and set the connection string to match your MySQL username, password, host, port, and database:

```dotenv
DATABASE_URL="mysql://root:password@localhost:3306/todo_db"
JWT_SECRET="replace-this-with-a-long-random-secret"
PORT=5000
```

Change the database credentials and `JWT_SECRET` for your environment. Never use the sample JWT secret in production; use a randomly generated secret and keep `.env` out of version control.

## 2. Install dependencies

From the `todo-app` directory:

```bash
npm install
```

## 3. Create the database tables

Apply the initial Prisma migration:

```bash
npm run prisma:migrate -- --name init
```

This command creates the migration under `prisma/migrations` and generates the Prisma Client. To regenerate the client independently later, run:

```bash
npm run prisma:generate
```

## 4. Start the application

```bash
npm start
```

Open [http://localhost:5000](http://localhost:5000) in your browser. The server serves the SPA and its API from the same origin. Set `PORT` in `.env` to choose a different port.

## API

- `POST /api/auth/register` - create an account with `{ "email", "password" }`
- `POST /api/auth/login` - sign in; returns a JWT and user details
- `GET /api/todos` - list the authenticated user's todos
- `POST /api/todos` - create a todo with `{ "title", "description" }`
- `PUT /api/todos/:id` - update a todo's `title`, `description`, and/or `isCompleted`
- `DELETE /api/todos/:id` - delete a todo

For protected routes, send the login token in the `Authorization` header as `Bearer <token>`. Passwords must be at least 8 characters. All todo operations are scoped to the authenticated owner.

## Notes

- The application uses only Node.js core HTTP, URL, filesystem, and path modules for its server; Prisma, `jsonwebtoken`, `bcryptjs`, and `dotenv` provide database access and auth/configuration.
- Commit files under `prisma/migrations` so schema changes can be reviewed and deployed consistently. Keep `.env` and real credentials private.
