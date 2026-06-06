# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build + type-check
npm run start    # serve the production build
npm run lint     # ESLint (eslint 9 flat config in eslint.config.mjs)
npx tsc --noEmit # type-check without building
```

No test runner is configured yet.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 4 |
| AI | Anthropic SDK (`@anthropic-ai/sdk` ^0.102) |
| Runtime | Node.js, no separate backend |

## Architecture

All source lives under `src/`. The `@/*` path alias resolves to `src/*`.

```
src/
  app/            # Next.js App Router — every folder is a route segment
    layout.tsx    # root layout (fonts, global providers)
    page.tsx      # homepage
    globals.css   # Tailwind base styles
  # add as you go:
  # components/   shared UI
  # lib/          pure utilities and server helpers
  # app/api/      Route Handlers (POST /api/chat, etc.)
```

**Route Handlers** (`src/app/api/**/route.ts`) are the backend. All calls to the Anthropic API must happen here — never on the client, so the API key stays server-side.

## Anthropic SDK usage

Read `node_modules/next/dist/docs/` and the SDK changelog before writing AI code — both Next.js 16 and `@anthropic-ai/sdk` 0.x have breaking changes vs. training-data examples.

Minimal server-side pattern for a Route Handler:

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return Response.json(message);
}
```

Set `ANTHROPIC_API_KEY` in `.env.local` (already gitignored).

## Key conventions

- **Next.js 16 App Router**: `"use client"` is required for any component that uses hooks or browser APIs. Server Components are the default.
- **Tailwind 4**: utility class names and the config format changed from v3 — check the v4 docs before using v3 patterns.
- **TypeScript strict**: `strict: true` is on; avoid `any`, use `unknown` + narrowing.
- **Module alias**: import from `@/components/...`, `@/lib/...`, etc. — never with relative `../` chains.
