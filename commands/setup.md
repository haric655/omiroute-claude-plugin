---
description: Configure Claude Code to use OmniRoute gateway
argument-hint: '[--remote <url>] [--api-key <key>] [--profile <name>]'
allowed-tools: Bash(node:*)
---

Run the OmniRoute setup script to configure Claude Code:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/omniroute-setup.mjs" $ARGUMENTS
```

The script will:
1. Check if OmniRoute CLI is installed
2. Check authentication status
3. Run `omniroute setup-claude` with passed arguments
4. Show created profiles

If OmniRoute is not installed, the script will prompt you to install it:
```bash
npm install -g omniroute
```

If OmniRoute is installed but not authenticated, it will guide you to run:
```bash
omniroute connect
```
Or set `OMNIROUTE_API_KEY` environment variable.