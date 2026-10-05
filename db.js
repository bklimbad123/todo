const { PrismaClient } = require('@prisma/client');

const prisma = globalThis.todoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.todoPrisma = prisma;
}

module.exports = prisma;
