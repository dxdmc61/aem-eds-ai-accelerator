# AEM EDS AI Migration Accelerator

A local starter project for an AI-assisted accelerator that migrates a normal website/page into an **AEM Edge Delivery Services (EDS) + Universal Editor-friendly** project structure.

This scaffold uses:

- **React + Vite** frontend
- **Node.js + Express** backend
- **LLM provider abstraction** for Copilot/Azure OpenAI/Gemini-compatible extension
- **Mock migration engine** that crawls a URL, detects sections, generates EDS block files, and creates a local output folder
- **GitHub integration stub** for future PR/branch creation

> This is an accelerator scaffold, not a production-ready migration engine. It gives you a working local base to extend.

---

## What this project does

From the UI, enter a website URL and click **Start Migration**.

The backend will:

1. Fetch the page HTML
2. Analyze simple sections such as hero, cards, text, header, footer
3. Generate EDS-style files under `generated/<jobId>/`
4. Generate Universal Editor-related config files:
   - `component-definition.json`
   - `component-models.json`
   - `component-filters.json`
5. Generate block folders such as:
   - `blocks/hero/hero.css`
   - `blocks/hero/hero.js`
   - `blocks/hero/_hero.json`
6. Return the generated file tree to the React UI

---

## Folder Structure

```text
aem-eds-ai-accelerator
  apps
    api       Node.js Express backend
    web       React/Vite frontend
  packages
    shared    Shared types and utilities
  templates
    eds       EDS/Universal Editor templates
  generated  Migration outputs generated at runtime
```

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Local Setup

```bash
cd aem-eds-ai-accelerator
npm install
npm run dev
```

This starts:

- Web UI: http://localhost:5173
- API: http://localhost:3001

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Optional values:

```env
PORT=3001
LLM_PROVIDER=mock
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
GEMINI_API_KEY=
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
```

By default, this project uses `LLM_PROVIDER=mock`.

---

## API Endpoints

### Health

```bash
curl http://localhost:3001/api/health
```

### Start Migration

```bash
curl -X POST http://localhost:3001/api/migrations \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","projectName":"demo-site"}'
```

### Get Migration Status

```bash
curl http://localhost:3001/api/migrations/<jobId>
```

---

## Generated EDS Output

A generated job output looks like:

```text
generated/<jobId>
  blocks
    hero
      hero.css
      hero.js
      _hero.json
    cards
      cards.css
      cards.js
      _cards.json
  scripts
    scripts.js
  styles
    styles.css
  component-definition.json
  component-models.json
  component-filters.json
  fstab.yaml
  paths.json
  head.html
  package.json
```

---

## Next Improvements

Recommended next phases:

1. Replace mock LLM with Azure OpenAI, Copilot-compatible service, or Gemini.
2. Add Playwright crawler for JS-rendered websites.
3. Add GitHub App integration using Octokit.
4. Add EDS local preview using AEM CLI.
5. Add accessibility/performance validation.
6. Add proper Universal Editor model generation based on AEM content model.
