import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Conversation, Me, Message, ModelInfo } from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public resetsAt?: number,
  ) {
    super(message)
  }
}

export async function readError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed.'
  let code: string | undefined
  let resetsAt: number | undefined
  try {
    const body = (await response.json()) as { error?: string; message?: string; resetsAt?: number }
    message = body.message ?? body.error ?? message
    code = body.error
    resetsAt = body.resetsAt
  } catch {
    /* no body */
  }
  return new ApiError(response.status, message, code, resetsAt)
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (!response.ok) throw await readError(response)
  return (await response.json()) as T
}

export type ConversationPage = { conversation: Conversation; messages: Message[] }

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/me'),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Until an API key is configured, keep checking so the app unlocks on its
    // own once the owner adds one.
    refetchInterval: (query) => (query.state.data && !query.state.data.capabilities.ai ? 4_000 : false),
  })
export const useModels = () => useQuery({ queryKey: ['models'], queryFn: () => api<{ items: ModelInfo[] }>('/models'), staleTime: 60_000 })
export const useConversations = () => useQuery({ queryKey: ['conversations'], queryFn: () => api<{ items: Conversation[] }>('/conversations') })
export const useConversation = (id: string | undefined) =>
  useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api<ConversationPage>(`/conversations/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
    // A missing chat is an answer, not a hiccup.
    retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500),
  })

export function useRenameConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api<{ conversation: Conversation }>(`/conversations/${id}`, { method: 'PATCH', json: { title } }),
    onSuccess: ({ conversation }) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.map((c) => (c.id === conversation.id ? conversation : c)) })
      client.setQueryData<ConversationPage>(['conversation', conversation.id], (old) => old && { ...old, conversation })
    },
  })
}

export function useSetConversationModel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model: string }) => api<{ conversation: Conversation }>(`/conversations/${id}`, { method: 'PATCH', json: { model } }),
    onMutate: ({ id, model }) => {
      client.setQueryData<ConversationPage>(['conversation', id], (old) => old && { ...old, conversation: { ...old.conversation, model } })
    },
  })
}

export function useDeleteConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      client.setQueryData<{ items: Conversation[] }>(['conversations'], (old) => old && { items: old.items.filter((c) => c.id !== id) })
      client.removeQueries({ queryKey: ['conversation', id] })
    },
  })
}

export function useDeleteAllConversations() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api('/account/conversations', { method: 'DELETE' }),
    onSuccess: () => {
      client.setQueryData(['conversations'], { items: [] })
      client.removeQueries({ queryKey: ['conversation'] })
    },
  })
}
