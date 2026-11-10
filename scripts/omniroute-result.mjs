#!/usr/bin/env node
/**
 * /omiroute:result - Get background task result
 */

import { TaskManager } from '../lib/task-manager.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help || (!args['task-id'] && !args._[0])) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const taskId = args['task-id'] || args._[0];
  const taskManager = new TaskManager();
  const task = taskManager.loadTask(taskId);

  if (!task) {
    console.error(`❌ Task ${taskId} not found`);
    process.exit(1);
  }

  if (task.status !== 'completed') {
    console.error(`❌ Task ${taskId} is not completed (status: ${task.status})`);
    process.exit(1);
  }

  if (args.raw) {
    process.stdout.write(task.result || '');
  } else {
    console.log(`\n✅ Task Result: ${task.id}`);
    console.log(`   Type: ${task.type}`);
    console.log(`   Model: ${task.model || 'N/A'}`);
    console.log(`   Completed: ${task.completedAt ? new Date(task.completedAt).toLocaleString() : 'N/A'}`);
    console.log(`\n${'='.repeat(60)}\n`);
    console.log(task.result || '(empty result)');
    console.log(`\n${'='.repeat(60)}\n`);
  }
}

function parseArgs(argv) {
  const args = { _: [] };
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
      args._.push(arg);
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Usage: /omiroute:result [options] <task-id>

Options:
  --task-id, -t    Task ID
  --raw, -r        Output raw result
  --help, -h       Show help
`);
}

main();