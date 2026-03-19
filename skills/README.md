# Skills (Canonical)

This directory is the canonical source of truth for reusable skills.

## Required metadata header

Every skill file must include frontmatter with:

- `id`
- `version`
- `owner`
- `last-synced`

Example:

```md
---
id: meeting-summary
version: 1.0.0
owner: prompt-platform
last-synced: 2026-03-19
---
```

## Syncing mirrors

Run:

- `npm run skills:generate`
- `npm run skills:check`

`claude-skills/` is generated from this directory and should not be edited directly.
