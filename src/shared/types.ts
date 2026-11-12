// Types shared by the Worker (src/worker) and the app (src/app).

export type Role = 'user' | 'assistant'

export interface Conversation {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
}

/** One file in a delivered bundle, as koba_engine's delivery.json lists it. */
export interface DeliveryFile {
  path: string
  bytes: number
  sha256: string
}

/** The delivery.json metadata for a finished job, stored in D1. */
export interface Delivery {
  jobId: string
  model: string
  operation: string
  previewUrl: string | null
  files: DeliveryFile[]
  bytes: number
  sha256: { verified: boolean; checked: number; digest: string | null }
  /** The bundle download, when koba_engine exposes one. */
  downloadUrl: string | null
  /** True for a locally simulated job: no engine was involved. */
  simulated: boolean
  createdAt: number
  meta: Record<string, string | number | boolean>
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string
  model: string | null
  /** True when generation stopped before the model finished. */
  interrupted: boolean
  /** Present on a reply that delivered an asset bundle. */
  delivery: Delivery | null
  createdAt: number
}

export interface ModelInfo {
  id: string
  name: string
  description: string
  domain: string
  operation: string
  /** Whether koba_engine is reachable. */
  available: boolean
}

export interface Me {
  user: { sub: string; name?: string; email?: string; picture?: string }
  capabilities: {
    /** koba_engine is configured (or the local simulator is allowed). */
    engine: boolean
    database: boolean
    auth: 'freebuff' | 'development'
  }
  usage: { used: number; limit: number; resetsAt: number }
}

/** One gate's progress, streamed while a job runs. */
export type StageEvent = {
  type: 'stage'
  gate: 1 | 2 | 3
  /** koba_engine stage id, e.g. generate-monument. */
  stage: string
  label: string
  status: 'running' | 'done' | 'failed'
  /** 0–1 within the gate. */
  progress: number
  detail?: string
}

/** Server-sent events on POST /api/chat. */
export type ChatEvent =
  | { type: 'start'; conversation: Conversation; userMessage: Message; assistantMessageId: string }
  | StageEvent
  | { type: 'delivery'; delivery: Delivery }
  | { type: 'done'; message: Message; usage: Me['usage'] }
  | { type: 'error'; code: string; message: string }
