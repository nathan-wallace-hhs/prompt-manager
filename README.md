# ASPA Prompt Explorer

ASPA Prompt Explorer is a lightweight repository and static web app for managing reusable Markdown prompts.

It has two core purposes:

1. **Prompt library**: keep prompts in version-controlled `.md` files so they are easy to review, improve, and reuse.
2. **Prompt browser**: provide a simple GitHub Pages UI (`index.html` + `app.js`) so anyone can search, filter, and open prompts quickly.

## Why this repo exists

This project is designed to make prompt work collaborative and maintainable:

- Prompts live in plain files instead of hidden chat history.
- Prompt changes are trackable with git history and pull requests.
- Prompt content is organized by folder/category and tags.
- A browser UI makes non-technical users able to discover prompts without editing files.

## Repository layout

- `prompts/` — Markdown prompt files grouped by topic/workflow.
- `prompts/index.json` — canonical list of prompt files for fast discovery in the app.
- `schemas/prompt-frontmatter.md` — metadata/frontmatter convention.
- `index.html`, `styles.css`, `app.js` — static prompt explorer web app.
- `.nojekyll` — ensures GitHub Pages serves files and folders as-is.

## How to use the app

You can use the app via GitHub Pages (recommended) or locally.

### Option A: Use via GitHub Pages

1. Open this repository’s GitHub Pages URL.
2. Browse prompts in the sidebar/list.
3. Use filters:
   - **Search** for text matches.
   - **Category** for folder-level groupings.
   - **Tag** for cross-category topics.
   - **Sort** and **Favorites only** for quick triage.
4. Open a prompt to copy or adapt it for your workflow.

### Option B: Run locally

1. Clone the repository.
2. Serve the repo root as static files (any static server works).
3. Open `index.html` through that local server.

> Note: The app is static, so there is no backend or database required.

## Prompt file format

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

Frontmatter is optional, but it improves app display, search, and filtering.

## How to contribute prompts

### 1) Add or improve a prompt

- Create or edit `.md` files inside `prompts/`.
- Prefer clear titles, concise instructions, and practical examples.
- Put prompts in the most relevant folder/category.
- Add `tags` in frontmatter to improve discoverability.

### 2) Update prompt index

When adding/removing prompt files, update `prompts/index.json` so the explorer can discover files quickly.

### 3) Open a pull request

- Explain what prompt(s) you added or changed.
- Mention intended use case(s) and audience.
- Include before/after rationale when refining an existing prompt.

## Contribution guidelines (recommended)

When editing prompts:

- Keep prompts focused on one job-to-be-done.
- Prefer explicit constraints and output format instructions.
- Avoid secrets, personal data, or proprietary content.
- Use inclusive, plain language.

When editing the app (`index.html`, `styles.css`, `app.js`):

- Preserve accessibility-friendly behavior and contrast defaults.
- Keep styles tokenized for easier migration/refactoring.
- Validate that filters/search still work with existing prompt files.

## GitHub Pages setup

1. Push this repository to GitHub.
2. In repository settings, enable **Pages** and set source to the default branch root.
3. Keep `.nojekyll` at the repo root.
4. Open the Pages URL to use the explorer.

## Agent usage pattern

An agent can:

1. Create folders under `prompts/` (e.g., `coding/`, `marketing/`, `research/`).
2. Add or update Markdown prompts.
3. Read prompts from disk for reuse in future tasks.
4. Use `prompts/index.json` as the canonical file list.

## Codex screenshot support

If Codex needs to generate screenshots for this app, install the Playwright browser runtime and run:

1. Install Playwright Chromium browser:
   - `npm run install:browsers`
2. Generate a screenshot artifact:
   - `npm run codex:screenshot`

The screenshot is saved at `artifacts/prompt-explorer.png`.
