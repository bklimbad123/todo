const { PrismaClient } = require('@prisma/client');

const prisma = globalThis.__todoPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__todoPrisma = prisma;
}

module.exports = prisma;
