#!/usr/bin/env node
/**
 * OmniRoute Session Start Hook
 * Runs when a Claude Code session starts
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CLAUDE_DIR = join(homedir(), '.claude');
const PROFILES_DIR = join(CLAUDE_DIR, 'profiles');

function main() {
  // Check if any OmniRoute profiles exist
  if (existsSync(PROFILES_DIR)) {
    const profiles = readdirSync(PROFILES_DIR).filter(f => statSync(join(PROFILES_DIR, f)).isDirectory());
    if (profiles.length > 0) {
      console.log(`🔀 OmniRoute: ${profiles.length} profile(s) available`);
      console.log('   Use /omiroute:launch --profile <name> to start with a profile');
    }
  }
  
  // Check if OmniRoute is running locally
  const result = spawnSync('omniroute', ['status'], { encoding: 'utf8', stdio: 'pipe' });
  if (result.status === 0 && result.stdout?.includes('Running')) {
    console.log('🟢 OmniRoute gateway is running');
  }
}

main();