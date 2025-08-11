import { Pool } from 'pg'

let pool: Pool | null = null

export const getDb = () => {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } as any })
  return pool
}

export const query = async <T = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> => {
  const db = getDb()
  const res = await db.query(text as any, params as any)
  return { rows: (res as any)?.rows as T[] }
}






