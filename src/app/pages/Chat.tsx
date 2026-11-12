import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { PlugZap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { BRAND, DEFAULT_MODEL, defaultParams, isModelId, modelById, MODELS, SUGGESTIONS, type JobParams, type ModelId } from '../../shared/config'
import type { Message } from '../../shared/types'
import { Composer } from '../components/Composer'
import { AssistantMessage, UserMessage } from '../components/Message'
import { ModelPicker } from '../components/ModelPicker'
import { ParameterBar } from '../components/ParameterBar'
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
  // The conversation this page created from "/chat", so it keeps showing the
  // job during the moment between the server naming it and the URL changing.
  const owned = useRef<string | null>(null)
  useEffect(() => {
    setDraft('')
  }, [id])

  const conversation = page.data?.conversation
  const saved = page.data?.messages ?? []
  const model = conversation?.model ?? newModel
  const activeModel: ModelId = isModelId(model) ? model : DEFAULT_MODEL
  const definition = modelById(activeModel)
  const mine = turn !== null && (turn.conversationId === (id ?? null) || (id === undefined && turn.conversationId === owned.current))
  const busy = mine && turn.status !== 'error'
  const engine = me?.capabilities.engine ?? true
  const limitReached = me ? me.usage.used >= me.usage.limit && !busy : false

  // The parameter bar's values, per model: switching models resets to that
  // model's defaults rather than carrying a mismatched key across.
  const [params, setParams] = useState<JobParams>(() => defaultParams(DEFAULT_MODEL))
  // Each model (and each conversation, which carries its own model) starts from
  // that model's defaults: a stale key from another model would be refused.
  useEffect(() => {
    setParams(defaultParams(activeModel))
  }, [activeModel, id])
  const changeModel = (next: string) => {
    if (conversation) setConversationModel.mutate({ id: conversation.id, model: next })
    else {
      setNewModel(next)
      localStorage.setItem(MODEL_KEY, next)
    }
  }

  const send = useCallback(
    async (content: string) => {
      content = content.trim()
      if (!content) return
      setDraft('')
      try {
        await startTurn(
          client,
          { conversationId: id, content, model: activeModel, params },
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
        toast(error instanceof Error ? error.message : 'Could not start this job', 'danger')
      }
    },
    [activeModel, client, id, navigate, params, toast],
  )

  const regenerate = useCallback(async () => {
    if (!id) return
    try {
      await startTurn(client, { conversationId: id, regenerate: true, model: activeModel, params })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not rebuild this job', 'danger')
    }
  }, [activeModel, client, id, params, toast])

  // What the thread shows: the saved messages, plus the job in flight. While
  // regenerating, saved replies after the last brief are hidden.
  let messages: Message[] = saved
  if (mine && turn && !turn.userMessage) {
    const lastUser = [...saved].reverse().find((m) => m.role === 'user')
    if (lastUser) messages = saved.filter((m) => m.createdAt <= lastUser.createdAt)
  }
  const pendingUser = mine && turn?.userMessage && !messages.some((m) => m.id === turn.userMessage!.id) ? turn.userMessage : null
  const lastSavedAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const empty = !id && messages.length === 0 && !mine

  // Follow the job as it streams, unless the reader has scrolled up.
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    // Nothing to follow on the empty state: pinning to the bottom would push
    // the heading and suggestions off-screen on short viewports.
    if (empty) return
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [empty, messages.length, pendingUser, turn?.text, turn?.stages.length, turn?.delivery, id])
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
          <p className="text-[15px] font-medium">This job is not here any more.</p>
          <button type="button" onClick={() => navigate('/chat')} className="mt-2 text-[13.5px] text-muted underline underline-offset-2 hover:text-fg">
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
            engine ? (
              <EmptyState model={activeModel} onPick={(text) => void send(text)} disabled={limitReached} />
            ) : (
              <SetupCard />
            )
          ) : (
            <div className="space-y-7">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} content={message.content} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    content={message.content}
                    model={message.model}
                    delivery={message.delivery}
                    interrupted={message.interrupted}
                    onRegenerate={message.id === lastSavedAssistant?.id && !mine && engine ? regenerate : undefined}
                  />
                ),
              )}
              {pendingUser && <UserMessage key={pendingUser.id} content={pendingUser.content} />}
              {mine && turn && (
                <AssistantMessage
                  key={turn.assistantMessageId ?? 'pending'}
                  content={turn.text}
                  model={turn.model || activeModel}
                  streaming={turn.status !== 'error'}
                  stages={turn.stages}
                  delivery={turn.delivery}
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
        {!engine && !empty ? (
          <Notice>
            Builds are paused until Aiden’s build service is connected.
          </Notice>
        ) : limitReached && me ? (
          <Notice>
            You have used today&apos;s {me.usage.limit} jobs. More {untilLabel(me.usage.resetsAt)}.
          </Notice>
        ) : (
          <>
            <ParameterBar model={activeModel} params={params} onChange={setParams} disabled={busy || !engine} />
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => void send(draft)}
              onStop={() => turn?.stop()}
              busy={busy}
              disabled={!engine}
              placeholder={engine ? `Describe a ${definition.domain.toLowerCase()} build…` : 'Builds are not available yet'}
              autoFocus
            />
          </>
        )}
      </div>
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-control bg-surface-2 px-4 py-3 text-center text-[13.5px] text-muted">{children}</p>
}

function EmptyState({ model, onPick, disabled }: { model: ModelId; onPick: (text: string) => void; disabled: boolean }) {
  const definition = modelById(model)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex min-h-[52vh] flex-col items-center justify-end pb-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{definition.domain}</p>
      <h1 className="mt-2 text-balance text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]">What are we building?</h1>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted">
        {definition.name} builds {definition.domain.toLowerCase()}. Every build is quoted in Koba Coin when it runs.
      </p>
      <ul className="mt-7 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS[model].map((text) => (
          <li key={text}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(text)}
              className="h-full w-full rounded-card border border-line bg-surface px-4 py-3 text-left text-[13.5px] leading-snug text-muted transition-[border-color,color,background-color] hover:border-line-strong hover:text-fg disabled:opacity-50"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

/** Shown to everyone until the build service is connected. */
function SetupCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="flex min-h-[52vh] flex-col items-center justify-end pb-8 text-center">
      <div className="grid size-12 place-items-center rounded-card border border-line bg-surface text-accent">
        <PlugZap className="size-5" />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Builds aren’t connected</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        {BRAND} needs its build service before it can generate assets.
      </p>
      <p className="mt-6 text-[12.5px] text-faint">Configured server-side, in .env or Sites → Secrets.</p>
    </motion.div>
  )
}
