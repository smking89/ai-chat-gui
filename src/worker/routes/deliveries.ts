// GET /api/deliveries/:jobId: the stored delivery.json for one finished job,
// as a download. This is what the Asset Delivery Card's button falls back to
// when koba_engine does not expose its own bundle URL.

import { Hono } from 'hono'

import { mapDelivery } from '../db'
import type { AppContext } from '../env'

export const deliveries = new Hono<AppContext>()

deliveries.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId')
  const row = await c
    .get('db')
    .prepare(`SELECT * FROM deliveries WHERE owner_sub = ? AND job_id = ?`)
    .bind(c.get('user').sub, jobId)
    .first<Record<string, unknown>>()
  if (!row) return c.json({ error: 'Not found.' }, 404)
  const delivery = mapDelivery(row)
  c.header('Cache-Control', 'private, no-store')
  c.header('Content-Disposition', `attachment; filename="delivery-${delivery.jobId.slice(0, 8)}.json"`)
  return c.body(JSON.stringify(delivery, null, 2), 200, { 'content-type': 'application/json; charset=utf-8' })
})
