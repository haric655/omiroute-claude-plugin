#!/usr/bin/env node
/**
 * /omiroute:background - Run task in background
 */

import { OmniRouteClient } from '../lib/omniroute-client.mjs';
import { ModelSelector, TASK_TYPES } from '../lib/model-selector.mjs';
import { TaskManager } from '../lib/task-manager.mjs';
import { buildPrompt, getSystemPrompt } from '../lib/review-prompts.mjs';
import { execSync } from 'child_process';

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

    const taskType = args['task-type'] || TASK_TYPES.GENERAL_CODING;
    const prompt = buildPrompt(taskType, diff || '', {
      context: args.prompt,
      files: args.files ? args.files.split(',') : undefined
    });

    // Select model
    let model;
    if (args.model) {
      model = await client.getModel(args.model);
      if (!model) throw new Error(`Model ${args.model} not found`);
    } else {
      model = await selector.selectBestModel(taskType, {
        provider: args.provider,
        verbose: args.verbose
      });
    }

    console.log(`🤖 Background task with: ${model.id}`);

    const messages = [
      { role: 'system', content: getSystemPrompt(getRoleForTaskType(taskType)) },
      { role: 'user', content: prompt }
    ];

    const params = {
      model: model.id,
      messages,
      temperature: 0.3,
      max_tokens: 16384,
      stream: true
    };

    // Create and start background task
    const task = taskManager.createTask({
      type: 'background',
      prompt: args.prompt,
      model: model.id,
      options: params,
      metadata: { taskType }
    });

    console.log(`📋 Task created: ${task.id}`);
    console.log(`   Status: /omiroute:status ${task.id}`);
    console.log(`   Result: /omiroute:result ${task.id}`);
    console.log(`   Cancel: /omiroute:cancel ${task.id}`);

    // Execute in background
    executeBackground(task.id, client, params, taskManager);

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
Usage: /omiroute:background [options] "prompt"

Options:
  --prompt, -p        Task prompt (required)
  --model, -m         Specific model ID
  --provider          Filter by provider
  --task-type         Task type (default: general_coding)
  --files             Comma-separated files for context
  --diff              Git diff for context
  --verbose, -v       Verbose model selection
  --help, -h          Show help
`);
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

async function getDiffFromFiles(files) {
  try {
    const fileArgs = files.map(f => `"${f}"`).join(' ');
    return execSync(`git diff HEAD -- ${fileArgs}`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

async function executeBackground(taskId, client, params, taskManager) {
  setImmediate(async () => {
    try {
      taskManager.startTask(taskId);
      let fullContent = '';
      for await (const chunk of client.chatCompletionsStream(params)) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) fullContent += delta;
      }
      taskManager.completeTask(taskId, fullContent);
      console.log(`\n✅ Background task ${taskId} completed`);
    } catch (error) {
      taskManager.failTask(taskId, error);
      console.error(`\n❌ Background task ${taskId} failed:`, error.message);
    }
  });
}

main();