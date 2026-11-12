// Product configuration for Aiden AI (aiden.koba.games), shared by the Worker
// and the app. It is the single source of truth for the three models, the
// koba_engine operation each one runs, Koba Coin pricing, the parameters the
// parameter bar offers, and the gate labels streamed as progress.

export const BRAND = 'Aiden'
export const SITE_HOST = 'aiden.koba.games'

/**
 * Brand art shipped in public/brand. These are the supplied logo files, used as
 * images and never redrawn; when a file is missing the UI falls back to the
 * word, so a half-populated folder never shows a broken image.
 */
export const BRAND_LOGO = '/brand/aiden.png'
export const BRAND_ICON = '/brand/aiden-icon.png'
export const TAGLINE = 'Server-ready Rust assets, built on demand.'

export type KobaOperation = 'asset.build_monument' | 'asset.build_skin' | 'asset.build_map'
export type ModelId = 'graft' | 'vest' | 'terra'

/**
 * One control in the parameter bar. The same spec drives the UI and the
 * Worker's validation, so the two can never drift apart.
 */
export type ModelParam =
  | { key: string; label: string; kind: 'select'; options: readonly { value: string; label: string }[]; default: string }
  | { key: string; label: string; kind: 'number'; min: number; max: number; step: number; default: number; hint?: string }
  | { key: string; label: string; kind: 'palette'; count: number; default: readonly string[] }

export interface ModelDefinition {
  id: ModelId
  name: string
  domain: string
  description: string
  /** The koba_engine operation the Worker forwards the job to. */
  operation: KobaOperation
  /** What the user receives, in one line. */
  output: string
  /** The files inside the delivered bundle. */
  deliverables: readonly string[]
  /** Brand lockup for the picker, once the asset is in public/brand. */
  logo?: string
  /** Gate 1–3 labels, in order, streamed while the job runs. */
  gates: readonly [string, string, string]
  /** koba_engine stage ids for each gate, in order. */
  stages: readonly [string, string, string]
  params: readonly ModelParam[]
}

export const MODELS: readonly ModelDefinition[] = [
  {
    id: 'graft',
    name: 'Graft',
    domain: 'Custom Monuments',
    description: 'Prefabs, wiring plugin and a top-down preview',
    operation: 'asset.build_monument',
    output: '.prefab monument bundle + MonumentWiring.cs Oxide plugin + top-down preview',
    deliverables: ['monument.prefab', 'MonumentWiring.cs', 'preview_topdown.png', 'delivery.json'],
    logo: '/brand/graft.png',
    gates: ['Generate monument', 'Validate prefab & wiring', 'Package delivery'],
    stages: ['generate-monument', 'validate-monument', 'deliver'],
    // Graft builds entirely from the brief: no presets, no fixed knobs.
    params: [],
  },
  {
    id: 'vest',
    name: 'Vest',
    domain: 'Weapon & Item Skins',
    description: '2048px PBR texture sets with baked UV masks',
    operation: 'asset.build_skin',
    output: '2048px PBR texture set (albedo, smoothness, normal, emission) + manifest',
    deliverables: ['albedo_2048.png', 'smoothness_2048.png', 'normal_2048.png', 'emission_2048.png', 'manifest.json'],
    logo: '/brand/vest.png',
    gates: ['Generate skin', 'Bake UV & PBR masks', 'Package delivery'],
    stages: ['generate-skin', 'bake-pbr', 'deliver'],
    params: [
      {
        key: 'item_template',
        label: 'Item template',
        kind: 'select',
        default: 'ak47',
        options: [
          { value: 'ak47', label: 'Assault Rifle · AK47' },
          { value: 'bolt-rifle', label: 'Bolt Action Rifle' },
          { value: 'lr300', label: 'LR-300' },
          { value: 'mp5', label: 'MP5' },
          { value: 'metal-facemask', label: 'Metal Facemask' },
          { value: 'hoodie', label: 'Hoodie' },
          { value: 'garage-door', label: 'Garage Door' },
          { value: 'sheet-metal-door', label: 'Sheet Metal Door' },
        ],
      },
      {
        key: 'palette',
        label: 'Palette',
        kind: 'palette',
        count: 3,
        default: ['#F80801', '#FFFFFF', '#111111'],
      },
      {
        key: 'resolution',
        label: 'Resolution',
        kind: 'select',
        default: '2048',
        options: [
          { value: '1024', label: '1024 px' },
          { value: '2048', label: '2048 px' },
          { value: '4096', label: '4096 px' },
        ],
      },
    ],
  },
  {
    id: 'terra',
    name: 'Terra',
    domain: 'Procedural Rust Maps',
    description: 'Terrain, biomes, rivers and embedded Graft monuments',
    operation: 'asset.build_map',
    output: 'Server-ready .map (terrain, biomes, rivers, decor, embedded Graft monuments)',
    deliverables: ['terrain.map', 'biomes.json', 'river_network.json', 'decor_manifest.json', 'delivery.json'],
    logo: '/brand/terra.png',
    gates: ['Generate terrain', 'Verify biomes & monuments', 'Package delivery'],
    stages: ['generate-map', 'verify-map', 'deliver'],
    params: [
      {
        key: 'map_preset',
        label: 'Map preset',
        kind: 'select',
        default: 'vanilla',
        options: [
          { value: 'vanilla', label: 'Vanilla Procedural' },
          { value: 'high-desert', label: 'High Desert' },
          { value: 'arctic', label: 'Arctic Wasteland' },
          { value: 'archipelago', label: 'Archipelago' },
          { value: 'badlands', label: 'Badlands' },
          { value: 'custom', label: 'Custom terrain brief' },
        ],
      },
      { key: 'seed', label: 'Seed', kind: 'number', min: 1, max: 4_294_967_295, step: 1, default: 1337, hint: 'Reproducible layouts' },
    ],
  },
]

export const DEFAULT_MODEL: ModelId = 'graft'

export const isModelId = (value: unknown): value is ModelId => MODELS.some((model) => model.id === value)

export const modelById = (id: ModelId): ModelDefinition => MODELS.find((model) => model.id === id) ?? MODELS[0]!

/** One job's parameters, as sent to koba_engine. */
export type JobParams = Record<string, string | number | string[]>

export function defaultParams(model: ModelId): JobParams {
  const params: JobParams = {}
  for (const spec of modelById(model).params) params[spec.key] = spec.kind === 'palette' ? [...spec.default] : spec.default
  return params
}

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Validates a job's parameters against the model's spec, filling in defaults.
 * Returns null when anything is unknown or out of range: the Worker rejects the
 * request rather than passing unvetted values to koba_engine.
 */
export function normalizeParams(model: ModelId, input: unknown): JobParams | null {
  if (input !== undefined && (input === null || typeof input !== 'object' || Array.isArray(input))) return null
  const given = (input ?? {}) as Record<string, unknown>
  const def = modelById(model)
  for (const key of Object.keys(given)) if (!def.params.some((param) => param.key === key)) return null
  const out: JobParams = {}
  for (const spec of def.params) {
    const value = given[spec.key]
    if (spec.kind === 'select') {
      const next = value === undefined ? spec.default : value
      if (typeof next !== 'string' || !spec.options.some((option) => option.value === next)) return null
      out[spec.key] = next
    } else if (spec.kind === 'number') {
      const next = value === undefined ? spec.default : Number(value)
      if (!Number.isFinite(next) || next < spec.min || next > spec.max) return null
      out[spec.key] = Math.trunc(next)
    } else {
      const next = value === undefined ? [...spec.default] : value
      if (!Array.isArray(next) || next.length !== spec.count) return null
      if (!next.every((hex) => typeof hex === 'string' && HEX.test(hex))) return null
      out[spec.key] = next.map((hex) => (hex as string).toUpperCase())
    }
  }
  return out
}

/** A human label for a parameter value, for summaries and cards. */
export function paramLabel(model: ModelId, key: string, value: JobParams[string]): string {
  const spec = modelById(model).params.find((param) => param.key === key)
  if (spec?.kind === 'select') return spec.options.find((option) => option.value === value)?.label ?? String(value)
  if (Array.isArray(value)) return value.join(' · ')
  return String(value)
}

/** Per-user limits. Jobs are counted per UTC day. */
export const DAILY_MESSAGE_LIMIT = 50
export const MAX_MESSAGE_CHARS = 2_000

/** Shown on an empty chat, per model. */
export const SUGGESTIONS: Record<ModelId, string[]> = {
  graft: [
    'A three-dome launch complex on the coast with a working elevator lobby and recycler',
    'Small roadside gas station with a locked office and two SAM sites',
    'Harbor expansion: two cargo cranes, a barge spawn and lootable shipping containers',
    'Underground military tunnel with three entrances and card-locked loot rooms',
  ],
  vest: [
    'Weathered red-and-bone AK47 with a scratched receiver and matte clear coat',
    'Hoodie with a faded black-market logo and embroidered cuffs',
    'Garage door skin: rusted sheet metal with white stencil number 07',
    'Metal facemask with a red tribal etch and polished brass rivets',
  ],
  terra: [
    '3500 map, high desert, two large rivers, Graft monuments at every road junction',
    'Arctic wasteland with four launch sites and clustered icebergs along the north coast',
    'Archipelago seed for a 3000 server with small islands and boat-heavy loot',
    'Badlands map with a central canyon, dense rim forests and three trainyards',
  ],
}

/** koba_engine job endpoint, appended to KOBA_ENGINE_URL. */
export const KOBA_ENGINE_PATH = '/v1/jobs'
