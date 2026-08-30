import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
}

// Global cache for postgres client to prevent connection exhaustion during Next.js HMR
const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

export const client = globalForDb.conn ?? postgres(connectionString, {
    prepare: false,
    max: 2, // Keep connection count minimal per server worker
    idle_timeout: 10,
    connect_timeout: 15,
});

if (process.env.NODE_ENV !== 'production') {
    globalForDb.conn = client;
}

// Export the Drizzle db instance
export const db = drizzle(client, { schema });