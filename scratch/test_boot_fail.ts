import app from '../bootstrap/app.ts';
process.env.DB_PORT = '29999';
await app.start();
