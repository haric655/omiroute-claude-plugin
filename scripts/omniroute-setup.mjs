#!/usr/bin/env node
/**
 * OmniRoute Setup Script
 * Configures Claude Code to use OmniRoute gateway
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROFILES_DIR = join(CLAUDE_DIR, 'profiles');

function runOmniRoute(args) {
  const result = spawnSync('omniroute', args, { encoding: 'utf8', stdio: 'pipe' });
  return { code: result.status ?? 1, stdout: result.stdout?.trim() ?? '', stderr: result.stderr?.trim() ?? '' };
}

function checkOmniRouteInstalled() {
  const result = spawnSync('omniroute', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0;
}

function checkOmniRouteAuth() {
  const result = spawnSync('omniroute', ['status'], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 && result.stdout?.includes('Authenticated');
}

async function main() {
  const args = process.argv.slice(2);
  
  // Check if omniroute is installed
  if (!checkOmniRouteInstalled()) {
    console.log('❌ OmniRoute CLI not found.');
    console.log('Run: npm install -g omniroute');
    process.exit(1);
  }

  // Check authentication
  if (!checkOmniRouteAuth()) {
    console.log('⚠️  OmniRoute not authenticated.');
    console.log('Run: omniroute connect');
    console.log('Or set OMNIROUTE_API_KEY environment variable');
  }

  // Run omniroute setup-claude with passed arguments
  const setupArgs = ['setup-claude', ...args];
  const result = runOmniRoute(setupArgs);
  
  if (result.code !== 0) {
    console.error('Setup failed:', result.stderr);
    process.exit(result.code);
  }

  console.log(result.stdout);
  
  // Show created profiles
  if (existsSync(PROFILES_DIR)) {
    const profiles = readdirSync(PROFILES_DIR).filter(f => statSync(join(PROFILES_DIR, f)).isDirectory());
    if (profiles.length > 0) {
      console.log('\n📁 Created profiles:');
      for (const profile of profiles) {
        console.log(`  - ${profile}`);
      }
      console.log('\nUse: /omiroute:launch --profile <name>');
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});