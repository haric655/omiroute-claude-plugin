#!/usr/bin/env node
/**
 * /omiroute:delegate - Delegate task to OmniRoute model
 */

import { OmniRouteClient } from '../lib/omniroute-client.mjs';
import { ModelSelector, TASK_TYPES } from '../lib/model-selector.mjs';
import { TaskManager } from '../lib/task-manager.mjs';
import { buildPrompt, getSystemPrompt } from '../lib/review-prompts.mjs';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help || !args.prompt) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  try {
    const client = OmniRouteClient.fromConfig();
    const selector = new ModelSelector(client);
    const taskManager = new TaskManager();

    // Get diff if provided
    let diff = args.diff;
    if (!diff && args.files) {
      diff = await getDiffFromFiles(args.files.split(','));
    }
    if (!diff && !args.background) {
      // Try to get git diff
      diff = await getGitDiff();
    }

    // Build prompt
    const taskType = args['task-type'] || TASK_TYPES.GENERAL_CODING;
    const prompt = buildPrompt(taskType, diff || '', {
      context: args.prompt,
      files: args.files ? args.files.split(',') : undefined,
      maxDiffLength: 50000
    });

    // Select model
    let model;
    if (args.model) {
      model = await client.getModel(args.model);
      if (!model) {
        throw new Error(`Model ${args.model} not found`);
      }
    } else {
      model = await selector.selectBestModel(taskType, {
        provider: args.provider,
        verbose: args.verbose
      });
    }

    console.log(`🤖 Using model: ${model.id} (${model.provider || 'unknown'})`);

    // Prepare messages
    const messages = [
      { role: 'system', content: getSystemPrompt(getRoleForTaskType(taskType)) },
      { role: 'user', content: prompt }
    ];

    const params = {
      model: model.id,
      messages,
      temperature: parseFloat(args.temperature) || 0.3,
      max_tokens: parseInt(args['max-tokens']) || 8192,
      stream: args.stream !== 'false'
    };

    // Background mode
    if (args.background) {
      const task = taskManager.createTask({
        type: 'delegate',
        prompt: args.prompt,
        model: model.id,
        options: params,
        metadata: { taskType, diff: !!diff }
      });
      
      console.log(`📋 Background task created: ${task.id}`);
      console.log(`   Run: /omiroute:status ${task.id} to check progress`);
      console.log(`   Run: /omiroute:result ${task.id} to get result`);
      
      // Start background execution
      executeBackground(task.id, client, params, taskManager);
      return;
    }

    // Foreground execution
    if (params.stream) {
      await streamResponse(client, params);
    } else {
      const response = await client.chatCompletions(params);
      printResponse(response);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = { prompt: '' };
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
    } else {
      args.prompt += (args.prompt ? ' ' : '') + arg;
    }
  }
  
  return args;
}

function printUsage() {
  console.log(`
Usage: /omiroute:delegate [options] "prompt"

Options:
  --prompt, -p          Task prompt (required)
  --model, -m           Specific model ID
  --provider            Filter by provider
  --task-type           Task type (default: general_coding)
  --files               Comma-separated files for context
  --diff                Git diff to review
  --background, -b      Run in background
  --temperature         Sampling temperature (default: 0.3)
  --max-tokens          Max response tokens (default: 8192)
  --stream              Stream response (default: true)
  --verbose, -v         Verbose model selection
  --help, -h            Show help

Task Types:
  code_review, adversarial_review, security_audit, refactoring,
  debugging, documentation, testing, general_coding, architecture, quick_fix
`);
}

async function getGitDiff() {
  try {
    const { execSync } = await import('child_process');
    return execSync('git diff HEAD', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

async function getDiffFromFiles(files) {
  try {
    const { execSync } = await import('child_process');
    const fileArgs = files.map(f => `"${f}"`).join(' ');
    return execSync(`git diff HEAD -- ${fileArgs}`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

function getRoleForTaskType(taskType) {
  const roles = {
    [TASK_TYPES.CODE_REVIEW]: 'code_reviewer',
    [TASK_TYPES.ADVERSARIAL_REVIEW]: 'adversarial_reviewer',
    [TASK_TYPES.SECURITY_AUDIT]: 'security_auditor',
    [TASK_TYPES.ARCHITECTURE]: 'architect',
    [TASK_TYPES.TESTING]: 'test_engineer'
  };
  return roles[taskType] || 'code_reviewer';
}

async function streamResponse(client, params) {
  let fullContent = '';
  let firstChunk = true;
  
  for await (const chunk of client.chatCompletionsStream(params)) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      if (firstChunk) {
        process.stdout.write('\n');
        firstChunk = false;
      }
      process.stdout.write(delta);
      fullContent += delta;
    }
  }
  
  if (!firstChunk) {
    process.stdout.write('\n');
  }
}

function printResponse(response) {
  const content = response.choices?.[0]?.message?.content;
  if (content) {
    console.log('\n' + content + '\n');
  }
}

async function executeBackground(taskId, client, params, taskManager) {
  // Run in background (non-blocking)
  setImmediate(async () => {
    try {
      taskManager.startTask(taskId);
      const response = await client.chatCompletions(params);
      const content = response.choices?.[0]?.message?.content || '';
      taskManager.completeTask(taskId, content);
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  });
}

main();