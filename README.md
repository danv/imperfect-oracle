# imperfect-oracle
A PF2e campaign assistant for the campaign _The Imperfection_.

## Prerequisites
### [rag-mcp](https://github.com/Kamalesh-Kavin/rag-mcp)
```bash
git clone https://github.com/Kamalesh-Kavin/rag-mcp.git
cd rag-mcp
uv sync
```

### [kagi-mcp](https://github.com/kagisearch/kagimcp)
```bash
git clone https://github.com/kagisearch/kagimcp.git
```

This has been added in the root `opencode` configuration, `~/.config/opencode/opencode.json`:
```javascript
{
    // other configuration points
    "mcp": {
        "kagi-search": {
            "type": "local",
            "command": [ "uv", "--directory", "/Users/dan/projects/kagimcp", "run", "kagimcp" ],
            "environment": {
                "KAGI_API_KEY": "<API-KEY>"
            },
            "enabled": false
        },
    // other MCP servers
    }
}
```

### [Lifepath](https://github.com/danv/lifepath)
My own player character generator based on the _Lifepath_ system.

## What's In Here
 - `imperfect-oracle`: the primary agent for idea generation.
 - `iomedea`: a subagent for session planning.
 - `lamashtu`: a subagent for creature design.
 - `pharasma`: a subagent that creates player characters.
 - `search-rules`: a skill for searching for rules.
 - `search-lore`: a skill for searching for lore.
 