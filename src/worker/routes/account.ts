import { Hono } from 'hono'

import { DAILY_MESSAGE_LIMIT, MODELS } from '../../shared/config'
import type { Me, ModelInfo } from '../../shared/types'
import { authMode, isLoopback, privateJson } from '../auth'
import { now, repliesToday, utcDay } from '../db'
import type { AppContext } from '../env'
import { engineMode } from '../koba'

export const account = new Hono<AppContext>()

account.get('/me', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const mode = authMode(c.env, c.req.raw)
  const known = await db.prepare(`SELECT 1 FROM users WHERE owner_sub = ?`).bind(user.sub).first()
  // New accounts start empty: no sample conversations, no sample deliveries.
  if (!known) await db.prepare(`INSERT INTO users (owner_sub, created_at) VALUES (?, ?)`).bind(user.sub, now()).run()
  const body: Me = {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    capabilities: {
      engine: engineMode(c.env, isLoopback(c.req.raw)) !== 'off',
      database: true,
      auth: mode === 'freebuff' ? 'freebuff' : 'development',
    },
    usage: { used: await repliesToday(db, user.sub), limit: DAILY_MESSAGE_LIMIT, resetsAt: utcDay().end },
  }
  return privateJson(c, body)
})

account.get('/models', async (c) => {
  const available = engineMode(c.env, isLoopback(c.req.raw)) !== 'off'
  const items: ModelInfo[] = MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description,
    domain: model.domain,
    operation: model.operation,
    available,
  }))
  c.header('Cache-Control', 'private, max-age=60')
  return c.json({ items })
})

account.delete('/account/conversations', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  await db.batch([
    db.prepare(`DELETE FROM deliveries WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM messages WHERE owner_sub = ?`).bind(owner),
    db.prepare(`DELETE FROM conversations WHERE owner_sub = ?`).bind(owner),
  ])
  return privateJson(c, { ok: true })
})
