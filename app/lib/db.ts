import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;

let sql: Sql | null | undefined;

// Memoized postgres.js client over the Supabase transaction pooler
// (Supavisor, port 6543). prepare:false is required in transaction-pool
// mode. Null when DATABASE_URL is unset so routes can 503 not_configured.
export function getDb(): Sql | null {
  if (sql !== undefined) return sql;
  const url = process.env.DATABASE_URL;
  sql = url ? postgres(url, { prepare: false }) : null;
  return sql;
}
