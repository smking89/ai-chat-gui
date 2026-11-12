# Aiden AI

Rust creator tooling for [koba.games](https://koba.games), at `aiden.koba.games`:
describe an asset, pick the model's build parameters, and Aiden forwards the job
to **koba_engine**, streams its Gate 1–3 progress, and hands back the delivered
bundle as an Asset Delivery Card.

| Model | Domain | koba_engine operation | Delivered |
| --- | --- | --- | --- |
| **Graft** | Custom Monuments | `asset.build_monument` (generate-monument + validate-monument) | `.prefab` monument bundle + `MonumentWiring.cs` Oxide plugin + top-down preview |
| **Vest** | Weapon & Item Skins | `asset.build_skin` (generate-skin / batch-skin + UV masks) | 2048px PBR set (albedo, smoothness, normal, emission) + manifest |
| **Terra** | Procedural Rust Maps | `asset.build_map` (generate-map + verify-map) | Server-ready `.map` (terrain, biomes, rivers, decor, embedded Graft monuments) |

Jobs are paid for in Koba Coin, but the price is not fixed: koba_engine quotes it
per job, so the app shows no per-model price.

## Run it

```sh
bun install
bun run dev        # http://localhost:5173 with local D1 (Miniflare)
bun run build      # dist/client (assets) + dist/ai_chat/index.js (Worker)
```

On localhost the app signs you in as a local development user and starts with an
empty thread. With no `KOBA_ENGINE_URL` it runs the **local simulator**:
same Gate 1–3 events and a real `delivery.json` (real SHA-256 digests, generated
preview), but no engine. The card says so. Set `KOBA_ENGINE_URL` and the same
flow runs against the real engine.

## Connecting koba_engine

The Worker posts jobs to `{KOBA_ENGINE_URL}/v1/jobs` with
`{ job_id, operation, model, params, prompt }` and expects either an SSE stream
of progress or one JSON body:

```
{ "gate": 1, "stage": "generate-monument", "status": "running", "progress": 0.4, "detail": "9,412 prefab entities" }
{ "gate": 3, "stage": "deliver", "status": "done", "delivery": { ...delivery.json } }
```

`delivery.json` should carry `preview` (URL), `files[]` with `path` / `bytes` /
`sha256`, a `sha256` block (`verified`, `checked`, `digest`) and a `download`
URL. `src/worker/koba.ts` normalizes all of it; `normalizeDelivery` is the one
place to adjust if the engine's field names differ.

Environment variables (locally in `.env`, on Freebuff Sites in Sites → Secrets):

- `KOBA_ENGINE_URL` — the engine origin, e.g. `https://engine.koba.games`.
- `KOBA_ENGINE_API_KEY` — server-side bearer token. Never leaves the Worker.
- `KOBA_ENGINE_SIMULATE` — optional: `1` forces the simulator, `0` disables
  generation (a deployed site then shows the setup card).

Sign in with Freebuff is required on a deployed site: without it nobody can
spend Koba Coin.

## Where things are

- `src/shared/config.ts`: brand, the three models with their koba_engine
  operation, gate labels, parameter specs (shared by the UI and the server-side
  validator), and per-model prompt suggestions.
- `src/worker/koba.ts`: the engine client (SSE progress, error mapping,
  delivery normalization) and the local simulator.
- `src/worker/routes/chat.ts`: one job per turn — validates the parameters,
  forwards to the engine, relays gates, stores `delivery.json` in D1 and closes
  with the delivered message.
- `src/worker/db.ts`: schema, created on the first request. `deliveries` holds
  one `delivery.json` per finished job, keyed by `job_id` and linked to its
  message.
- `src/worker/routes/deliveries.ts`: `GET /api/deliveries/:jobId`, the
  manifest download the card falls back to.
- `src/app/components/ParameterBar.tsx`: the model-specific controls above the
  composer (Graft has none; Vest: item template, palette, resolution; Terra:
  map preset and seed).
- `src/app/components/AssetDeliveryCard.tsx`: the delivery card (preview, file
  manifest, SHA-256 verification, download) and the Gate 1–3 progress rail.
- `src/app/pages/Landing.tsx`: the public marketing page at `/` (models, gates,
  FAQ); the app itself lives at `/chat` and `/c/:id`.
- `src/app/pages/Chat.tsx`, `src/app/lib/turn.ts`: the thread, and the job held
  outside React so it survives the move from `/chat` to `/c/:id`.
- `src/styles.css`: the koba.games palette — `#FFFFFF` paper, `#000000` type,
  `#F80801` accent. Everything rounded is a squircle via `corner-shape`; true
  circles use the `round` class.

## Security notes

Every `/api/*` route requires a signed-in user and scopes queries by
`owner_sub`; mutations must be same-origin. The Worker refuses any model or
parameter not in the shared spec, caps briefs at `MAX_MESSAGE_CHARS`, and allows
`DAILY_MESSAGE_LIMIT` jobs per user per UTC day. The engine key is read in
`koba.ts` only and never reaches the browser; responses are
`Cache-Control: private, no-store`. Keep the development user loopback-only.
