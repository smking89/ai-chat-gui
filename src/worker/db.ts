import type { MiddlewareHandler } from 'hono'

import type { Conversation, Delivery, Message } from '../shared/types'
import type { AppContext } from './env'

// Schema lives with the Worker: D1 has no migration tool on Freebuff Sites, so
// tables are created on the first request of each isolate. Add new statements
// at the end; never edit existing ones in place once deployed.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    owner_sub TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner_sub, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    interrupted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS messages_conversation ON messages(owner_sub, conversation_id, created_at)`,
  // The daily usage count: replies generated per owner per day.
  `CREATE INDEX IF NOT EXISTS messages_owner_role_created ON messages(owner_sub, role, created_at)`,
  // delivery.json per finished koba_engine job, kept with the reply it belongs
  // to so the Asset Delivery Card can be rebuilt on any load.
  `CREATE TABLE IF NOT EXISTS deliveries (
    job_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT NOT NULL,
    manifest TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS deliveries_conversation ON deliveries(owner_sub, conversation_id)`,
  `CREATE INDEX IF NOT EXISTS deliveries_message ON deliveries(owner_sub, message_id)`,
]

let ready: Promise<void> | undefined

export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(
    () => undefined,
    (error) => {
      ready = undefined
      throw error
    },
  )
  return ready
}

export const requireDb: MiddlewareHandler<AppContext> = async (c, next) => {
  const db = c.env.DB
  if (!db) {
    return c.json({ error: 'database_missing', message: 'No database is attached yet. Add D1 storage named DB and redeploy.' }, 503)
  }
  await ensureSchema(db)
  c.set('db', db)
  await next()
}

export const id = () => crypto.randomUUID()
export const now = () => Date.now()

type Row = Record<string, unknown>

export function mapConversation(r: Row): Conversation {
  return {
    id: r.id as string,
    title: r.title as string,
    model: r.model as string,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }
}

export function mapMessage(r: Row, delivery: Delivery | null = null): Message {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    model: (r.model as string | null) ?? null,
    interrupted: Boolean(r.interrupted),
    delivery,
    createdAt: Number(r.created_at),
  }
}

export function mapDelivery(r: Row): Delivery {
  const parsed = JSON.parse(r.manifest as string) as Delivery
  return { ...parsed, jobId: (r.job_id as string) ?? parsed.jobId }
}

/**
 * delivery.json rows for a conversation, keyed by message id, so replies can
 * carry their bundle without a join per message.
 */
export async function deliveriesByMessage(db: D1Database, owner: string, conversationId: string): Promise<Map<string, Delivery>> {
  const rows = await db
    .prepare(`SELECT * FROM deliveries WHERE owner_sub = ? AND conversation_id = ? ORDER BY created_at ASC`)
    .bind(owner, conversationId)
    .all()
  const map = new Map<string, Delivery>()
  for (const row of rows.results as Row[]) {
    try {
      map.set(row.message_id as string, mapDelivery(row))
    } catch {
      /* a corrupt row should not hide the rest of the thread */
    }
  }
  return map
}

/** Midnight UTC that started the current day, and the next one. */
export function utcDay(at = now()): { start: number; end: number } {
  const start = new Date(at)
  start.setUTCHours(0, 0, 0, 0)
  return { start: start.getTime(), end: start.getTime() + 86_400_000 }
}

/**
 * Jobs generated today, including ones still running and ones the user
 * stopped: each one spent Koba Coin. Regenerating counts; a request koba_engine
 * refused does not.
 */
export async function repliesToday(db: D1Database, owner: string): Promise<number> {
  const { start } = utcDay()
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM messages WHERE owner_sub = ? AND role = 'assistant' AND created_at >= ?`)
    .bind(owner, start)
    .first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/** A conversation title from its first message: the first line, cut at a word. */
export function titleFrom(content: string): string {
  const line = content.trim().split(/\r?\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (line.length <= 48) return line || 'New job'
  const cut = line.slice(0, 48)
  const space = cut.lastIndexOf(' ')
  return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`
}
