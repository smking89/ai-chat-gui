import type { FreebuffUser } from '@freebuff/auth'

export interface Env {
  ASSETS: Fetcher
  // Attached by Freebuff Sites once provisioned (sites_add_storage). Optional so
  // the app can explain what is missing instead of crashing.
  DB?: D1Database
  // The koba_engine origin, e.g. https://engine.koba.games. Jobs are forwarded
  // here (see koba.ts). Without it, local development uses the simulator.
  KOBA_ENGINE_URL?: string
  // Bearer token for koba_engine. Read here and nowhere else, never sent to the
  // browser and never stored in D1.
  KOBA_ENGINE_API_KEY?: string
  // '1' forces the local simulator, '0' disables generation entirely (a
  // deployed app without an engine then shows the setup card).
  KOBA_ENGINE_SIMULATE?: string
  // Injected on deploy once Sign in with Freebuff is enabled (sites_enable_auth).
  FREEBUFF_CLIENT_ID?: string
  FREEBUFF_ISSUER?: string
  APP_ORIGIN?: string
}

export type Variables = {
  user: FreebuffUser
  db: D1Database
}

export type AppContext = { Bindings: Env; Variables: Variables }
