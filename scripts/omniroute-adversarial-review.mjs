#!/usr/bin/env node
/**
 * /omiroute:adversarial-review - Aggressive adversarial code review
 */

import { OmniRouteClient } from '../lib/omniroute-client.mjs';
import { ModelSelector, TASK_TYPES } from '../lib/model-selector.mjs';
import { TaskManager } from '../lib/task-manager.mjs';
import { buildPrompt, getSystemPrompt } from '../lib/review-prompts.mjs';
import { execSync } from 'child_process';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  try {
    const client = OmniRouteClient.fromConfig();
    const selector = new ModelSelector(client);
    const taskManager = new TaskManager();

    // Get diff
    let diff = args.diff;
    if (!diff && args.files) {
      diff = await getDiffFromFiles(args.files.split(','));
    }
    if (!diff) {
      diff = await getGitDiff();
    }

    if (!diff.trim()) {
      console.log('ℹ️  No changes to review');
      return;
    }

    // Build adversarial prompt with focus areas
    let prompt = buildPrompt(TASK_TYPES.ADVERSARIAL_REVIEW, diff, {
      files: args.files ? args.files.split(',') : undefined
    });

    if (args.focus) {
      const focusAreas = args.focus.split(',').map(f => f.trim());
      prompt += `\n\n**FOCUS AREAS:** ${focusAreas.join(', ')}`;
    }

    // Select best reasoning model
    let model;
    if (args.model) {
      model = await client.getModel(args.model);
      if (!model) throw new Error(`Model ${args.model} not found`);
    } else {
      model = await selector.selectBestModel(TASK_TYPES.ADVERSARIAL_REVIEW, {
        provider: args.provider,
        requiredCapabilities: ['reasoning'],
        verbose: args.verbose
      });
    }

    console.log(`🔍 Adversarial review with: ${model.id} (${model.provider || 'unknown'})`);

    const messages = [
      { role: 'system', content: getSystemPrompt('adversarial_reviewer') },
      { role: 'user', content: prompt }
    ];

    const params = {
      model: model.id,
      messages,
      temperature: 0.1, // Low temp for consistent analysis
      max_tokens: 16384,
      stream: !args.background
    };

    if (args.background) {
      const task = taskManager.createTask({
        type: 'adversarial_review',
        prompt: 'Adversarial code review',
        model: model.id,
        options: params,
        metadata: { diff: diff.slice(0, 1000), focus: args.focus }
      });
      
      console.log(`📋 Background review started: ${task.id}`);
      console.log(`   Check: /omiroute:status ${task.id}`);
      console.log(`   Result: /omiroute:result ${task.id}`);
      
      executeBackground(task.id, client, params, taskManager);
      return;
    }

    // Stream response
    await streamResponse(client, params);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const args = { diff: '', files: '' };
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
Usage: /omiroute:adversarial-review [options]

Options:
  --diff              Git diff to review
  --files             Comma-separated files
  --model             Specific model ID
  --provider          Filter by provider
  --background, -b    Run in background
  --focus             Focus areas (auth,injection,crypto,race,dos,deserialization,access-control,secrets,dependencies)
  --severity          Minimum severity (critical,high,medium,low)
  --verbose, -v       Verbose model selection
  --help, -h          Show help
`);
}

async function getGitDiff() {
  try {
    return execSync('git diff HEAD', { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

async function getDiffFromFiles(files) {
  try {
    const fileArgs = files.map(f => `"${f}"`).join(' ');
    return execSync(`git diff HEAD -- ${fileArgs}`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
  } catch {
    return '';
  }
}

async function streamResponse(client, params) {
  let firstChunk = true;
  for await (const chunk of client.chatCompletionsStream(params)) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      if (firstChunk) {
        process.stdout.write('\n');
        firstChunk = false;
      }
      process.stdout.write(delta);
    }
  }
  if (!firstChunk) process.stdout.write('\n');
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
    } catch (error) {
      taskManager.failTask(taskId, error);
    }
  });
}

main();