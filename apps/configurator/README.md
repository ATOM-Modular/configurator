# configurator (public app) — arrives in M3

React + Vite + react-three-fiber + drei + Zustand.

**Security boundary (SPEC rules #1–2):** this app must NEVER import
`@atom/blaise-engine` or `@atom/catalog`. It talks to `apps/pricing-api`
over HTTP and types its requests/responses with `@atom/contracts`.
Enforced by the ESLint `no-restricted-imports` rule at the repo root and
the `check:no-cost-leak` CI grep over `dist/`.

This app **never computes a dollar.**
