import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Initialize the Postgres client
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });

// Export the Drizzle db instance
export const db = drizzle(client, { schema });