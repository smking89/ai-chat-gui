// POST /api/chat: one generation job in, a streamed Gate 1–3 progress run out.
// The reply is a server-sent event stream of ChatEvent JSON (shared/types.ts).
// The browser never talks to koba_engine; this route does, with the Worker's
// credentials, and it stores the resulting delivery.json in D1.

import { Hono } from 'hono'
import { streamSSE, type SSEStreamingApi } from 'hono/streaming'

import { DAILY_MESSAGE_LIMIT, DEFAULT_MODEL, isModelId, MAX_MESSAGE_CHARS, modelById, normalizeParams, paramLabel, type JobParams, type ModelId } from '../../shared/config'
import type { ChatEvent, Delivery, Message } from '../../shared/types'
import { isLoopback } from '../auth'
import { id, mapConversation, mapMessage, now, repliesToday, titleFrom, utcDay } from '../db'
import type { AppContext } from '../env'
import { engineMode, KobaError, runJob } from '../koba'

export const chat = new Hono<AppContext>()

type Input = { conversationId?: unknown; content?: unknown; model?: unknown; params?: unknown; regenerate?: unknown }

// Jobs in flight per user in this isolate (start times, so a slot that was
// never released still expires). A cheap brake on a tab that fires requests
// in parallel; the daily limit and koba_engine's own quotas are the real
// ceilings.
const inflight = new Map<string, number[]>()
const MAX_INFLIGHT = 2
const INFLIGHT_TTL = 30 * 60_000
const inflightCount = (owner: string) => {
  const live = (inflight.get(owner) ?? []).filter((at) => Date.now() - at < INFLIGHT_TTL)
  if (live.length) inflight.set(owner, live)
  else inflight.delete(owner)
  return live.length
}

// A write that does not complete in this long means the reader is gone:
// runtimes do not all report a closed connection, and a blocked write would
// otherwise hold the upstream job open.
const WRITE_TIMEOUT = 10_000

/** The reply's text: a short record of the job that the card elaborates on. */
function summaryOf(model: ModelId, params: JobParams, delivery: Delivery, prompt: string): string {
  const def = modelById(model)
  const lines = [`**${def.name}** delivered ${def.domain.toLowerCase()} for: "${prompt.trim().slice(0, 140)}"`, '']
  for (const spec of def.params) lines.push(`- ${spec.label}: ${paramLabel(model, spec.key, params[spec.key] ?? '')}`)
  lines.push(`- Files: ${delivery.files.length} · ${formatBytes(delivery.bytes)}`)
  lines.push(`- SHA-256: ${delivery.sha256.verified ? `verified (${delivery.sha256.checked}/${delivery.files.length})` : 'not verified'}`)
  if (delivery.simulated) lines.push('', '_Simulated locally: built by the local preview, not the build service._')
  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`
}

chat.post('/', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const loopback = isLoopback(c.req.raw)
  if (engineMode(c.env, loopback) === 'off') {
    return c.json({ error: 'not_configured', message: 'Builds are not available yet.' }, 503)
  }

  const input = await c.req.json<Input>().catch(() => ({}) as Input)
  const regenerate = input.regenerate === true
  const content = typeof input.content === 'string' ? input.content.replace(/\r\n?/g, '\n').trim() : ''
  if (!regenerate && !content) return c.json({ error: 'empty', message: 'Describe the asset you want first.' }, 400)
  if (content.length > MAX_MESSAGE_CHARS) return c.json({ error: 'too_long', message: `Briefs can be up to ${MAX_MESSAGE_CHARS.toLocaleString()} characters.` }, 400)
  if (input.model !== undefined && !isModelId(input.model)) return c.json({ error: 'model', message: 'Unknown model.' }, 400)
  if (input.conversationId !== undefined && typeof input.conversationId !== 'string') return c.json({ error: 'conversation', message: 'Invalid conversation.' }, 400)

  if (inflightCount(owner) >= MAX_INFLIGHT) return c.json({ error: 'busy', message: 'Wait for the current job to finish.' }, 429)
  const used = await repliesToday(db, owner)
  if (used >= DAILY_MESSAGE_LIMIT) {
    return c.json({ error: 'limit', message: `You have reached today's limit of ${DAILY_MESSAGE_LIMIT} jobs.`, resetsAt: utcDay().end }, 429)
  }

  // The conversation: existing, or created from this first brief.
  const t = now()
  let conversationRow = input.conversationId
    ? await db.prepare(`SELECT * FROM conversations WHERE owner_sub = ? AND id = ?`).bind(owner, input.conversationId).first<Record<string, unknown>>()
    : null
  if (input.conversationId && !conversationRow) return c.json({ error: 'not_found', message: 'This job no longer exists.' }, 404)
  if (regenerate && !conversationRow) return c.json({ error: 'conversation', message: 'Nothing to regenerate.' }, 400)

  const requested: ModelId | null = isModelId(input.model) ? input.model : null
  const saved: ModelId | null = isModelId(conversationRow?.model) ? conversationRow.model : null
  const model: ModelId = requested ?? saved ?? DEFAULT_MODEL
  // The parameter bar's values, validated against the model's spec: unknown
  // keys and out-of-range values are refused, never forwarded.
  const checked = normalizeParams(model, input.params)
  if (!checked) return c.json({ error: 'params', message: 'Those generation parameters are not valid for this model.' }, 400)
  const params: JobParams = checked

  const statements: D1PreparedStatement[] = []
  if (!conversationRow) {
    conversationRow = { id: id(), owner_sub: owner, title: titleFrom(content), model, created_at: t, updated_at: t }
    statements.push(
      db.prepare(`INSERT INTO conversations (id, owner_sub, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(conversationRow.id, owner, conversationRow.title, model, t, t),
    )
  } else {
    conversationRow.model = model
    conversationRow.updated_at = t
    statements.push(db.prepare(`UPDATE conversations SET model = ?, updated_at = ? WHERE owner_sub = ? AND id = ?`).bind(model, t, owner, conversationRow.id))
  }
  const conversation = mapConversation(conversationRow)

  let userMessage: Message
  if (regenerate) {
    // Drop everything after the last brief and build it again.
    const lastUser = await db
      .prepare(`SELECT * FROM messages WHERE owner_sub = ? AND conversation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1`)
      .bind(owner, conversation.id)
      .first<Record<string, unknown>>()
    if (!lastUser) return c.json({ error: 'conversation', message: 'Nothing to regenerate.' }, 400)
    userMessage = mapMessage(lastUser)
    statements.push(
      db.prepare(`DELETE FROM messages WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?`).bind(owner, conversation.id, userMessage.createdAt),
      db.prepare(`DELETE FROM deliveries WHERE owner_sub = ? AND conversation_id = ? AND created_at > ?`).bind(owner, conversation.id, userMessage.createdAt),
    )
  } else {
    userMessage = { id: id(), conversationId: conversation.id, role: 'user', content, model: null, interrupted: false, delivery: null, createdAt: t }
    statements.push(
      db.prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'user', ?, NULL, ?)`).bind(userMessage.id, owner, conversation.id, content, t),
    )
  }

  // The reply's row exists from the start (empty), so it counts toward today's
  // limit while running and the app knows its id before the first gate.
  const assistantMessageId = id()
  const jobId = id()
  const replyAt = t + 1
  statements.push(
    db.prepare(`INSERT INTO messages (id, owner_sub, conversation_id, role, content, model, created_at) VALUES (?, ?, ?, 'assistant', '', ?, ?)`).bind(assistantMessageId, owner, conversation.id, model, replyAt),
  )
  await db.batch(statements)

  const prompt = userMessage.content
  const startedAt = Date.now()
  inflight.set(owner, [...(inflight.get(owner) ?? []), startedAt])
  const release = () => {
    const rest = (inflight.get(owner) ?? []).filter((at) => at !== startedAt)
    if (rest.length) inflight.set(owner, rest)
    else inflight.delete(owner)
  }

  c.header('Cache-Control', 'private, no-store')
  return streamSSE(c, async (stream) => {
    // The whole job runs under waitUntil: when the reader goes away the
    // runtime drops the request's other work, and this is what aborts the
    // upstream job and records what happened. Registered before the first byte.
    const work = generate(stream)
    c.executionCtx.waitUntil(work)
    await work
  })

  async function generate(stream: SSEStreamingApi) {
    const controller = new AbortController()
    let delivery: Delivery | null = null
    let gone = false
    // Resolves false once the reader has stopped taking data: the runtime
    // cancelled the stream, or a write sat unanswered for WRITE_TIMEOUT.
    const send = (event: ChatEvent) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      return Promise.race([
        stream.writeSSE({ data: JSON.stringify(event) }).then(() => !stream.aborted),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), WRITE_TIMEOUT)
        }),
      ]).finally(() => clearTimeout(timer))
    }
    const discard = () => db.prepare(`DELETE FROM messages WHERE owner_sub = ? AND id = ?`).bind(owner, assistantMessageId).run()
    // The user stopped or left: stop the engine job and drop the placeholder.
    const abandon = async () => {
      if (gone) return
      gone = true
      controller.abort()
      await discard()
    }
    stream.onAbort(() => void abandon())

    try {
      if (!(await send({ type: 'start', conversation, userMessage, assistantMessageId }))) return await abandon()
      for await (const update of runJob(c.env, { model, params, prompt, jobId, signal: controller.signal, loopback })) {
        if (gone) return
        if (update.type === 'stage') {
          if (!(await send(update))) return await abandon()
        } else {
          delivery = update.delivery
        }
      }
      if (gone) return
      if (!delivery) throw new KobaError('incomplete', 'The build finished without a delivery bundle.')

      const content = summaryOf(model, params, delivery, prompt)
      await db.batch([
        db
          .prepare(`UPDATE messages SET content = ?, interrupted = 0 WHERE owner_sub = ? AND id = ?`)
          .bind(content, owner, assistantMessageId),
        db
          .prepare(`INSERT OR REPLACE INTO deliveries (job_id, owner_sub, conversation_id, message_id, model, operation, manifest, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(delivery.jobId, owner, conversation.id, assistantMessageId, model, delivery.operation, JSON.stringify(delivery), now()),
        db.prepare(`UPDATE conversations SET updated_at = ? WHERE owner_sub = ? AND id = ?`).bind(now(), owner, conversation.id),
      ])

      const message: Message = {
        id: assistantMessageId,
        conversationId: conversation.id,
        role: 'assistant',
        content,
        model,
        interrupted: false,
        delivery,
        createdAt: replyAt,
      }
      // The card first, so it paints the moment the bundle is ready, then the
      // saved message that folds the turn into the thread.
      await send({ type: 'delivery', delivery })
      await send({ type: 'done', message, usage: { used: used + 1, limit: DAILY_MESSAGE_LIMIT, resetsAt: utcDay().end } })
    } catch (error) {
      if (gone) return
      const failure = error instanceof KobaError ? error : new KobaError('unavailable', 'Something went wrong. Try again.', 502)
      if (!(error instanceof KobaError)) console.error(error)
      await discard()
      await send({ type: 'error', code: failure.code, message: failure.message })
    } finally {
      release()
    }
  }
})
