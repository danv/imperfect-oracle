---
name: lore-search
description: Search Pathfinder 2e lore
compatibility: opencode
metadata:
  sources:
    - pathfinderwiki.com
  type: lore
---

## What I do
Given a lore-related query, I first query the local MCP RAG server (`rag-mcp-pf2e`).
If any result has a confidence of **≥ 0.7** I return those excerpts.
Otherwise I issue a search using **Kagi** on `https://pathfinderwiki.com` for the same query and return the top 3 hits.

> **CRITICAL**: This skill MUST be loaded with the `skill()` tool before use. Do not manually execute the workflow described here — load the skill first, then issue the search query.

## When to use me
Load me whenever the user asks about:
- NPC history, backstories, organizations
- Location history, worldbuilding, cities, nations
- In-universe events, timelines, historical periods
- Flavor text, rumors, legends, religions
- Factions, guilds, dynasties

## Output format
An array of objects each containing:
- `source` ("lore-doc" or "web")
- `citation` (document name or URL)
- `content` (queried excerpt)
- `confidence` (numerical score)
- `category` ("lore")

These objects should be formatted into Markdown.