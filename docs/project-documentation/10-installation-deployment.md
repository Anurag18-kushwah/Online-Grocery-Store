# 10. Installation and Deployment
## Prerequisites
Node.js 20+, npm, Git; MongoDB URI for Mongo mode; optional LLM provider credentials.

## Install
```bash
git clone <repository-url>
cd <repository-folder>
npm run install:all
```
Copy the supplied `.env.example` to the server environment file location expected by the project. Configure port, client origin, store mode, Mongo URI if applicable, and a strong JWT secret. Configure LLM settings only if required. Never commit secrets.

## Development
```bash
npm run setup
npm run dev:server
npm run dev:client
```
Other documented scripts include `build`, `seed`, `photos`, `start`, `start:local`, `test`. Run `npm run` to inspect the exact checked-out scripts.

## Production checklist
- Use managed/shared persistent MongoDB.
- Configure HTTPS, CORS, and allowed client origins.
- Use hosting secret storage; rotate exposed keys.
- Back up database and monitor service health.
- Do not use file-backed local mode for multi-instance production.
- Replace in-memory rate limiting with shared infrastructure when scaling.
- Remove/change demo credentials before public exposure.
- Verify build, tests, health endpoint, and core flows after deployment.

Dockerfile and docker-compose are present in the repository but were not executed for this report. Validate volumes, env vars, and service health before relying on them.
