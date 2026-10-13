import './load-env.js';
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  const sslPolicy = databaseUrl.searchParams.get('sslmode');
  const [connection] = await prisma.$queryRaw<Array<{
    database: string;
    role: string;
    version: string;
    ssl: boolean;
  }>>(Prisma.sql`
    SELECT
      current_database() AS database,
      current_user AS role,
      current_setting('server_version') AS version,
      EXISTS (
        SELECT 1 FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl
      ) AS ssl
  `);

  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ShowtimeSeat" LIMIT 1 FOR UPDATE`;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  console.log({
    database: connection.database,
    role: connection.role,
    postgresVersion: connection.version,
    clientSslPolicy: sslPolicy ?? 'not explicitly configured',
    databaseSessionSsl: connection.ssl,
    serializableRowLock: 'ok',
  });

  if (!['require', 'verify-ca', 'verify-full'].includes(sslPolicy ?? '')) {
    throw new Error('DATABASE_URL must include sslmode=require (or a stricter SSL mode).');
  }
}

main()
  .catch((error) => {
    console.error('Database verification failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
