// The koba_engine client. Every Aiden model is one operation on the engine
// (asset.build_monument / asset.build_skin / asset.build_map); the Worker posts
// the job here and relays its Gate 1–3 progress to the browser, so the engine
// key never leaves the server.
//
// Contract (the engine side; KOBA_ENGINE_URL is its origin):
//
//   POST {origin}/v1/jobs
//     { job_id, operation, model, params, prompt }
//     -> text/event-stream, one JSON object per event:
//        { "gate": 1, "stage": "generate-monument", "status": "running",
//          "progress": 0.4, "detail": "9,412 prefab entities" }
//        { "gate": 3, "stage": "deliver", "status": "done",
//          "delivery": { ...delivery.json } }
//     -> or a plain JSON body { delivery: {...} } once the job is finished.
//     -> errors: { "error": { "code": "seed_invalid", "message": "…" } }
//
// delivery.json carries the preview, the file manifest with per-file SHA-256,
// the verified digest and the bundle download URL. See normalizeDelivery.

import { KOBA_ENGINE_PATH, modelById, paramLabel, type JobParams, type ModelId } from '../shared/config'
import type { Delivery, DeliveryFile, StageEvent } from '../shared/types'
import type { Env } from './env'

export type JobUpdate = StageEvent | { type: 'delivery'; delivery: Delivery }

export class KobaError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 502,
  ) {
    super(message)
  }
}

export type EngineMode = 'engine' | 'simulate' | 'off'

/**
 * 'engine' when a URL is configured. Otherwise local loopback development gets
 * the simulator so the UI is usable before the engine is wired up; a deployed
 * origin without an engine is 'off' and the app shows its setup card.
 */
export function engineMode(env: Env, loopback: boolean): EngineMode {
  if (env.KOBA_ENGINE_URL) return 'engine'
  if (env.KOBA_ENGINE_SIMULATE === '0') return 'off'
  if (env.KOBA_ENGINE_SIMULATE === '1') return 'simulate'
  return loopback ? 'simulate' : 'off'
}

const engineBase = (env: Env) => (env.KOBA_ENGINE_URL ?? '').replace(/\/+$/, '')

const GATE = (value: unknown): 1 | 2 | 3 => (value === 2 || value === '2' ? 2 : value === 3 || value === '3' ? 3 : 1)
const STATUS = (value: unknown): StageEvent['status'] => (value === 'done' ? 'done' : value === 'failed' ? 'failed' : 'running')
const clamp01 = (value: unknown) => (Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : 0)

export async function* runJob(
  env: Env,
  input: { model: ModelId; params: JobParams; prompt: string; jobId: string; signal: AbortSignal; loopback: boolean },
): AsyncGenerator<JobUpdate> {
  const mode = engineMode(env, input.loopback)
  if (mode === 'off') throw new KobaError('not_configured', 'Builds are not available yet.', 503)
  if (mode === 'simulate') {
    yield* simulate(input)
    return
  }
  yield* runEngine(env, input)
}

async function* runEngine(
  env: Env,
  input: { model: ModelId; params: JobParams; prompt: string; jobId: string; signal: AbortSignal },
): AsyncGenerator<JobUpdate> {
  const base = engineBase(env)
  const def = modelById(input.model)
  const timeout = AbortSignal.timeout(15 * 60_000)
  const signal = AbortSignal.any([input.signal, timeout])

  let response: Response
  try {
    response = await fetch(`${base}${KOBA_ENGINE_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream, application/json',
        ...(env.KOBA_ENGINE_API_KEY ? { authorization: `Bearer ${env.KOBA_ENGINE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        job_id: input.jobId,
        operation: def.operation,
        model: def.id,
        params: input.params,
        prompt: input.prompt,
      }),
      signal,
    })
  } catch {
    if (input.signal.aborted) return
    if (timeout.aborted) throw new KobaError('timeout', 'The build took too long to finish.', 504)
    throw new KobaError('network', 'Could not reach the build service.', 503)
  }
  if (!response.ok) throw await engineFailure(response)

  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/event-stream') && response.body) {
    yield* readJobStream(response, { base, model: input.model, jobId: input.jobId, signal: input.signal })
    return
  }

  const body = (await response.json().catch(() => null)) as unknown
  if (!body) throw new KobaError('malformed', 'The build service returned an unreadable response.')
  const error = (body as { error?: { code?: string; message?: string } }).error
  if (error) throw new KobaError(error.code ?? 'engine_error', error.message ?? 'The build service refused this job.')
  yield { type: 'delivery', delivery: normalizeDelivery(body, { base, model: input.model, jobId: input.jobId }) }
}

/** Reads koba_engine's SSE body, relaying gates and the final delivery. */
async function* readJobStream(
  response: Response,
  ctx: { base: string; model: ModelId; jobId: string; signal: AbortSignal },
): AsyncGenerator<JobUpdate> {
  if (!response.body) throw new KobaError('malformed', 'The build service returned no stream.')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let delivered = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        buffer = buffer.slice(0, end + 2)
        const data = buffer
          .slice(0, end)
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n')
          .trim()
        buffer = buffer.slice(end + 2)
        if (!data || data === '[DONE]') continue
        let event: Record<string, unknown>
        try {
          event = JSON.parse(data) as Record<string, unknown>
        } catch {
          throw new KobaError('malformed', 'The build service sent progress that could not be read.')
        }
        const error = event.error as { code?: string; message?: string } | undefined
        if (error) throw new KobaError(error.code ?? 'engine_error', error.message ?? 'The build service stopped this job.')
        if (event.delivery || event.manifest || (event.status === 'delivered' && event.files)) {
          delivered = true
          yield { type: 'delivery', delivery: normalizeDelivery(event, ctx) }
          continue
        }
        const def = modelById(ctx.model)
        const gate = GATE(event.gate)
        yield {
          type: 'stage',
          gate,
          stage: typeof event.stage === 'string' ? event.stage : def.stages[gate - 1]!,
          label: def.gates[gate - 1]!,
          status: STATUS(event.status),
          progress: clamp01(event.progress),
          ...(typeof event.detail === 'string' ? { detail: event.detail.slice(0, 200) } : {}),
        }
      }
    }
  } catch (error) {
    if (error instanceof KobaError) throw error
    // The reader went away: the caller keeps whatever it already has.
    if (ctx.signal.aborted) return
    throw new KobaError('interrupted', 'The connection to the build service dropped.', 502)
  } finally {
    reader.releaseLock()
  }
  if (!delivered) throw new KobaError('incomplete', 'The build finished without a delivery bundle.')
}

async function engineFailure(response: Response): Promise<KobaError> {
  let code = ''
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } }
    code = body.error?.code ?? ''
    detail = (body.error?.message ?? '').slice(0, 160)
  } catch {
    /* not JSON */
  }
  if (response.status === 401 || response.status === 403) return new KobaError('engine_key', 'The build service refused this server’s credentials.', 503)
  if (response.status === 402) return new KobaError('engine_credits', 'The build service account is out of credits.', 503)
  if (response.status === 429) return new KobaError('busy', 'The build service is at capacity. Try again in a moment.', 429)
  if (response.status === 400) return new KobaError(code || 'refused', detail ? `The build service refused the job: ${detail}` : 'The build service refused the job.', 400)
  if (response.status === 404) return new KobaError('unknown_operation', 'The build service does not offer this operation.', 503)
  return new KobaError('unavailable', 'The build service is unavailable right now. Try again shortly.', 503)
}

/** Shapes delivery.json (wherever the engine nests it) into our Delivery. */
export function normalizeDelivery(raw: unknown, ctx: { base: string; model: ModelId; jobId: string }): Delivery {
  const root = (raw ?? {}) as Record<string, unknown>
  const body = ((root.delivery ?? root.manifest ?? root.delivery_json ?? root) ?? {}) as Record<string, unknown>
  const def = modelById(ctx.model)

  const list = (Array.isArray(body.files) ? body.files : Array.isArray(root.files) ? root.files : []) as unknown[]
  const files: DeliveryFile[] = list.map((entry) => {
    const file = (entry ?? {}) as Record<string, unknown>
    const path = String(file.path ?? file.name ?? 'file')
    return {
      path,
      bytes: Number(file.bytes ?? file.size ?? 0) || 0,
      sha256: String(file.sha256 ?? file.hash ?? '').toLowerCase(),
    }
  })

  const shaRaw = body.sha256 ?? root.sha256 ?? body.verification ?? root.verification
  let verified = false
  let checked = 0
  let digest: string | null = null
  if (shaRaw && typeof shaRaw === 'object') {
    const sha = shaRaw as Record<string, unknown>
    verified = sha.verified === true || sha.status === 'verified' || sha.ok === true
    checked = Number(sha.checked ?? sha.files ?? files.length) || 0
    digest = typeof sha.digest === 'string' ? sha.digest : typeof sha.root === 'string' ? sha.root : null
  } else if (shaRaw === true) {
    verified = true
    checked = files.length
  }
  if (!checked) checked = files.length

  const preview = body.preview ?? root.preview
  const previewUrl =
    typeof preview === 'string'
      ? resolveUrl(preview, ctx.base)
      : (() => {
          const p = (preview ?? {}) as Record<string, unknown>
          const value = p.url ?? p.href ?? body.preview_url ?? body.previewUrl ?? root.preview_url
          return typeof value === 'string' ? resolveUrl(value, ctx.base) : null
        })()

  const download = body.download ?? root.download
  const downloadUrl =
    typeof download === 'string'
      ? resolveUrl(download, ctx.base)
      : (() => {
          const d = (download ?? {}) as Record<string, unknown>
          const value = d.url ?? d.href ?? body.download_url ?? body.downloadUrl ?? root.download_url
          return typeof value === 'string' ? resolveUrl(value, ctx.base) : null
        })()

  const meta: Delivery['meta'] = {}
  const rawMeta = (body.meta ?? root.meta) as Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(rawMeta ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') meta[key] = value
  }

  return {
    jobId: typeof body.job_id === 'string' ? body.job_id : typeof body.jobId === 'string' ? body.jobId : ctx.jobId,
    model: def.id,
    operation: typeof body.operation === 'string' ? body.operation : def.operation,
    previewUrl,
    files,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    sha256: { verified, checked, digest },
    downloadUrl,
    simulated: root.simulated === true,
    createdAt: Date.now(),
    meta,
  }
}

function resolveUrl(value: string, base: string): string {
  if (/^(https?:|data:)/i.test(value)) return value
  if (!base) return value
  try {
    return new URL(value, `${base}/`).toString()
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// The local simulator: used only on a loopback origin with no engine URL (or
// when KOBA_ENGINE_SIMULATE=1). It emits the same events as the engine and a
// delivery.json with real SHA-256 digests, so the thread, the progress rail and
// the delivery card can all be exercised before the engine is connected.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function* simulate(input: { model: ModelId; params: JobParams; jobId: string; signal: AbortSignal }): AsyncGenerator<JobUpdate> {
  const def = modelById(input.model)
  const detail: Record<ModelId, [string, string, string]> = {
    graft: ['Sculpting prefab and sockets', 'Wiring verified against Vanilla ruleset', 'Bundling .prefab and Oxide plugin'],
    vest: ['Painting albedo from the palette', 'Baking smoothness, normal and UV masks', 'Packing PBR set and manifest'],
    terra: ['Raising terrain, biomes and rivers', 'Verifying monument placement', 'Writing the server-ready .map'],
  }
  for (let index = 0; index < 3; index += 1) {
    const gate = (index + 1) as 1 | 2 | 3
    const base: StageEvent = { type: 'stage', gate, stage: def.stages[index]!, label: def.gates[index]!, status: 'running', progress: 0.05, detail: detail[input.model][index]! }
    yield base
    for (const progress of [0.35, 0.7]) {
      await sleep(260)
      if (input.signal.aborted) return
      yield { ...base, progress }
    }
    await sleep(260)
    if (input.signal.aborted) return
    yield { ...base, status: 'done', progress: 1 }
  }
  await sleep(160)
  if (input.signal.aborted) return
  yield { type: 'delivery', delivery: await simulatedDelivery(input) }
}

async function simulatedDelivery(input: { model: ModelId; params: JobParams; jobId: string }): Promise<Delivery> {
  const def = modelById(input.model)
  const files: DeliveryFile[] = []
  for (const path of def.deliverables) {
    const bytes = 180_000 + (hashOf(`${input.jobId}:${path}`) % 4_000_000)
    files.push({ path, bytes, sha256: await sha256Hex(`${input.jobId}:${path}`) })
  }
  const digest = await sha256Hex(files.map((file) => `${file.path}:${file.sha256}`).join('\n'))
  const meta: Delivery['meta'] = { engine: 'simulated', build: buildLabel(def.id, input.params) }
  return {
    jobId: input.jobId,
    model: def.id,
    operation: def.operation,
    previewUrl: svgPreview(def.id, input.params, input.jobId),
    files,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    sha256: { verified: true, checked: files.length, digest },
    downloadUrl: null,
    simulated: true,
    createdAt: Date.now(),
    meta,
  }
}

function buildLabel(model: ModelId, params: JobParams): string {
  if (model === 'graft') return 'Custom monument'
  const primary = model === 'vest' ? 'item_template' : 'map_preset'
  return paramLabel(model, primary, params[primary] ?? '')
}

function hashOf(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** A small generated preview, inline as a data URI so nothing is fetched. */
function svgPreview(model: ModelId, params: JobParams, jobId: string): string {
  const palette = Array.isArray(params.palette) ? params.palette : ['#F80801', '#FFFFFF', '#111111']
  const [ink = '#F80801', paper = '#FFFFFF', edge = '#111111'] = palette.map(String)
  const seed = hashOf(jobId)
  const rand = (index: number) => ((seed >> (index % 16)) % 100) / 100
  let art: string
  if (model === 'graft') {
    const blocks = Array.from({ length: 7 }, (_, index) => {
      const x = 40 + Math.round(rand(index) * 240)
      const y = 50 + Math.round(rand(index + 3) * 150)
      const w = 24 + Math.round(rand(index + 5) * 60)
      const h = 20 + Math.round(rand(index + 7) * 46)
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${index % 2 ? ink : edge}" opacity="${index % 2 ? 0.9 : 0.75}" rx="2"/>`
    }).join('')
    const grid = Array.from({ length: 9 }, (_, index) => `<line x1="${index * 40}" y1="0" x2="${index * 40}" y2="260" stroke="#FFFFFF" stroke-opacity="0.08"/>`).join('')
    art = `<rect width="320" height="260" fill="#0B0B0B"/>${grid}${blocks}<text x="20" y="236" fill="${paper}" font-family="monospace" font-size="13" opacity="0.7">TOP-DOWN PREVIEW</text>`
  } else if (model === 'vest') {
    art = `<rect width="320" height="260" fill="#0B0B0B"/>
      <rect x="30" y="46" width="80" height="120" rx="8" fill="${ink}"/>
      <rect x="120" y="46" width="80" height="120" rx="8" fill="${paper}"/>
      <rect x="210" y="46" width="80" height="120" rx="8" fill="${edge}"/>
      <text x="30" y="200" fill="${paper}" font-family="monospace" font-size="13" opacity="0.7">${String(params.resolution ?? '2048')} PX PBR</text>
      <text x="30" y="222" fill="${ink}" font-family="monospace" font-size="12">ALBEDO · SMOOTH · NORMAL · EMISSION</text>`
  } else {
    const contours = Array.from({ length: 6 }, (_, index) => {
      const y = 60 + index * 26 + Math.round(rand(index) * 12)
      return `<path d="M0 ${y} C 70 ${y - 26}, 140 ${y + 22}, 210 ${y - 8} S 300 ${y + 18}, 320 ${y - 4}" fill="none" stroke="${index % 2 ? ink : paper}" stroke-opacity="${index % 2 ? 0.55 : 0.25}" stroke-width="2"/>`
    }).join('')
    art = `<rect width="320" height="260" fill="#0B0B0B"/>${contours}
      <circle cx="${60 + Math.round(rand(2) * 180)}" cy="${80 + Math.round(rand(4) * 100)}" r="7" fill="${ink}"/>
      <circle cx="${60 + Math.round(rand(6) * 180)}" cy="${80 + Math.round(rand(8) * 100)}" r="7" fill="${paper}"/>
      <text x="20" y="236" fill="${paper}" font-family="monospace" font-size="13" opacity="0.7">SEED ${String(params.seed ?? '1337')}</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 260" width="640" height="520" role="img" aria-label="Generated preview">${art}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
