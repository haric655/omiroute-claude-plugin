#!/usr/bin/env node
/**
 * OmniRoute Profiles Script
 * Generates or lists OmniRoute profiles for Claude Code
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROFILES_DIR = join(CLAUDE_DIR, 'profiles');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { 
    remote: null, 
    apiKey: null, 
    only: null, 
    includeLocal: false, 
    dryRun: false 
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--remote' && i + 1 < args.length) {
      result.remote = args[++i];
    } else if (arg === '--api-key' && i + 1 < args.length) {
      result.apiKey = args[++i];
    } else if (arg === '--only' && i + 1 < args.length) {
      result.only = args[++i];
    } else if (arg === '--include-local') {
      result.includeLocal = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    }
  }
  return result;
}

function runOmniRoute(args) {
  const result = spawnSync('omniroute', args, { encoding: 'utf8', stdio: 'pipe' });
  return { code: result.status ?? 1, stdout: result.stdout?.trim() ?? '', stderr: result.stderr?.trim() ?? '' };
}

async function main() {
  const { remote, apiKey, only, includeLocal, dryRun } = parseArgs();
  
  const args = ['profiles'];
  if (remote) args.push('--remote', remote);
  if (apiKey) args.push('--api-key', apiKey);
  if (only) args.push('--only', only);
  if (includeLocal) args.push('--include-local');
  if (dryRun) args.push('--dry-run');
  
  console.log(`📋 Generating profiles${dryRun ? ' (dry-run)' : ''}...`);
  
  const result = runOmniRoute(args);
  
  if (result.code !== 0) {
    console.error('Failed:', result.stderr);
    process.exit(result.code);
  }
  
  console.log(result.stdout);
  
  if (!dryRun && existsSync(PROFILES_DIR)) {
    const profiles = readdirSync(PROFILES_DIR).filter(f => statSync(join(PROFILES_DIR, f)).isDirectory());
    if (profiles.length > 0) {
      console.log('\n📁 Available profiles:');
      for (const profile of profiles) {
        console.log(`  - ${profile}`);
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});