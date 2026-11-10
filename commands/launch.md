---
description: Launch Claude Code with OmniRoute profile
argument-hint: '[--profile <name>] [--remote <url>] [--api-key <key>] [--model <id>] [-- <claude-args>...]'
allowed-tools: Bash(node:*)
---

Run the OmniRoute launch script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/omniroute-launch.mjs" $ARGUMENTS
```

This will:
1. Health-check the OmniRoute gateway
2. Build a clean environment with ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, and gateway model discovery
3. If --profile is given, set CLAUDE_CONFIG_DIR to ~/.claude/profiles/<name>
4. Spawn `claude` with the remaining arguments

Examples:
```
/omiroute:launch --profile glm52
/omiroute:launch --profile kimi-k27 -- --dangerously-skip-permissions
/omiroute:launch --remote http://192.168.0.15:20128 --api-key oma_live_xxx --model glm/glm-5.2
```