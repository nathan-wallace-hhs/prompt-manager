---
id: meeting-summary
version: 1.0.0
owner: prompt-platform
last-synced: 2026-03-19
---

# Meeting Summary Skill

Summarize the meeting transcript into:

1. Key decisions
2. Action items (owner + due date)
3. Risks/blockers
4. Open questions

## Output format

Return markdown with these sections:

- `## Summary`
- `## Decisions`
- `## Action Items`
- `## Risks / Blockers`
- `## Open Questions`

Keep each section concise and specific.
