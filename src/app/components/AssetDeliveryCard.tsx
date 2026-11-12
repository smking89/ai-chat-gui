import { Check, CircleAlert, Coins, Download, FileArchive, Loader2 } from 'lucide-react'

import { modelById, type ModelId } from '../../shared/config'
import type { Delivery, StageEvent } from '../../shared/types'
import { cx } from '../lib/cx'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`
}

/** Gate 1–3, as they arrive from koba_engine while a job runs. */
export function StageRail({ model, stages }: { model: ModelId; stages: StageEvent[] }) {
  if (!stages.length) return null
  const def = modelById(model)
  const byGate = new Map(stages.map((stage) => [stage.gate, stage]))
  return (
    <ol className="mt-1 space-y-1.5" aria-label="Build progress">
      {def.gates.map((label, index) => {
        const gate = (index + 1) as 1 | 2 | 3
        const stage = byGate.get(gate)
        const status = stage?.status ?? 'pending'
        return (
          <li key={gate} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
              {status === 'done' ? (
                <Check className="size-3.5 text-success" />
              ) : status === 'running' ? (
                <Loader2 className="size-3.5 animate-spin text-accent" />
              ) : status === 'failed' ? (
                <CircleAlert className="size-3.5 text-danger" />
              ) : (
                <span className="size-1.5 rounded-full bg-line-strong" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className={cx('text-[13px]', status === 'pending' ? 'text-faint' : 'font-medium text-fg')}>
                  <span className="font-mono text-[11px] text-faint">G{gate}</span> {label}
                </span>
                {stage?.detail && <span className="text-[12px] text-muted">{stage.detail}</span>}
              </span>
              {status === 'running' && (
                <span className="mt-1 block h-[3px] w-full max-w-[280px] overflow-hidden rounded-[2px] bg-surface-2">
                  <span
                    className="block h-full rounded-[2px] bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.max(6, Math.round((stage?.progress ?? 0) * 100))}%` }}
                  />
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The Asset Delivery Card: what koba_engine produced, with the preview, the
 * file manifest, the SHA-256 verification state and the download.
 */
export function AssetDeliveryCard({ delivery, className }: { delivery: Delivery; className?: string }) {
  const def = modelById(delivery.model as ModelId)
  const verified = delivery.sha256.verified
  const download = delivery.downloadUrl ?? `/api/deliveries/${encodeURIComponent(delivery.jobId)}`

  return (
    <figure className={cx('mt-3 overflow-hidden rounded-card border border-line-strong bg-surface', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-accent text-white">
            <FileArchive className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">
              {def.name} · {def.domain}
            </p>
            <p className="truncate font-mono text-[11px] text-faint">{delivery.operation}</p>
          </div>
        </div>
        <span
          className={cx(
            'inline-flex h-6 items-center gap-1 rounded-[7px] px-2 text-[11.5px] font-semibold',
            verified ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
          )}
        >
          {verified ? <Check className="size-3.5" /> : <CircleAlert className="size-3.5" />}
          {verified ? `SHA-256 ${delivery.sha256.checked}/${delivery.files.length}` : 'Unverified'}
        </span>
      </header>

      {delivery.previewUrl && (
        <div className="border-b border-line bg-[#0B0B0B]">
          <img src={delivery.previewUrl} alt={`${def.name} preview for job ${delivery.jobId.slice(0, 8)}`} className="block max-h-[300px] w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="px-3.5 py-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">File manifest</p>
        <ul className="mt-1.5 divide-y divide-line">
          {delivery.files.map((file) => (
            <li key={file.path} className="flex items-center gap-3 py-1.5">
              <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">{file.path}</code>
              <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{formatBytes(file.bytes)}</span>
              <code className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline" title={file.sha256}>
                {file.sha256 ? `${file.sha256.slice(0, 10)}…` : '—'}
              </code>
            </li>
          ))}
          {delivery.files.length === 0 && <li className="py-1.5 text-[12.5px] text-faint">No files listed in delivery.json.</li>}
        </ul>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-3.5 py-2.5">
        <span className="text-[11.5px] text-muted">
          {delivery.files.length} files · {formatBytes(delivery.bytes)}
        </span>
        {delivery.sha256.digest && (
          <span className="hidden items-center gap-1 font-mono text-[11px] text-faint md:inline-flex" title="SHA-256 digest of the manifest">
            {delivery.sha256.digest.slice(0, 16)}…
          </span>
        )}
        {delivery.meta.build && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
            <Coins className="size-3 text-accent" />
            {String(delivery.meta.build)}
          </span>
        )}
        <a
          href={download}
          download
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-tile bg-accent px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#D00700] active:scale-[0.98]"
        >
          <Download className="size-3.5" />
          {delivery.downloadUrl ? 'Download bundle' : 'Download delivery.json'}
        </a>
      </footer>

      {delivery.simulated && (
        <p className="border-t border-line bg-surface-2 px-3.5 py-2 text-[11.5px] leading-snug text-muted">
          Simulated delivery: built locally, not by the build service. The manifest and digests here are real.
        </p>
      )}
    </figure>
  )
}
