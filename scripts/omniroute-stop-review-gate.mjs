#!/usr/bin/env node
/**
 * Stop Review Gate Hook
 * Runs automated code review via OmniRoute when Claude Code session stops
 * Similar to codex-plugin-cc's stop-review-gate-hook.mjs
 */

import { OmniRouteClient } from '../lib/omniroute-client.mjs';
import { ModelSelector, TASK_TYPES } from '../lib/model-selector.mjs';
import { buildPrompt, getSystemPrompt } from '../lib/review-prompts.mjs';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_FILE = join(homedir(), '.omiroute', 'review-gate.json');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  // Check if review gate is enabled
  const config = loadConfig();
  if (!config.enabled) {
    console.log('ℹ️  Review gate disabled. Enable with: /omiroute:setup --review-gate');
    process.exit(0);
  }

  try {
    // Get git diff
    const diff = await getGitDiff();
    if (!diff.trim()) {
      console.log('ℹ️  No changes to review');
      process.exit(0);
    }

    // Check if we should run review (based on config)
    if (!shouldRunReview(diff, config)) {
      console.log('ℹ️  Review gate skipped (no significant changes)');
      process.exit(0);
    }

    console.log('🔍 Running pre-commit review gate via OmniRoute...');

    const client = OmniRouteClient.fromConfig();
    const selector = new ModelSelector(client);

    // Select fast but capable model for review gate
    const model = await selector.selectBestModel(TASK_TYPES.CODE_REVIEW, {
      requiredCapabilities: ['coding'],
      verbose: false
    });

    console.log(`🤖 Review model: ${model.id}`);

    // Build review prompt
    const prompt = buildPrompt(TASK_TYPES.CODE_REVIEW, diff, {
      maxDiffLength: config.maxDiffLength || 30000
    });

    const messages = [
      { role: 'system', content: getSystemPrompt('code_reviewer') },
      { role: 'user', content: prompt }
    ];

    const params = {
      model: model.id,
      messages,
      temperature: 0.2,
      max_tokens: 8192,
      stream: false
    };

    const response = await client.chatCompletions(params);
    const review = response.choices?.[0]?.message?.content || '';

    // Check for critical issues
    const hasCritical = review.includes('🔴 Critical') || review.includes('🔴 CRITICAL');
    const hasHigh = review.includes('🟠 High') || review.includes('🟠 HIGH');

    // Save review for later viewing
    saveReview(review, diff);

    // Output review
    console.log('\n' + '='.repeat(60));
    console.log('📋 PRE-COMMIT REVIEW GATE');
    console.log('='.repeat(60));
    console.log(review);
    console.log('='.repeat(60));

    // Exit with code based on severity and config
    if (hasCritical && config.blockOnCritical) {
      console.log('\n🚫 COMMIT BLOCKED: Critical issues found');
      console.log('   Override with: git commit --no-verify');
      process.exit(1);
    }

    if (hasHigh && config.blockOnHigh) {
      console.log('\n🚫 COMMIT BLOCKED: High severity issues found');
      console.log('   Override with: git commit --no-verify');
      process.exit(1);
    }

    if (hasCritical || hasHigh) {
      console.log('\n⚠️  Issues found but not blocking (configure with /omiroute:setup --review-gate)');
    } else {
      console.log('\n✅ Review gate passed');
    }

    process.exit(0);

  } catch (error) {
    // Don't block on review errors - just warn
    console.error('⚠️  Review gate error (non-blocking):', error.message);
    process.exit(0);
  }
}

function parseArgs(argv) {
  const args = {};
  let currentKey = null;
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      currentKey = arg.slice(2).replace(/-/g, '-');
      args[currentKey] = true;
    } else if (arg.startsWith('-') && arg.length === 2) {
      currentKey = arg.slice(1);
      args[currentKey] = true;
    } else if (currentKey !== null) {
      args[currentKey] = arg;
      currentKey = null;
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Stop Review Gate Hook - Runs automated code review on git commit

Usage: node stop-review-gate.mjs [options]

Options:
  --help, -h    Show help

Configuration (~/.omiroute/review-gate.json):
  {
    "enabled": true,
    "blockOnCritical": true,
    "blockOnHigh": false,
    "maxDiffLength": 30000,
    "ignorePaths": ["*.md", "*.txt", "package-lock.json"]
  }
`);
}

function loadConfig() {
  const defaults = {
    enabled: false,
    blockOnCritical: true,
    blockOnHigh: false,
    maxDiffLength: 30000,
    ignorePaths: ['*.md', '*.txt', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
  };

  if (existsSync(CONFIG_FILE)) {
    try {
      return { ...defaults, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

function saveConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function shouldRunReview(diff, config) {
  // Check if diff only contains ignored files
  const lines = diff.split('\n');
  let hasSignificantChanges = false;
  
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const fileMatch = line.match(/diff --git a\/(.+) b\//);
      if (fileMatch) {
        const file = fileMatch[1];
        const ignored = config.ignorePaths.some(pattern => {
          const regex = pattern.replace(/\*/g, '.*');
          return new RegExp(regex).test(file);
        });
        if (!ignored) {
          hasSignificantChanges = true;
          break;
        }
      }
    }
  }
  
  return hasSignificantChanges;
}

async function getGitDiff() {
  try {
    // Get staged changes (what's being committed)
    return execSync('git diff --cached', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    try {
      // Fallback to unstaged
      return execSync('git diff', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    } catch {
      return '';
    }
  }
}

function saveReview(review, diff) {
  const reviewDir = join(homedir(), '.omiroute', 'reviews');
  if (!existsSync(reviewDir)) {
    require('fs').mkdirSync(reviewDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(reviewDir, `review-${timestamp}.md`);
  
  const content = `# Pre-Commit Review Gate\n\n**Date:** ${new Date().toLocaleString()}\n\n## Diff\n\`\`\`diff\n${diff}\n\`\`\`\n\n## Review\n${review}\n`;
  
  writeFileSync(file, content);
}

main();