# AGENTS.md

This file provides guidance for agentic coding agents working in the Aetheria repository.

## Development Commands

### Core Commands
```bash
npm run dev              # Start Next.js development server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run tauri            # Tauri CLI commands (desktop app)
```

### Testing
This project does not currently have a test framework configured. When adding tests:
1. Choose appropriate framework (Jest for unit tests, Playwright for E2E)
2. Update package.json with test scripts
3. Follow existing code patterns in test structure

## Code Style Guidelines

### Import Organization
- Use `@/*` path alias for root directory imports (configured in tsconfig.json)
- Group imports: React/Next.js → Third-party → Local types → Local services/components
- Example:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { Story, Character } from '@/types';
import { getStories } from '@/services/supabase/stories';
import { Button } from '@/components/ui/button';
```

### TypeScript & Types
- Use strict TypeScript configuration (already enabled)
- Define interfaces in `types/database/index.ts` for database entities
- Define agent types in `types/api/agents.ts` for AI agent inputs/outputs
- Use `type` for simple types, `interface` for objects with implementation
- Avoid `any` - ESLint rule `@typescript-eslint/no-explicit-any` is disabled but prefer proper typing

### Naming Conventions
- **Files**: kebab-case for components (`app-header.tsx`), camelCase for services (`story-agent.ts`)
- **Components**: PascalCase (`AppHeader`, `ProtectedRoute`)
- **Functions/Variables**: camelCase (`callStoryAgent`, `nextTurnIndex`)
- **Constants**: UPPER_SNAKE_CASE with descriptive names (`DEFAULT_CONTEXT_TURNS`)
- **Interfaces**: PascalCase with descriptive suffixes (`StoryAgentInput`, `ExecuteTurnInput`)

### Error Handling
- Use try-catch blocks for async operations
- Return error objects or throw for unrecoverable errors
- Use toast notifications for user-facing errors:
```typescript
try {
  await operation();
  toast.success('Operation completed');
} catch (error) {
  console.error('[functionName] Error:', error);
  toast.error('Operation failed');
}
```

### Console Logging Pattern
- Use descriptive console.log with function name prefix:
```typescript
console.log('[functionName] Description:', data);
console.log('[executeTurn] Starting turn execution...');
console.log('[callStoryAgent] Character count:', input.characters.length);
```
- Include key data points for debugging AI agent calls
- Log step numbers in complex functions (see `execute-turn.ts`)

### Component Patterns
- Use Shadcn/ui components from `components/ui/`
- Follow existing component structure with proper TypeScript props
- Use `cn()` utility for conditional Tailwind classes
- Client components: Start with `'use client';` directive
- Server components: Default, no directive needed

### Service Layer Architecture
- **Database operations**: One service file per Supabase table in `services/supabase/`
- **AI agents**: Separate files in `services/agents/` with clear input/output types
- **Game logic**: Core gameplay in `services/gameplay/`
- **AI providers**: Provider integrations in `services/ai/`

### AI Agent Development
- Define input/output interfaces in `types/api/agents.ts`
- Use `callOpenRouterJsonWithRetry()` for JSON-structured responses
- Use `callOpenRouterWithRetry()` for text responses
- Build system prompts with clear sections using markdown headers
- Include comprehensive logging for agent calls

### Database Patterns
- Use RLS (Row Level Security) policies for user data access
- Client: `@/lib/supabase/client.ts`
- Server: `@/lib/supabase/server.ts`
- Use retry wrapper: `@/lib/supabase/retry.ts`
- JSON columns: Parse with `JSON.parse()` before use, stringify before save

### State Management
- Story state values stored as JSON in `story_state_values.value_json`
- State operations: `set`, `inc` (numbers), `push`, `remove` (lists)
- Validate constraints (min/max, enum options) when applying state changes
- Create change logs for audit trail

### File Structure Conventions
```
app/                    # Next.js App Router pages
components/
  ui/                  # Shadcn/ui components
  auth/                # Authentication components
  forms/               # Form components
  layout/              # Layout components
services/
  agents/              # AI agent implementations
  supabase/            # Database CRUD operations
  ai/                  # AI provider integrations
  gameplay/            # Core game logic
types/
  database/            # Database entity types
  api/                 # API request/response types
lib/                   # Utility functions
```

### Internationalization
- Project uses Traditional Chinese for comments and user-facing text
- Console logs may mix English (function names) with Chinese (descriptions)
- Maintain consistency with existing language patterns

### Security Best Practices
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- API keys stored in user's `provider_settings` table (RLS protected)
- Sanitize user inputs before AI prompts
- Validate all data before database operations

### Performance Considerations
- Use `Promise.all()` for parallel database queries
- Implement rolling summary system for long story contexts
- Cache component state to reduce redundant queries
- Use streaming for AI responses when applicable

## Important Notes

- This is a Next.js 15 app with Supabase backend
- AI integration supports OpenRouter and OpenAI providers
- Uses TypeScript with strict mode enabled
- Follows existing patterns rather than introducing new frameworks
- All database operations must respect user ownership via RLS policies