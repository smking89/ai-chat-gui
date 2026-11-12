import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ArrowUpRight, KeyRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { BRAND, DEFAULT_MODEL, FREEBUFF_API_KEYS_URL, MODELS, SUGGESTIONS } from '../../shared/config'
import type { Message } from '../../shared/types'
import { Composer } from '../components/Composer'
import { AssistantMessage, UserMessage } from '../components/Message'
import { ModelPicker } from '../components/ModelPicker'
import { Spinner, useToast } from '../components/ui'
import { ApiError, useConversation, useMe, useSetConversationModel } from '../lib/api'
import { untilLabel } from '../lib/format'
import { dismissTurn, startTurn, useTurn } from '../lib/turn'

const MODEL_KEY = 'model'

export function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const toast = useToast()
  const { data: me } = useMe()
  const page = useConversation(id)
  const turn = useTurn()
  const setConversationModel = useSetConversationModel()

  const [draft, setDraft] = useState('')
  const [newModel, setNewModel] = useState(() => {
    const saved = localStorage.getItem(MODEL_KEY)
    return saved && MODELS.some((m) => m.id === saved) ? saved : DEFAULT_MODEL
  })
  // The conversation this page created from "/", so it keeps showing the
  // reply during the moment between the server naming it and the URL changing.
  const owned = useRef<string | null>(null)
  useEffect(() => {
    setDraft('')
  }, [id])

  const conversation = page.data?.conversation
  const saved = page.data?.messages ?? []
  const model = conversation?.model ?? newModel
  const mine = turn !== null && (turn.conversationId === (id ?? null) || (id === undefined && turn.conversationId === owned.current))
  const busy = mine && turn.status !== 'error'
  const ai = me?.capabilities.ai ?? true
  const limitReached = me ? me.usage.used >= me.usage.limit && !busy : false

  const send = useCallback(
    async (content: string) => {
      content = content.trim()
      if (!content) return
      setDraft('')
      try {
        await startTurn(
          client,
          { conversationId: id, content, model },
          {
            onConversation: (created) => {
              owned.current = created.id
              navigate(`/c/${created.id}`, { replace: true })
            },
          },
        )
      } catch (error) {
        setDraft(content)
        if (error instanceof ApiError && error.code === 'limit') void client.invalidateQueries({ queryKey: ['me'] })
        toast(error instanceof Error ? error.message : 'Could not send this message', 'danger')
      }
    },
    [client, id, model, navigate, toast],
  )

  const regenerate = useCallback(async () => {
    if (!id) return
    try {
      await startTurn(client, { conversationId: id, regenerate: true, model })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not regenerate', 'danger')
    }
  }, [client, id, model, toast])

  const changeModel = (next: string) => {
    if (conversation) setConversationModel.mutate({ id: conversation.id, model: next })
    else {
      setNewModel(next)
      localStorage.setItem(MODEL_KEY, next)
    }
  }

  // What the thread shows: the saved messages, plus the turn in flight. While
  // regenerating, saved replies after the last question are hidden.
  let messages: Message[] = saved
  if (mine && turn && !turn.userMessage) {
    const lastUser = [...saved].reverse().find((m) => m.role === 'user')
    if (lastUser) messages = saved.filter((m) => m.createdAt <= lastUser.createdAt)
  }
  const pendingUser = mine && turn?.userMessage && !messages.some((m) => m.id === turn.userMessage!.id) ? turn.userMessage : null
  const lastSavedAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const empty = !id && messages.length === 0 && !mine

  // Follow the reply as it streams, unless the reader has scrolled up.
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [messages.length, pendingUser, turn?.text, id])
  useEffect(() => {
    stick.current = true
  }, [id])

  if (id && page.isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    )
  }
  if (id && page.error) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-[15px] font-medium">This chat is not here any more.</p>
          <button type="button" onClick={() => navigate('/')} className="mt-2 text-[13.5px] text-muted underline underline-offset-2 hover:text-fg">
            Start a new one
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center px-3 md:h-14 md:px-5">
        <ModelPicker value={model} onChange={changeModel} disabled={busy} />
      </div>

      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 pb-6 pt-2 md:px-6">
          {empty ? (
            ai ? (
              <EmptyState onPick={(text) => void send(text)} disabled={limitReached} />
            ) : (
              <SetupCard />
            )
          ) : (
            <div className="space-y-7">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} content={message.content} />
                ) : (
                  <AssistantMessage key={message.id} content={message.content} interrupted={message.interrupted} onRegenerate={message.id === lastSavedAssistant?.id && !mine && ai ? regenerate : undefined} />
                ),
              )}
              {pendingUser && <UserMessage key={pendingUser.id} content={pendingUser.content} />}
              {mine && turn && (
                <AssistantMessage
                  key={turn.assistantMessageId ?? 'pending'}
                  content={turn.text}
                  streaming={turn.status !== 'error'}
                  error={turn.status === 'error' ? turn.error : null}
                  onRetry={() => {
                    dismissTurn()
                    void regenerate()
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 md:px-6 md:pb-6">
        {!ai && !empty ? (
          <Notice>
            Add an API key to continue.{' '}
            <a href={FREEBUFF_API_KEYS_URL} target="_blank" rel="noreferrer" className="font-medium text-fg underline underline-offset-2">
              Get one
            </a>
          </Notice>
        ) : limitReached && me ? (
          <Notice>
            You have used today&apos;s {me.usage.limit} replies. More {untilLabel(me.usage.resetsAt)}.
          </Notice>
        ) : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => void send(draft)}
            onStop={() => turn?.stop()}
            busy={busy}
            disabled={!ai}
            placeholder={ai ? `Message ${BRAND}` : 'Add an API key to start chatting'}
            autoFocus
          />
        )}
      </div>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-control bg-surface-2 px-4 py-3 text-center text-[13.5px] text-muted">{children}</p>
}

function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex min-h-[52vh] flex-col items-center justify-end pb-8 text-center">
      <h1 className="text-balance text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">What can I help with?</h1>
      <ul className="mt-7 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((text) => (
          <li key={text}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(text)}
              className="h-full w-full rounded-card border border-line bg-surface px-4 py-3 text-left text-[13.5px] leading-snug text-muted shadow-[0_1px_1px_rgb(27_26_23/0.03)] transition-[border-color,color,background-color] hover:border-line-strong hover:text-fg disabled:opacity-50"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

/** Shown to everyone until the server has an API key. The key itself never comes here. */
function SetupCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex min-h-[52vh] flex-col items-center justify-end pb-8 text-center">
      <div className="grid size-12 place-items-center rounded-card bg-surface shadow-card">
        <KeyRound className="size-5 text-muted" />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Connect the Freebuff API</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        Add your API key as <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-fg">OPENAI_API_KEY</code> and {BRAND} starts answering.
      </p>
      <a
        href={FREEBUFF_API_KEYS_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-control bg-fg px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#2e2c27]"
      >
        Get an API key
        <ArrowUpRight className="size-4" />
      </a>
      <p className="mt-4 text-[12.5px] text-faint">Locally in .env. On Freebuff Sites, in Secrets.</p>
    </motion.div>
  )
}
