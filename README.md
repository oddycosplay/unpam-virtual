[![CI](https://github.com/oddycosplay/unpam-virtual/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/oddycosplay/unpam-virtual/actions/workflows/node.js.yml) [![Release](https://img.shields.io/badge/release-v0.1.0-blue.svg)](https://github.com/oddycosplay/unpam-virtual/releases) [![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)](LICENSE) [![Stars](https://img.shields.io/github/stars/oddycosplay/unpam-virtual?style=social)](https://github.com/oddycosplay/unpam-virtual/stargazers)

# Unpam Virtual — Virtual 3D Campus for UNPAM

Unpam Virtual is a web-based MVP that simulates a small 3D campus environment with AI agents, real-time multiplayer, and administrative workflows for academic use-cases.

Versi saat ini: v0.1.0 — lihat juga CHANGELOG.md untuk catatan rilis.

---

## TL;DR / Ringkasan singkat

- What: 3D virtual campus (multiplayer) + AI agents for academic help and workflows.
- Why: prototyping digital campus experiences, AI-assisted academic services, and lightweight real-time multi-user interactions.
- Run: `npm install && npm run dev` → open `http://localhost:5173`.

---

## Highlights / Fitur utama

- Interactive 3D campus with avatar movement, proximity chat, and minimap.
- Real-time synchronization over Socket.IO.
- Agent AI (RAG) answering from indexed documents (SQLite FTS5) with source citations.
- Administrative workflows: proposal drafting (HIMA), Kaprodi approval, task board and notifications.
- Complete audit log for transparency and traceability.

---

## Demo / Screenshot

(Anda bisa menambahkan screenshot di `docs/screenshot.png` dan update URL di bawah ini.)

![screenshot placeholder](docs/screenshot.png)

---

## Requirements / Persyaratan

- Node.js 22.12+ (diuji di 22 dan 24)
- npm
- On Windows: Visual Studio Build Tools + Python for building `better-sqlite3`.

---

## Quick start (developer)

1. Install dependencies

```bash
npm install
```

2. Run development servers (monorepo)

```bash
npm run dev
```

3. Open in browser

```text
http://localhost:5173
```

On first run `.env` is copied from `.env.example` and seeds the SQLite database with example accounts.

---

## Configuration / Konfigurasi

- Environment variables: see `.env.example`.
- LLM / AI Provider configuration: Admin panel or `LLM_*` variables in `.env`.
  - Default: Anthropic (model `claude-opus-5-5` by default)
  - OpenAI-compatible endpoints supported (OpenRouter, Ollama)
- API keys are encrypted in DB (AES-256-GCM) and never returned to the browser.

---

## Accounts / Akun demo

All demo accounts use the password from `SEED_PASSWORD` in `.env` (default `unpam123`). Accounts are created only if users table is empty.

| Email | Role / Peran |
| --- | --- |
| mahasiswa@unpam.test | Student |
| hima@unpam.test | HIMA |
| dosen@unpam.test | Lecturer |
| kaprodi@unpam.test | Program Head |
| admin@unpam.test | Admin |

---

## Development notes / Catatan pengembang

- Frontend: React + Vite + React Three Fiber
- Backend: Fastify + Drizzle ORM + SQLite
- Real-time: Socket.IO (position updates 10×/s, proximity chat radius 6m)
- Tests: `npm test` (server)
- Typecheck: `npm run typecheck`
- To generate DB migrations: `npm run db:generate`

---

## Contributing

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Make changes, add tests where applicable
3. Open a Pull Request to `main` with a clear description and changelog entry

Refer to `PRD Unpam Virtual (MVP).md` for full specs.

---

## License / Lisensi

This project is licensed under the MIT License — see `LICENSE`.

---

## Release & changelog

See `CHANGELOG.md` for the full list of changes. A draft release is available at `.github/release-draft.md` and can be published as `v0.1.0`.

---

## Contact

Maintainer: oddycosplay — https://github.com/oddycosplay

