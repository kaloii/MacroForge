import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './db/schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing or empty.');
}

// Create a MySQL connection pool
const poolConnection = mysql.createPool({
  uri: connectionString,
});

// Initialize Drizzle with your schema definitions
export const db = drizzle(poolConnection, { schema, mode: 'default' });