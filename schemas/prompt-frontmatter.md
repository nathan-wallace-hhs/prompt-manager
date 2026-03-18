# Prompt Frontmatter Schema (Recommended)

Use YAML frontmatter at the top of prompt Markdown files when possible:

```yaml
---
title: string                # human readable title
description: string          # short summary
tags: [string, string]       # searchable tags
updated: YYYY-MM-DD          # last meaningful update
author: string               # optional
---
```

If frontmatter is omitted, the explorer falls back to file name and content excerpt.
