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

### Key Type Updates
**World & Character** now include:
- `visibility: Visibility` (`'private' | 'public'`)
- `image_url?: string | null`
- `original_author_id?: string | null` (NULL = original creator)
- `forked_from_id?: string | null` (NULL = not a fork)
- `last_synced_at?: string | null` (for version tracking)
- `published_at?: string | null` (timestamp when made public)

**User** now includes:
- `avatar_url?: string | null`

**Community Types** (`services/supabase/community.ts`):
- `PublicWorld`, `PublicCharacter` (includes creator info)
- `UpdateInfo`, `WorldDiff`, `CharacterDiff` (for sync feature)

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

### Key Debug Points
- `[buildStoryAgentInput]` - Context construction
- `[callStoryAgent]` - AI request/response
- `[executeTurn]` - Turn execution steps
- `[applyStateChanges]` - State modifications
- `[checkStoryUpdates]` - Story update checking
- `[copyWorldToCollection]`, `[copyCharacterToCollection]` - Fork operations
- `[syncWorldFromSource]`, `[syncCharacterFromSource]` - Version sync

## Component Patterns
- Use Shadcn/ui components from `components/ui/`.
- Use `cn()` for conditional Tailwind classes.
- Client components must start with `'use client';`.
- Server components are default (no directive).

## Page Routes
Key application routes:
- `/` - Landing page
- `/login`, `/register` - Authentication
- `/dashboard` - User dashboard
- `/settings` - User settings
- `/community` - Browse public worlds/characters
- `/worlds` - World list
- `/worlds/[worldId]` - World details
- `/worlds/[worldId]/edit` - Edit world & schema
- `/characters` - Character list
- `/characters/[characterId]` - Character details
- `/characters/[characterId]/edit` - Edit character
- `/stories` - Story list
- `/stories/generate` - AI-powered full story generation
- `/stories/[storyId]` - Story details & settings
- `/stories/[storyId]/play` - Main gameplay interface

## Service Layer Architecture
- Supabase CRUD: `services/supabase/` (one file per table).
  - `community.ts`: Public content queries, fork/copy, version sync
  - `storage.ts`: Image upload/management (Supabase Storage)
  - `check-story-updates.ts`: Story update checking
  - `story-reset.ts`: Story reset functionality
  - `tags.ts`: Tag management
- AI agents: `services/agents/` (clear input/output types).
- AI providers: `services/ai/`.
- Gameplay logic: `services/gameplay/`.

## AI Agent Development
- Define agent input/output types in `types/api/agents.ts`.
- Use `callOpenRouterJsonWithRetry()` for JSON responses.
- Use `callOpenRouterWithRetry()` for text responses.
- Prompts should use clear markdown headers.
- Include comprehensive logging for agent calls.

### Available AI Agents
1. **Story Agent** (`services/agents/story-agent.ts`)
   - Main narrative generation with state changes
   - Returns: `{ narrative, state_changes[], list_ops[] }`

2. **Summary Agent** (`services/agents/summary-agent.ts`)
   - Rolling story summaries (every N turns)
   - Input: Previous summary + recent turns

3. **Suggestion Agent** (`services/agents/suggestion-agent.ts`)
   - Generate 3 contextual action suggestions
   - Used in gameplay UI (lightbulb button)

4. **Generation Agent** (`services/agents/generation-agent.ts`)
   - One-click world generation (with schema)
   - One-click character generation
   - Full story generation (world + characters + story setup)
   - Functions: `generateWorld()`, `generateCharacter()`, `generateFullStory()`
   - Page: `/stories/generate`

## Database Patterns
- Use RLS (Row Level Security) for user data access.
- Client: `@/lib/supabase/client.ts`.
- Server: `@/lib/supabase/server.ts`.
- Retry wrapper: `@/lib/supabase/retry.ts`.
- JSON columns: `JSON.parse()` on read; `JSON.stringify()` on write.
- Tags: Use junction tables (`world_tags`, `story_tags`, `character_tags`) with central `tags` table.
- Images: Store URLs in entity tables; actual files in Supabase Storage as WebP format.

### Query Best Practices
- **Select Specific Columns**: Avoid `select('*')` unless truly needed.
- **Use Joins**: Fetch related data in single query when possible.
  ```ts
  .select('*, worlds!inner(name, description)')
  ```
- **Filter Early**: Apply filters before ordering/limiting.
- **Parallel Queries**: Use `Promise.all()` for independent queries.
- **Error Handling**: Check for specific error codes (e.g., `PGRST116` = not found).
- **Type Assertions**: Use `as any` carefully when Supabase types are incorrect, but prefer proper typing.

## State Management
- Story state values stored in `story_state_values.value_json`.
- Supported operations: `set`, `inc`, `push`, `remove`.
- Validate min/max and enum constraints when applying changes.
- Create change logs for audit trail.

## Visibility & Fork System
- **Visibility Types**: `'private'` (default) or `'public'`.
- **Original Content**: Can be set to public if `original_author_id IS NULL`.
- **Forked Content**: Always private; `forked_from_id` points to source.
- **Version Tracking**: `last_synced_at` tracks when fork was last synced.
- **Author Preservation**: Forks retain `original_author_id` for attribution.

### Fork Workflow
1. User browses public content on `/community` page.
2. Clicks "Fork" to copy world/character to their collection.
3. Copy created with:
   - `user_id`: Current user
   - `visibility`: `'private'` (forced)
   - `original_author_id`: Original creator's ID
   - `forked_from_id`: Source world/character ID
   - `last_synced_at`: Source's `updated_at` timestamp
4. Schema (worlds only) and tags are also copied.

### Sync Workflow
1. Check for updates: `checkWorldForUpdates()` / `checkCharacterForUpdates()`
2. If updates available, show diff: `getWorldDiff()` / `getCharacterDiff()`
3. User can:
   - Sync: `syncWorldFromSource()` / `syncCharacterFromSource()` (overwrites local changes)
   - Skip: `skipWorldUpdate()` / `skipCharacterUpdate()` (marks as read, keeps local version)

### UI Implementation Notes
- Show visibility toggle only when `original_author_id IS NULL`.
- Display original author info on forked content (read-only).
- Show update badge when `sourceUpdatedAt > lastSyncedAt`.
- Confirm before syncing (warns about overwriting local changes).

## Image Upload System
- **Supported Types**: `'characters'`, `'worlds'`, `'avatars'`.
- **Format**: WebP (unified format for optimization).
- **Path Structure**:
  - Characters/Worlds: `{type}/{userId}/{entityId}.webp`
  - Avatars: `avatars/{userId}/avatar.webp`
- **Upload Flow**:
  1. User selects image in UI (with preview/crop).
  2. Call `uploadImage(entityType, userId, entityId, file)`.
  3. Store returned `image_url` in database.
- **Delete Flow**:
  1. When deleting entity, call `deleteImage()` to clean up Storage.
  2. Set `image_url` to `null` in database.
- **Key Functions** (`services/supabase/storage.ts`):
  - `uploadImage()`: Upload with upsert mode
  - `deleteImage()`: Remove from Storage
  - `getPublicUrl()`: Get CDN URL
  - `imageExists()`: Check if file exists

## Story Update System
- **Purpose**: Alert users when worlds/characters/schema used in a story are updated.
- **Check Function**: `checkStoryUpdates(storyId, userId)` (non-blocking).
- **Comparison**: Compares resource `updated_at` vs story's `updated_at`.
- **Reset Behavior**: Resetting a story updates `story.updated_at`, clearing update alerts.
- **UI Display**: Show alert banner on story page with list of updated resources.

## Story Reset & Regenerate
### Reset Story
- **Purpose**: Delete all turns and state values, restart story from scratch.
- **Function**: `resetStory(storyId, userId)` in `services/supabase/story-reset.ts`.
- **Process**:
  1. Deletes all turns (cascades to change logs).
  2. Deletes all state values.
  3. Deletes all summaries.
  4. Resets `turn_count` and updates `updated_at`.
- **UI**: Show confirmation dialog warning about data loss.

### Regenerate Turn
- **Purpose**: Retry a turn with same input but get different AI response.
- **Implementation**: Rollback + execute with same player input.
- **Use Case**: User didn't like AI's response, wants to try again.
- **Note**: Previous turn is deleted, new turn created with new narrative/state changes.

## Internationalization
- User-facing text and comments use Traditional Chinese.
- Console logs can mix English function names and Chinese descriptions.

## Security
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- API keys stored in `provider_settings` (RLS protected).
- Sanitize user input before AI prompts.
- Validate all data before database writes.
- **Visibility & Fork Rules**:
  - Only original content (`original_author_id` IS NULL) can be set to public.
  - Forked content (`forked_from_id` IS NOT NULL) is forced to private.
  - Check `original_author_id` before showing visibility toggle in UI.
- **RLS Policies**:
  - Public content uses dedicated RLS policies (migrations 016, 018).
  - Forked content only editable by owner, but preserves author info.
- **Image Upload**:
  - Storage RLS policies control access.
  - Use `upsert: true` to avoid duplicates.
  - Clean up Storage files when deleting entities.

## Performance
- Use `Promise.all()` for parallel queries.
- Implement rolling summaries for long story contexts.
- Cache component state when beneficial.
- Use streaming for AI responses when applicable.

## Best Practices

### Before Making Changes
1. **Read Existing Code**: Always read relevant files before modifying them.
2. **Follow Patterns**: Match existing code style, naming, and structure.
3. **Check Dependencies**: Consider what other parts of the app depend on your changes.
4. **Update Types**: Keep TypeScript types in sync with database schema.

### When Adding Features
1. **Database First**: Create migration file, then update types.
2. **Service Layer**: Add CRUD functions in `services/supabase/`.
3. **UI Components**: Build components in `components/`, use existing Shadcn/ui.
4. **Error Handling**: Add try/catch and user-friendly toast messages.
5. **Logging**: Add debug logs with function name prefix.

### When Modifying Existing Features
1. **Check Git History**: Review recent commits for context.
2. **Test Edge Cases**: Consider null values, empty arrays, missing data.
3. **Update Documentation**: Update CLAUDE.md and AGENTS.md if needed.
4. **Preserve Behavior**: Don't break existing functionality unless explicitly asked.

## Common Patterns

### Adding New Features with Visibility
When creating a new resource type that needs visibility/fork support:
1. Add columns: `visibility`, `image_url`, `original_author_id`, `forked_from_id`, `last_synced_at`, `published_at`.
2. Update RLS policies for public content access.
3. Add fork/sync functions in `services/supabase/community.ts` or similar.
4. Update UI to show visibility toggle (only for original content).
5. Implement sync UI with diff comparison.

### Adding Image Upload to Entity
1. Add `image_url` column to table.
2. Update `ImageEntityType` in `services/supabase/storage.ts` if needed.
3. Create upload component with preview/crop.
4. Call `uploadImage()` before saving entity.
5. Call `deleteImage()` when entity is deleted.

### Checking Story Dependencies
When modifying worlds, characters, or schema:
- Consider if stories depend on these resources.
- Update `updated_at` timestamp to trigger update alerts.
- Users will see alerts on story page via `checkStoryUpdates()`.

### Working with Tags
- Tags are stored in junction tables, not JSON arrays.
- Use `tags` table with `tag_type` filter (`'world'`, `'story'`, `'character'`).
- Query with joins: `world_tags(tags(*))`, `character_tags(tags(*))`, etc.
- Create/link tags per user (tags are user-scoped).

## Repository Notes
- Next.js 15 app with Supabase backend.
- Strict TypeScript and ESLint are expected.
- Prefer existing patterns over new frameworks.

### Database Migration Timeline
Key migrations in `supabase/migrations/`:
- **001-009**: Base schema, RLS, auth, summary system
- **010-011**: Tag system (JSON arrays → junction tables)
- **012**: Remove story status system
- **013**: Image upload support
- **014**: Visibility fields (`private`/`public`)
- **015**: User avatars
- **016**: Public content RLS policies
- **017**: Fork fields (`original_author_id`, `forked_from_id`)
- **018**: Fork RLS policies
- **019**: Version sync tracking (`last_synced_at`)

**Migration Order**: Must be applied sequentially by number.

## Cursor/Copilot Rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.
