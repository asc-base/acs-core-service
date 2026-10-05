# Elysia with Node.js runtime

## Getting Started
Install dependencies:
```bash
npm ci
```

## Development
To start the development server run:
```bash
npm run dev
```

The health endpoint is available at http://localhost:8000/api/v1/health by default.

Docker Compose uses the Bun-based `local` target. Build the Bun-based development-server image, or Node.js images for staging and production, explicitly:
```bash
docker build --target development -f dockerfile -t acs-core-service:development .
docker build --target staging -f dockerfile -t acs-core-service:staging .
docker build --target production -f dockerfile -t acs-core-service:production .
```
