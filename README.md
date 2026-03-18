# Prompt Manager

A lightweight repository for storing, organizing, and browsing reusable Markdown prompts for a ChatGPT project.

## Goals

- Keep prompts in plain Markdown files.
- Organize prompts into folders by topic or workflow.
- Make it easy for an agent to read, write, retrieve, and reuse prompts.
- Provide a GitHub Pages UI to explore saved prompts.
- Ensure the explorer UI follows WCAG 2.2-friendly interaction and contrast defaults.
- Keep styling tokenized so the UI is easy to migrate to Sass architecture.

## Repository Layout

- `prompts/` — source Markdown prompts grouped in folders.
- `schemas/prompt-frontmatter.md` — optional metadata convention for prompt files.
- `index.html`, `styles.css`, `app.js` — static GitHub Pages explorer.
- `.nojekyll` — ensures GitHub Pages serves files/folders exactly as stored.

## Prompt File Convention

Each prompt should be a `.md` file under `prompts/`.

Suggested format:

```md
---
title: Prompt title
tags: [tag1, tag2]
updated: 2026-03-18
---

# Prompt title

Prompt body...
```

The web UI works even without frontmatter, but frontmatter improves display and search.

## GitHub Pages Setup

1. Push this repository to GitHub.
2. In repository settings, enable **Pages** and set source to the default branch root.
3. Keep `.nojekyll` at the repo root.
4. Open the Pages URL to use the prompt explorer UI.

## Agent Usage Pattern

An agent can:

1. Create folders under `prompts/` (for example: `coding/`, `marketing/`, `research/`).
2. Add or update Markdown prompts.
3. Read prompts from disk for reuse in future tasks.
4. Use `prompts/index.json` as a canonical file list for fast lookup.

## Updating the Prompt Index

When adding/removing prompt files, update `prompts/index.json` so the web explorer can discover files quickly.

