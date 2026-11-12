import { motion } from 'motion/react'
import { ArrowRight, Database } from 'lucide-react'

import { BRAND, MODELS, TAGLINE } from '../../shared/config'
import { BrandAsset, Logo } from '../components/Shell'

export function SignIn() {
  const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1040px] items-center px-5 sm:px-8">
        <Logo to="/" />
      </header>
      <main className="mx-auto grid w-full max-w-[1040px] flex-1 items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="max-w-md">
          <h1 className="text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">Build Rust assets with {BRAND}</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">{TAGLINE} Sign in to spend Koba Coin and keep your deliveries.</p>
          <a href={`/auth/freebuff/signin?returnTo=${returnTo}`} className="mt-8 inline-flex h-12 items-center gap-2 rounded-control bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#D00700]">
            <span className="grid size-5 place-items-center rounded-[6px] bg-white text-[11px] font-bold text-fg">F</span>
            Sign in with Freebuff
            <ArrowRight className="size-4" />
          </a>
          <p className="mt-4 text-[13px] text-faint">Uses your Freebuff account. No new password.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="hidden lg:block">
          <div className="rounded-card border border-line bg-surface p-6 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Three ways to build</p>
            <ul className="mt-5 space-y-5">
              {MODELS.map((model) => (
                <li key={model.id} className="flex items-center gap-4">
                  <BrandAsset
                    src={model.logo ?? ''}
                    alt={model.name}
                    height={22}
                    maxWidth={84}
                    fallback={<span className="text-[13px] font-semibold text-fg">{model.name}</span>}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.05em] text-faint">{model.domain}</span>
                    <span className="block text-[12.5px] leading-snug text-muted">{model.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export function SetupNeeded({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-surface shadow-card">
          <Database className="size-5 text-muted" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">Almost there</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
        <p className="mt-4 text-[13px] text-faint">In Freebuff, ask the agent to add D1 storage named DB, then deploy again.</p>
      </div>
    </div>
  )
}
