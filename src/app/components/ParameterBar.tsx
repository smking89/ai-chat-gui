import { modelById, type JobParams, type ModelId, type ModelParam } from '../../shared/config'
import { cx } from '../lib/cx'
import { Select } from './Select'

/** The model-specific controls above the composer: what koba_engine will build. */
export function ParameterBar({
  model,
  params,
  onChange,
  disabled,
}: {
  model: ModelId
  params: JobParams
  onChange: (next: JobParams) => void
  disabled?: boolean
}) {
  const def = modelById(model)
  // A model with no parameters (Graft) has no bar at all.
  if (!def.params.length) return null
  return (
    <div className={cx('mb-2 rounded-control border border-line bg-surface px-2.5 py-2', disabled && 'opacity-60')}>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <span className="hidden pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint sm:block">{def.name} build</span>
        {def.params.map((spec) => (
          <Control key={spec.key} spec={spec} value={params[spec.key]} disabled={disabled} onChange={(value) => onChange({ ...params, [spec.key]: value })} />
        ))}
      </div>
    </div>
  )
}

function Control({
  spec,
  value,
  onChange,
  disabled,
}: {
  spec: ModelParam
  value: JobParams[string] | undefined
  onChange: (value: string | number | string[]) => void
  disabled?: boolean
}) {
  if (spec.kind === 'select') {
    return (
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-faint">{spec.label}</span>
        <Select
          className="w-[186px]"
          label={spec.label}
          value={String(value ?? spec.default)}
          options={spec.options}
          disabled={disabled}
          onChange={onChange}
        />
      </label>
    )
  }

  if (spec.kind === 'number') {
    return (
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-faint">{spec.label}</span>
        <input
          type="number"
          inputMode="numeric"
          className="h-8 w-[118px] rounded-[9px] border border-line-strong bg-surface px-2.5 text-[12.5px] font-medium tabular-nums text-fg transition-[border-color,box-shadow] hover:border-fg/40 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15 disabled:opacity-60"
          value={Number(value ?? spec.default)}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          disabled={disabled}
          aria-label={spec.label}
          onChange={(event) => onChange(Math.trunc(Number(event.target.value)))}
        />
      </label>
    )
  }

  const palette = (Array.isArray(value) ? value : [...spec.default]).map(String)
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-faint">{spec.label}</span>
      <span className="flex h-8 items-center gap-1.5">
        {palette.map((hex, index) => (
          <span key={`${hex}-${index}`} className="inline-flex items-center gap-1">
            <input
              type="color"
              value={hex}
              disabled={disabled}
              aria-label={`${spec.label} ${index + 1}`}
              className="round size-7 cursor-pointer appearance-none rounded-full border border-line-strong bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
              onChange={(event) => {
                const next = [...palette]
                next[index] = event.target.value.toUpperCase()
                onChange(next)
              }}
            />
            <code className="hidden font-mono text-[10.5px] text-faint lg:inline">{hex}</code>
          </span>
        ))}
      </span>
    </label>
  )
}
