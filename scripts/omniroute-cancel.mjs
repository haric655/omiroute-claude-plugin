#!/usr/bin/env node
/**
 * /omiroute:cancel - Cancel background task
 */

import { TaskManager } from '../lib/task-manager.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help || (!args['task-id'] && !args.all && !args._[0])) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const taskManager = new TaskManager();

  if (args.all) {
    const running = taskManager.getRunningTasks();
    const pending = taskManager.getPendingTasks();
    const toCancel = [...running, ...pending];
    
    if (!toCancel.length) {
      console.log('ℹ️  No running or pending tasks to cancel');
      return;
    }

    for (const task of toCancel) {
      taskManager.cancelTask(task.id);
      console.log(`⏸️  Cancelled: ${task.id} (${task.type})`);
    }
    return;
  }

  const taskId = args['task-id'] || args._[0];
  const task = taskManager.loadTask(taskId);

  if (!task) {
    console.error(`❌ Task ${taskId} not found`);
    process.exit(1);
  }

  if (!['running', 'pending'].includes(task.status)) {
    console.error(`❌ Task ${taskId} cannot be cancelled (status: ${task.status})`);
    process.exit(1);
  }

  taskManager.cancelTask(taskId);
  console.log(`⏸️  Cancelled: ${taskId}`);
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
Usage: /omiroute:cancel [options] <task-id>

Options:
  --task-id, -t    Task ID to cancel
  --all, -a        Cancel all running/pending tasks
  --help, -h       Show help
`);
}

main();