# OmniRoute Plugin for Claude Code

Route your Claude Code requests through the OmniRoute AI gateway to access 380+ AI providers with automatic fallback, token compression, and free tier management.

## Features

- **380+ AI Providers** — Access models from OpenAI, Anthropic, Google, Meta, and many more through a single endpoint
- **Automatic Fallback** — Seamlessly switch between providers on failure
- **Token Compression** — Reduce costs with intelligent token optimization
- **Free Tier Management** — Automatically use free tiers when available
- **Profile-based Configuration** — Pre-configured profiles for different models

## Installation

```bash
# Clone or copy the plugin to your Claude Code plugins directory
cp -r .claude-plugin ~/.claude/plugins/omiroute
```

Or install via Claude Code:
```bash
claude plugins install <path-to-plugin>
```

## Prerequisites

- [OmniRoute CLI](https://github.com/cheaper-inference/OmniRoute) installed: `npm install -g omniroute`
- OmniRoute account and API key (get one at [omniroute.ai](https://omniroute.ai))

## Commands

### `/omiroute:setup`
Configure Claude Code to use OmniRoute gateway.

```bash
/omiroute:setup
/omiroute:setup --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

Options:
- `--remote <url>` — Remote OmniRoute URL (default: http://localhost:20128)
- `--api-key <key>` — OmniRoute API key
- `--profile <name>` — Profile name to create

### `/omiroute:launch`
Launch Claude Code with an OmniRoute profile.

```bash
/omiroute:launch --profile glm52
/omiroute:launch --profile kimi-k27 -- --dangerously-skip-permissions
/omiroute:launch --remote http://192.168.0.15:20128 --api-key oma_live_xxx --model glm/glm-5.2
```

Options:
- `--profile <name>` — Use a pre-created profile from `~/.claude/profiles/`
- `--remote <url>` — Remote OmniRoute URL
- `--api-key <key>` — OmniRoute API key
- `--model <id>` — Default model to use
- `-- <args>...` — Additional arguments passed to `claude`

### `/omiroute:profiles`
Generate or list OmniRoute profiles for Claude Code.

```bash
/omiroute:profiles
/omiroute:profiles --remote http://192.168.0.15:20128 --api-key oma_live_xxx
/omiroute:profiles --only glm,kimi --dry-run
```

Options:
- `--remote <url>` — Remote OmniRoute URL
- `--api-key <key>` — OmniRoute API key
- `--only <patterns>` — Comma-separated substrings to filter models (e.g. `glm,kimi`)
- `--include-local` — Include local-CLI providers not detected on this host
- `--dry-run` — Preview what would be written without creating files

## How It Works

1. **Setup** runs `omniroute setup-claude` which:
   - Fetches the live `/v1/models` catalog from OmniRoute
   - Creates `~/.claude/profiles/<name>/settings.json` for each supported model

2. **Launch** injects environment variables:
   - `ANTHROPIC_BASE_URL` — Points to OmniRoute gateway (`/v1`)
   - `ANTHROPIC_AUTH_TOKEN` — Your OmniRoute API key
   - `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` — Enables model discovery
   - `CLAUDE_CONFIG_DIR` — Set to profile directory when using `--profile`

3. **Profiles** are auto-generated from the live model catalog, ensuring you always have access to the latest models.

## Configuration

The plugin uses the following environment variables:
- `OMNIROUTE_API_KEY` — Your OmniRoute API key (alternative to `--api-key`)

## Hooks

- **SessionStart** — Shows available OmniRoute profiles and gateway status
- **SessionEnd** — Placeholder for future cleanup/stats

## Troubleshooting

### "OmniRoute CLI not found"
```bash
npm install -g omniroute
```

### "OmniRoute not authenticated"
```bash
omniroute connect
# Or set environment variable
export OMNIROUTE_API_KEY=oma_live_xxx
```

### "Gateway unreachable"
- Check if OmniRoute is running: `omniroute status`
- Verify the remote URL is correct
- Check firewall/network connectivity

## Links

- [OmniRoute GitHub](https://github.com/cheaper-inference/OmniRoute)
- [OmniRoute Documentation](https://docs.omniroute.ai)
- [Claude Code Plugins](https://docs.anthropic.com/en/docs/claude-code/plugins)