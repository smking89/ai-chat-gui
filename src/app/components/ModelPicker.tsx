import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { modelById, MODELS } from '../../shared/config'
import { useModels } from '../lib/api'
import { cx } from '../lib/cx'
import { BrandAsset } from './Shell'

/** A pill naming the model; opens the lineup with each model's lockup and price. */
export function ModelPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useModels()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const models = data?.items ?? MODELS.map((m) => ({ ...m, available: true }))
  const current = models.find((m) => m.id === value) ?? models[0]
  const currentLogo = current ? modelById(current.id as (typeof MODELS)[number]['id']).logo : undefined

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${current?.name ?? value}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-[12px] border border-transparent px-2 text-[13px] font-medium text-muted transition-colors hover:border-line hover:bg-surface hover:text-fg disabled:opacity-50"
      >
        {currentLogo && <BrandAsset src={currentLogo} alt={current?.name ?? value} height={20} maxWidth={64} fallback={<span className="text-[14px] font-semibold text-fg">{current?.name ?? value}</span>} />}
        {current && <span className="hidden text-faint sm:inline">{current.domain}</span>}
        <ChevronDown className={cx('size-3.5 text-faint transition-transform duration-150', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Model"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-full z-50 mt-1.5 w-[352px] max-w-[calc(100vw-1.5rem)] rounded-[16px] border border-line bg-surface p-1.5 shadow-pop"
          >
            {models.map((model) => {
              const logo = modelById(model.id as (typeof MODELS)[number]['id']).logo
              const selected = model.id === value
              return (
                <li key={model.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!model.available}
                    onClick={() => {
                      onChange(model.id)
                      setOpen(false)
                    }}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent sm:gap-3',
                      selected ? 'bg-surface-2' : 'hover:bg-surface-2',
                    )}
                  >
                    <span className="grid h-10 w-[64px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface-2 px-1.5 sm:w-[80px]">
                      <BrandAsset
                        src={logo ?? ''}
                        alt={`${model.name} logo`}
                        height={24}
                        maxWidth="100%"
                        fallback={<span className="text-[10px] font-bold uppercase leading-none tracking-wide text-accent">{model.name}</span>}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-semibold uppercase tracking-[0.05em] text-faint">{model.domain}</span>
                      <span className="mt-0.5 hidden text-[12px] leading-snug text-muted sm:block">{model.available ? model.description : 'Builds are not available right now'}</span>
                    </span>
                    {selected && <Check className="size-4 shrink-0 text-accent" />}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

