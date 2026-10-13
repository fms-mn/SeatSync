process.env.DATABASE_URL ??= 'postgresql://seatsync:seatsync@localhost:5432/seatsync_test?schema=public';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= 'test-only-secret-with-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL ??= 'http://localhost:5173';
