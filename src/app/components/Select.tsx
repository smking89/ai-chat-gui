import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cx } from '../lib/cx'

/**
 * The app's dropdown: a native <select> renders an OS menu that ignores the
 * design, so every choice in Aiden uses this popover instead. Same shape as the
 * model picker, with a check on the current value.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  disabled,
  className,
  align = 'start',
}: {
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  label: string
  disabled?: boolean
  className?: string
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false)
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cx('relative min-w-0', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'inline-flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-[9px] border bg-surface px-2.5 text-[12.5px] font-medium text-fg transition-[border-color,box-shadow] hover:border-fg/40 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:opacity-60',
          open ? 'border-accent ring-[3px] ring-accent/15' : 'border-line-strong',
        )}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={cx('size-3.5 shrink-0 text-faint transition-transform duration-150', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              'scrollbar-thin absolute top-full z-50 mt-1 max-h-[286px] w-max min-w-full max-w-[300px] overflow-y-auto rounded-[12px] border border-line bg-surface p-1 shadow-pop',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cx(
                    'flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] transition-colors hover:bg-surface-2',
                    option.value === value ? 'font-semibold text-fg' : 'text-muted',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.value === value && <Check className="size-3.5 shrink-0 text-accent" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
