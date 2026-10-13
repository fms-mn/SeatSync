# Supabase database setup

SeatSync uses Supabase as managed PostgreSQL. Prisma remains the ORM, the Express API remains the only application data-access layer, and Socket.IO remains responsible for live seat invalidation. Supabase Auth and Supabase Realtime are intentionally not enabled, so the concurrency-safe booking engine does not need to be redesigned.

## 1. Create the project

Create a Supabase project and save its database password in a password manager. In the project dashboard, open **Connect**; connection hosts and usernames must be copied from this dialog because the pooler hostname cannot be inferred reliably from the region.

## 2. Create a dedicated Prisma role

In **SQL Editor**, replace the example password below with a generated password and run:

```sql
create user "prisma" with password 'REPLACE_WITH_A_GENERATED_PASSWORD' bypassrls createdb;
grant "prisma" to "postgres";

grant usage, create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;

alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

This follows Supabase's Prisma guidance. `BYPASSRLS` is required because SeatSync's trusted API owns authorization while anonymous Data API access is denied.

## 3. Configure connection strings

Copy `.env.example` to `.env`, then fill in both values:

```dotenv
# Runtime: Connect > Session pooler, port 5432
DATABASE_URL="postgresql://prisma.PROJECT_REF:PASSWORD@EXACT_POOLER_HOST:5432/postgres?sslmode=require&connection_limit=5&connect_timeout=30"

# Migrations: Connect > Direct connection, port 5432
DIRECT_URL="postgresql://prisma:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require&connect_timeout=30"
```

Important details:

- Percent-encode reserved characters in the password (`@`, `#`, `?`, `/`, spaces, and similar characters).
- The Session Pooler username is `prisma.PROJECT_REF`; the direct username is `prisma`.
- The direct endpoint normally requires IPv6. If the deployment machine is IPv4-only, use the Session Pooler URI for `DIRECT_URL` too, or enable Supabase's IPv4 add-on.
- Never expose either URL through a `VITE_` variable or commit the real `.env` file.
- For a serverless API, use the Transaction Pooler on port 6543 and append `pgbouncer=true&connection_limit=1`; keep `DIRECT_URL` on a direct or Session Pooler connection for migrations.

## 4. Create and verify the schema

From the repository root:

```powershell
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:seed
npm.cmd run db:check
```

`db:deploy` applies the committed schema and the Supabase security migration. The latter enables RLS without public policies on every SeatSync table, preventing the Supabase anonymous and authenticated API roles from reading or changing booking data. `db:check` verifies connectivity, an explicit client SSL policy, a serializable transaction, and `SELECT … FOR UPDATE` support. The reported database-session SSL value can be false behind Supavisor because it describes the pooler's internal database connection rather than the client-to-pooler connection.

You can inspect records under **Table Editor** in the Supabase dashboard. The browser application must continue to access data through the Express API, not through a Supabase anon key.

## 5. Moving existing records (optional)

No transfer is needed for a new or unseeded SeatSync database. If an existing PostgreSQL database contains records:

```powershell
pg_dump "OLD_DATABASE_URL" --data-only --inserts --no-owner --no-privileges --file seatsync-data.sql
psql "DIRECT_URL" --file seatsync-data.sql
```

Apply migrations before importing data. Keep the dump outside Git, verify row counts afterward, and securely delete it when the migration is accepted. For a production database, take a backup and schedule a write freeze before the final dump.

## 6. Production environment

Set these secrets on the API host:

- `DATABASE_URL`
- `DIRECT_URL` (only required in a migration/release job)
- `JWT_SECRET`
- `CLIENT_URL`
- `PORT`

Set only `VITE_API_URL` on the frontend host. The API host must support persistent WebSocket connections for Socket.IO.

## Troubleshooting

- **Tenant or user not found:** copy the exact pooler host and ensure the username is `prisma.PROJECT_REF`.
- **Can't reach database:** the direct endpoint is IPv6 by default; try the Session Pooler on port 5432.
- **Prepared statement error:** a Transaction Pooler URL requires `pgbouncer=true`; Session mode does not.
- **Authentication failed:** percent-encode the database password or reset the dedicated Prisma password.
- **RLS blocks Prisma:** confirm the API is connecting as the `prisma` role created with `BYPASSRLS`.
