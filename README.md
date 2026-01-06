# Bloblet Public (AI-Built Game)

Bloblet is a web game about AI token pets, battles, and rewards. This public repo is a **curated mirror** of the private development repo — it contains the gameplay/client code and player-facing docs, but **no secrets, ops runbooks, or internal tooling**.

## AI-built, human-guided
This project is built primarily by AI agents (Codex + Claude) under human direction and review. We treat AI output as code contributions that still require testing, validation, and security review before shipping.

## Player safety & trust
- **Never share seed phrases or private keys.** The game does not request them.
- We store **minimal data** (wallet address + gameplay state).
- Admin routes are protected with secrets; public endpoints are rate-limited.

## Docs
Player-facing docs live in `docs/`:
- `docs/quickstart.md`
- `docs/faq.md`
- `docs/gameplay/`
- `docs/economy/`
- `docs/security/`
- `docs/AI_PROVENANCE.md`

## Local development
1. Copy `.env.example` to `.env.local` and fill required variables.
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev`

### Environment variables
Required variables are listed in `.env.example`. If you only want a partial local build, you can omit optional blocks (storage, AI help, deploy helpers), but some features will be disabled.

## Development practices
- TypeScript + strict linting
- Unit tests in `tests/`
- Builds validated with `npm run build`

## Public mirror policy
The private repo contains operational runbooks, internal scripts, and sensitive config. This public mirror is intentionally limited to safe, community-shareable content.

---

Built with AI agents (Codex + Claude), guided by humans.
