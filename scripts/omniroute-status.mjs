#!/usr/bin/env node
/**
 * /omiroute:status - Show background task status
 */

import { TaskManager } from '../lib/task-manager.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const taskManager = new TaskManager();

  // Specific task
  if (args['task-id'] || args._[0]) {
    const taskId = args['task-id'] || args._[0];
    const task = taskManager.loadTask(taskId);
    if (!task) {
      console.log(`❌ Task ${taskId} not found`);
      process.exit(1);
    }
    printTaskDetail(task);
    return;
  }

  // List tasks
  let tasks;
  if (args.running) {
    tasks = taskManager.getRunningTasks();
  } else if (args.all) {
    tasks = taskManager.listTasks();
  } else {
    tasks = taskManager.getRecentTasks(parseInt(args.limit) || 20);
  }

  if (!tasks.length) {
    console.log('📋 No background tasks found');
    return;
  }

  const running = tasks.filter(t => t.status === 'running').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const cancelled = tasks.filter(t => t.status === 'cancelled').length;

  console.log(`📋 Background Tasks (${tasks.length} shown, ${running} running, ${pending} pending, ${completed} completed, ${failed} failed, ${cancelled} cancelled)\n`);

  // Group by status
  const statusOrder = ['running', 'pending', 'completed', 'failed', 'cancelled'];
  const statusIcons = {
    running: '🟢',
    pending: '🟡',
    completed: '✅',
    failed: '❌',
    cancelled: '⏸️'
  };

  for (const status of statusOrder) {
    const statusTasks = tasks.filter(t => t.status === status);
    if (!statusTasks.length) continue;

    console.log(`${statusIcons[status]} ${status.toUpperCase()}`);
    for (const task of statusTasks) {
      const timeAgo = formatTimeAgo(task.createdAt);
      const model = task.model || 'unknown';
      console.log(`  ${task.id.slice(0, 8)}  ${task.type.padEnd(18)} ${timeAgo}  ${task.prompt?.slice(0, 50) || 'N/A'}`);
      console.log(`           model: ${model}`);
      if (task.error) {
        console.log(`           Error: ${task.error.slice(0, 80)}`);
      }
      if (task.result && status === 'completed') {
        console.log(`           Result: ${task.result.slice(0, 80)}...`);
      }
    }
    console.log('');
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
Usage: /omiroute:status [options] [task-id]

Options:
  --task-id, -t       Specific task ID
  --all, -a           Show all tasks
  --running, -r       Show only running tasks
  --limit, -l         Max tasks to show (default: 20)
  --help, -h          Show help
`);
}

function printTaskDetail(task) {
  console.log(`\n📋 Task: ${task.id}`);
  console.log(`   Type: ${task.type}`);
  console.log(`   Status: ${task.status}`);
  console.log(`   Model: ${task.model || 'N/A'}`);
  console.log(`   Created: ${new Date(task.createdAt).toLocaleString()}`);
  if (task.startedAt) console.log(`   Started: ${new Date(task.startedAt).toLocaleString()}`);
  if (task.completedAt) console.log(`   Completed: ${new Date(task.completedAt).toLocaleString()}`);
  console.log(`   Prompt: ${task.prompt?.slice(0, 100) || 'N/A'}`);
  
  if (task.error) {
    console.log(`\n❌ Error:\n${task.error}`);
  }
  
  if (task.result) {
    console.log(`\n✅ Result:\n${task.result}`);
  }
}

function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

main();