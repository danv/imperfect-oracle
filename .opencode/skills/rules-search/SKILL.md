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
Otherwise I issue a search using **Kagi** on `https://2e.aonprd.com` for the same query and return the top 3 hits.

> **CRITICAL**: This skill MUST be loaded with the `skill()` tool before use. Do not manually execute the workflow described here — load the skill first, then issue the search query.

## Remaster Name Detection
I automatically detect when you use legacy (pre-Remaster) terminology and map it to the current PF2e Remastered terms. When this happens:

- **Automatic Mapping**: I search using both the legacy and remastered terms
- **Persistent Cache**: Discovered mappings are cached for future queries
- **User Notification**: I notify you when a name change was detected
- **Dual Results**: When uncertain, I show results from both terms

This ensures accurate results even when terminology has changed between the original PF2e and the Remastered edition.

### Common Examples
- "Flat-Footed" → "Off-Guard"
- "Attack of Opportunity" → "Reactive Strike"

## When to use me
Load me whenever the user asks about:
- Conditions, actions, feats, spells, classes, checks, DCs, or general mechanics

## Output format
An array of objects each containing:
- `source` ("rulebook" or "web")
- `citation` (document name or URL)
- `content` (queried excerpt, may include mapping notices)
- `confidence` (numerical score)
- `category` (`"rules"`)
- `mappingNotice` (optional: `{legacyTerm, remasteredTerm, wasDetected}`)

These objects should be formatted into Markdown.