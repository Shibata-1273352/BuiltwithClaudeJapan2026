# apps/web

TSUMUGI web app (Next.js 16, App Router). See the repository root `README.md` for setup.

- `src/proxy.ts` — access control (token → cookie, same-origin)
- `src/lib/claude.ts`, `src/lib/see.ts` — Claude client and the "see" stage
- `src/lib/neo4j.ts` — read/write-separated Neo4j sessions
