#!/usr/bin/env node
/**
 * OmniRoute Launch Script
 * Launches Claude Code with OmniRoute gateway environment
 */

import { spawnSync, spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROFILES_DIR = join(CLAUDE_DIR, 'profiles');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { profile: null, remote: null, apiKey: null, model: null, claudeArgs: [] };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--profile' && i + 1 < args.length) {
      result.profile = args[++i];
    } else if (arg === '--remote' && i + 1 < args.length) {
      result.remote = args[++i];
    } else if (arg === '--api-key' && i + 1 < args.length) {
      result.apiKey = args[++i];
    } else if (arg === '--model' && i + 1 < args.length) {
      result.model = args[++i];
    } else if (arg === '--') {
      result.claudeArgs = args.slice(i + 1);
      break;
    } else if (!arg.startsWith('--')) {
      result.claudeArgs.push(arg);
    }
  }
  return result;
}

function healthCheck(remote, apiKey) {
  const url = new URL('/health', remote || 'http://localhost:20128');
  const headers = apiKey ? { 'Authorization': 'Bearer ' + apiKey } : {};
  
  // Simple fetch-based health check
  try {
    const response = fetch(url.toString(), { 
      method: 'GET', 
      headers,
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildEnv(remote, apiKey, model, profile) {
  const env = { ...process.env };
  
  // Set gateway base URL
  const baseUrl = remote || 'http://localhost:20128';
  env.ANTHROPIC_BASE_URL = baseUrl + '/v1';
  
  // Set auth token
  const token = apiKey || process.env.OMNIROUTE_API_KEY;
  if (token) {
    env.ANTHROPIC_AUTH_TOKEN = token;
  }
  
  // Enable gateway model discovery
  env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = '1';
  
  // Set profile config dir if specified
  if (profile) {
    const profilePath = join(PROFILES_DIR, profile);
    env.CLAUDE_CONFIG_DIR = profilePath;
  }
  
  // Set default model if specified
  if (model) {
    env.CLAUDE_CODE_DEFAULT_MODEL = model;
  }
  
  return env;
}

async function main() {
  const { profile, remote, apiKey, model, claudeArgs } = parseArgs();
  
  // Health check
  const checkUrl = remote || 'http://localhost:20128';
  const token = apiKey || process.env.OMNIROUTE_API_KEY;
  
  console.log('🔍 Health-checking ' + checkUrl + '...');
  const healthy = await healthCheck(checkUrl, token);
  
  if (!healthy) {
    console.error('❌ OmniRoute gateway unreachable');
    console.error('Check: omniroute status');
    process.exit(1);
  }
  
  console.log('✅ Gateway healthy');
  
  // Build environment
  const env = buildEnv(remote, apiKey, model, profile);
  
  // Launch Claude Code
  console.log('🚀 Launching Claude Code' + (profile ? ' with profile: ' + profile : '') + '...');
  
  const child = spawn('claude', claudeArgs, {
    env,
    stdio: 'inherit',
    shell: true
  });
  
  child.on('error', (err) => {
    console.error('Failed to spawn claude:', err.message);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
