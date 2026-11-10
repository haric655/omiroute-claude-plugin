---
description: Generate or list OmniRoute profiles for Claude Code
argument-hint: '[--remote <url>] [--api-key <key>] [--only <patterns>] [--include-local] [--dry-run]'
allowed-tools: Bash(node:*)
---

Run the OmniRoute profile generator:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/omniroute-profiles.mjs" $ARGUMENTS
```

This fetches the live `/v1/models` catalog from OmniRoute and writes
`~/.claude/profiles/<name>/settings.json` for each supported model.

Options:
- `--remote <url>` — Remote OmniRoute URL (e.g. http://192.168.0.15:20128)
- `--api-key <key>` — OmniRoute API key (defaults to OMNIROUTE_API_KEY env var)
- `--only <patterns>` — Comma-separated substrings, only matching model IDs (e.g. glm,kimi)
- `--include-local` — Also write profiles for local-CLI providers not detected on this host
- `--dry-run` — Print what would be written without touching the filesystem

Examples:
```
/omiroute:profiles
/omiroute:profiles --remote http://192.168.0.15:20128 --api-key oma_live_xxx
/omiroute:profiles --only glm,kimi --dry-run
```