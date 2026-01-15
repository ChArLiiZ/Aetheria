# AGENTS.md

Guidance for agentic coding agents working in the Aetheria repository.

## Scope and Intent
- Follow existing patterns unless explicitly asked to change them.
- Keep changes minimal and focused on the request.
- Do not introduce new frameworks or tooling without approval.

## Development Commands

### Core Commands
```bash
npm run dev              # Start Next.js dev server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run tauri            # Tauri CLI commands (desktop app)
```

### Testing
- No test framework is currently configured.
- If you add tests, update `package.json` scripts and follow repo patterns.
- Recommended defaults:
  - Jest for unit tests
  - Playwright for E2E

### Single-Test Guidance (when framework exists)
- Jest (example): `npm test -- <pattern>` or `npx jest <path>`
- Playwright (example): `npx playwright test <file>`

## Tooling & Configs
- `next.config.ts`: Next.js config (React strict mode enabled; images unoptimized).
- `tsconfig.json`: TypeScript strict mode, `@/*` path alias to repo root.
- `.eslintrc.json`: Extends `next/core-web-vitals` and `next/typescript`.
- `tailwind.config.ts`: Tailwind theme with CSS variables; `tailwindcss-animate` plugin.
- `postcss.config.js`: Tailwind + Autoprefixer.

## Import Organization
- Use `@/*` alias for root imports.
- Group imports in this order:
  1. React/Next.js
  2. Third-party libraries
  3. Local types (`import type`)
  4. Local services
  5. Local components
- Example:
```ts
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { Story, Character } from '@/types';
import { getStories } from '@/services/supabase/stories';
import { Button } from '@/components/ui/button';
```

## TypeScript & Types
- Strict mode is enabled.
- Prefer `type` for simple aliases and `interface` for object shapes.
- Database entity types live in `types/database/`.
- AI agent types live in `types/api/agents.ts`.
- Avoid `any` even though ESLint allows it.

## Naming Conventions
- Files: kebab-case for components and services (e.g., `story-agent.ts`).
- Components: PascalCase (e.g., `AppHeader`).
- Functions/variables: camelCase (e.g., `executeTurn`).
- Constants: UPPER_SNAKE_CASE (e.g., `DEFAULT_CONTEXT_TURNS`).

## Error Handling
- Wrap async operations in `try/catch` where appropriate.
- Throw descriptive errors for unrecoverable cases.
- For user-facing errors, use toast notifications:
```ts
try {
  await operation();
  toast.success('Operation completed');
} catch (error) {
  console.error('[functionName] Error:', error);
  toast.error('Operation failed');
}
```

## Logging Pattern
- Prefix logs with function name in brackets.
- Use step numbering for multi-step flows.
- Example:
```ts
console.log('[executeTurn] 步驟 1: 建構 Story Agent 輸入...');
console.log('[callStoryAgent] 角色數量:', input.characters.length);
```

## Component Patterns
- Use Shadcn/ui components from `components/ui/`.
- Use `cn()` for conditional Tailwind classes.
- Client components must start with `'use client';`.
- Server components are default (no directive).

## Service Layer Architecture
- Supabase CRUD: `services/supabase/` (one file per table).
- AI agents: `services/agents/` (clear input/output types).
- AI providers: `services/ai/`.
- Gameplay logic: `services/gameplay/`.

## AI Agent Development
- Define agent input/output types in `types/api/agents.ts`.
- Use `callOpenRouterJsonWithRetry()` for JSON responses.
- Use `callOpenRouterWithRetry()` for text responses.
- Prompts should use clear markdown headers.
- Include comprehensive logging for agent calls.

## Database Patterns
- Use RLS (Row Level Security) for user data access.
- Client: `@/lib/supabase/client.ts`.
- Server: `@/lib/supabase/server.ts`.
- Retry wrapper: `@/lib/supabase/retry.ts`.
- JSON columns: `JSON.parse()` on read; `JSON.stringify()` on write.

## State Management
- Story state values stored in `story_state_values.value_json`.
- Supported operations: `set`, `inc`, `push`, `remove`.
- Validate min/max and enum constraints when applying changes.
- Create change logs for audit trail.

## Internationalization
- User-facing text and comments use Traditional Chinese.
- Console logs can mix English function names and Chinese descriptions.

## Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- API keys stored in `provider_settings` (RLS protected).
- Sanitize user input before AI prompts.
- Validate all data before database writes.

## Performance
- Use `Promise.all()` for parallel queries.
- Implement rolling summaries for long story contexts.
- Cache component state when beneficial.
- Use streaming for AI responses when applicable.

## Repository Notes
- Next.js 15 app with Supabase backend.
- Strict TypeScript and ESLint are expected.
- Prefer existing patterns over new frameworks.

## Cursor/Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.
