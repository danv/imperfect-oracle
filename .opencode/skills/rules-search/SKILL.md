---
name: rules-search
description: Search Pathfinder 2e rules
compatibility: opencode
metadata:
  sources:
    - 2e.aonprd.com
  type: rules
---

## What I do
Given a rules‑related query, I first query the local MCP RAG server (`rag-mcp-pf2e`).
If any result has a confidence of **≥ 0.7** I return those excerpts.
Otherwise I issue a web‑search on `https://2e.aonprd.com` for the same query and return the top 3 hits.

## When to use me
Load me whenever the user asks about:
- Conditions, actions, feats, spells, classes, checks, DCs, or general mechanics

## Output format
An array of objects each containing:
- `source` (“rulebook” or “web”)
- `citation` (document name or URL)
- `content` (queried excerpt)
- `confidence` (numerical score)
- `category` (`"rules"`)
