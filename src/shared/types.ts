// Types shared by the Worker (src/worker) and the app (src/app).

export type Role = 'user' | 'assistant'

export interface Conversation {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: Role
  content: string
  model: string | null
  /** True when generation stopped before the model finished. */
  interrupted: boolean
  createdAt: number
}

export interface ModelInfo {
  id: string
  name: string
  description: string
  /** Whether the Freebuff API currently offers this model. */
  available: boolean
}

export interface Me {
  user: { sub: string; name?: string; email?: string; picture?: string }
  capabilities: {
    /** An API key is configured on the server. Never the key itself. */
    ai: boolean
    database: boolean
    auth: 'freebuff' | 'development'
  }
  usage: { used: number; limit: number; resetsAt: number }
}

/** Server-sent events on POST /api/chat. */
export type ChatEvent =
  | { type: 'start'; conversation: Conversation; userMessage: Message; assistantMessageId: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; message: Message; usage: Me['usage'] }
  | { type: 'error'; code: string; message: string }
