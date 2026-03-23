# Hybrid SaaS Social Network

This repo contains the WorkGraph frontend and Supabase Edge Function backend.

## Workspace layout

- `src/`: React + Vite frontend code
- `supabase/functions/server/`: Deno Edge Function handlers (backend boundary)
- `supabase/migrations/`: SQL migration scripts

## Local setup

1. Install dependencies:
   - `npm install`
2. Copy the env template to `.env` and set values if needed.
3. Start frontend dev server:
   - `npm run dev`
4. Serve Edge Functions locally (optional, in a second terminal):
   - `npm run edge:serve`

## Edge Function commands

- `npm run edge:serve`: serve local functions from `supabase/functions/*`
- `npm run edge:list`: list functions in your linked Supabase project
- `npm run edge:deploy`: deploy the `server` function
- Use a specific project ref when deploying:
  - `npm run edge:deploy -- --project-ref <your-project-ref>`

The frontend reads `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_ANON_KEY` from env, with fallback defaults in `src/utils/supabase/info.tsx`.

### Data mode

- Default: DB-first project APIs (Supabase Edge Function + KV store)
- Optional dev fallback (browser localStorage): set `VITE_ENABLE_LOCAL_FALLBACK=true` in `.env`
