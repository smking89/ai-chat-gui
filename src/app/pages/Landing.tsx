import { motion } from 'motion/react'
import { ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'

import { BRAND, BRAND_LOGO, MODELS, TAGLINE } from '../../shared/config'
import { BrandAsset } from '../components/Shell'

const NAV = [
  { href: '#models', label: 'Models' },
  { href: '#how', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
]

const STEPS = [
  {
    n: '01',
    title: 'Write the brief',
    body: 'Say what you want in plain language: a coastal launch complex, a weathered AK47, a 3500 high-desert map. No node graphs, no preset piles.',
  },
  {
    n: '02',
    title: 'Three gates run',
    body: 'Generate, validate, package. Every gate reports back as it moves, so you watch the build instead of waiting on a blank screen.',
  },
  {
    n: '03',
    title: 'Take the bundle',
    body: 'The delivery card shows the preview, the file list, the sizes and a SHA-256 digest per file. Download it and drop it on your server.',
  },
]

const FAQ = [
  {
    q: 'What is Aiden?',
    a: 'An AI asset studio for Rust servers. You describe an asset, Aiden builds it with one of three models and hands back a finished, verified bundle.',
  },
  {
    q: 'What comes back with a build?',
    a: 'A delivery card in the thread: a preview, every file with its size, SHA-256 digests, and the delivery.json manifest. Graft ships a .prefab with its wiring plugin, Vest ships a PBR texture set, Terra ships its map output.',
  },
  {
    q: 'How is pricing handled?',
    a: 'Builds are paid in Koba Coin, quoted per job when it runs. There is no fixed price list, because every brief is a different amount of work.',
  },
  {
    q: 'Are the assets mine to use?',
    a: 'Yes. A delivery is a plain bundle, not a locked export: prefabs and plugins for monuments, PNG maps for skins, map output for Terra.',
  },
  {
    q: 'Do I need an account?',
    a: 'Sign in with Freebuff. Your conversations and deliveries stay with the account, and your daily job count is shown in the app.',
  },
]

export function Landing() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-6 px-5 sm:px-8">
          <Link to="/" aria-label={BRAND} className="inline-flex shrink-0 items-center text-accent">
            <BrandAsset src={BRAND_LOGO} alt={BRAND} height={22} maxWidth={200} fallback={<span className="text-[16px] font-semibold tracking-tight text-fg">{BRAND}</span>} />
          </Link>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Sections">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-[13.5px] font-medium text-muted transition-colors hover:text-fg">
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            to="/chat"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#d00700] sm:h-10 sm:px-4 sm:text-[13.5px]"
          >
            Open the app
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_-15%,#fff1ef_0%,rgba(255,255,255,0)_65%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(22,32,50,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(22,32,50,0.06)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(75%_65%_at_50%_0%,#000_20%,transparent_75%)]"
          />
          <div className="relative mx-auto w-full max-w-[1120px] px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent"
            >
              AI assets for Rust servers
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-[880px] text-balance text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[58px] md:text-[68px]"
            >
              Describe the asset.
              <br />
              <span className="text-accent">Aiden builds it.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-[600px] text-[15.5px] leading-relaxed text-muted md:text-[17px]"
            >
              Custom monuments, weapon skins and procedural maps, generated from a sentence, checked gate by gate, and delivered as a bundle you can drop straight onto your server.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/chat"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#d00700]"
              >
                Start building
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#models"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 text-[14.5px] font-semibold text-fg transition-colors hover:bg-surface-2"
              >
                See the models
              </a>
            </motion.div>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">Quoted per build in Koba Coin · SHA-256 verified deliveries</p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 rounded-card border border-line bg-surface p-4 shadow-card md:mt-16 md:p-6"
            >
              <div className="flex items-center justify-between px-1">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">A Graft build</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">3 gates · 1 bundle</span>
              </div>
              <ol className="mt-4 grid gap-2.5 md:grid-cols-3">
                {MODELS[0].gates.map((gate, index) => (
                  <li key={gate} className="rounded-tile border border-line bg-surface-2 px-4 py-3.5">
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">Gate {index + 1}</span>
                    <p className="mt-1.5 text-[14px] font-medium">{gate}</p>
                    <p className="mt-1 truncate font-mono text-[11.5px] text-faint">{MODELS[0].stages[index]}</p>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </section>

        {/* Models */}
        <section id="models" className="scroll-mt-20 border-t border-line bg-surface-2 py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent">Three models</p>
            <h2 className="mt-3 max-w-[640px] text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[40px]">One brief in, one finished asset out.</h2>
            <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted">Each model is its own pipeline with its own gates, parameters and delivery format. Pick one above the chat and describe the build.</p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {MODELS.map((model) => (
                <article key={model.id} className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card">
                  <BrandAsset src={model.logo ?? ''} alt={model.name} height={26} maxWidth={120} fallback={<span className="text-[16px] font-semibold">{model.name}</span>} />
                  <p className="mt-5 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-accent">{model.domain}</p>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{model.description}.</p>
                  <ul className="mt-5 flex-1 space-y-1.5 border-t border-line pt-4">
                    {model.deliverables.map((file) => (
                      <li key={file} className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed text-faint">
                        <Check className="mt-0.5 size-3 shrink-0 text-success" />
                        {file}
                      </li>
                    ))}
                  </ul>
                  <Link to="/chat" className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-fg transition-colors hover:text-accent">
                    Build with {model.name}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-t border-line py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
            <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent">How it works</p>
                <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[40px]">From a sentence to a server-ready bundle.</h2>
                <p className="mt-4 text-[14.5px] leading-relaxed text-muted">No editor session, no asset store hunting. The brief is the input; the delivery is the output.</p>
              </div>
              <ol className="space-y-2">
                {STEPS.map((step) => (
                  <li key={step.n} className="flex gap-5 rounded-card border border-line bg-surface p-5 shadow-card">
                    <span className="font-mono text-[11px] font-medium text-accent">{step.n}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold tracking-[-0.01em]">{step.title}</span>
                      <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Verification band */}
        <section className="border-y border-line bg-fg py-14 text-white md:py-16">
          <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-5 sm:grid-cols-3 sm:px-8">
            {[
              { k: '3 gates', v: 'Generate, validate, package — every job, every model.' },
              { k: 'SHA-256', v: 'Each delivered file is hashed and checked before you get it.' },
              { k: 'delivery.json', v: 'One manifest with paths, sizes and digests, kept with the chat.' },
            ].map((item) => (
              <div key={item.k} className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                <div>
                  <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-white/90">{item.k}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">{item.v}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-accent">FAQ</p>
            <h2 className="mt-3 max-w-[560px] text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[40px]">The short answers.</h2>
            <div className="mt-8 border-t border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group border-b border-line py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[15px] font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-[15px] font-normal text-muted transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
            <div className="flex flex-col items-start justify-between gap-6 rounded-dialog border border-line bg-surface-2 px-6 py-10 sm:px-10 md:flex-row md:items-center">
              <div>
                <h2 className="text-balance text-[26px] font-semibold tracking-[-0.03em] md:text-[32px]">Ready to build something?</h2>
                <p className="mt-2 text-[14px] text-muted">Pick a model, write the brief, watch the gates.</p>
              </div>
              <Link
                to="/chat"
                className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#d00700]"
              >
                Open Aiden
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/" aria-label={BRAND} className="inline-flex items-center text-accent">
              <BrandAsset src={BRAND_LOGO} alt={BRAND} height={15} maxWidth={170} fallback={<span className="text-[14px] font-semibold tracking-tight text-fg">{BRAND}</span>} />
            </Link>
            <p className="mt-2 max-w-[320px] text-[12.5px] leading-relaxed text-faint">{TAGLINE}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="text-[13px] text-muted transition-colors hover:text-fg">
                {item.label}
              </a>
            ))}
            <a href="https://koba.games" target="_blank" rel="noreferrer" className="text-[13px] text-muted transition-colors hover:text-fg">
              koba.games
            </a>
            <Link to="/chat" className="text-[13px] font-medium text-fg transition-colors hover:text-accent">
              Open the app
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-8 w-full max-w-[1120px] px-5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint sm:px-8">© 2026 Aiden · part of koba.games</p>
      </footer>
    </div>
  )
}
