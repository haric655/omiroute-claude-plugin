/**
 * Task Manager for Background Tasks
 * Persists task state to disk for background execution tracking
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const TASKS_DIR = join(homedir(), '.omiroute', 'tasks');

export class TaskManager {
  constructor() {
    if (!existsSync(TASKS_DIR)) {
      mkdirSync(TASKS_DIR, { recursive: true });
    }
  }

  /**
   * Create a new background task
   */
  createTask(params) {
    const task = {
      id: randomUUID(),
      type: params.type || 'delegate',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: params.prompt,
      model: params.model,
      options: params.options || {},
      result: null,
      error: null,
      metadata: params.metadata || {}
    };

    this.saveTask(task);
    return task;
  }

  /**
   * Save task to disk
   */
  saveTask(task) {
    task.updatedAt = new Date().toISOString();
    const filePath = join(TASKS_DIR, `${task.id}.json`);
    writeFileSync(filePath, JSON.stringify(task, null, 2));
  }

  /**
   * Load task from disk
   */
  loadTask(taskId) {
    const filePath = join(TASKS_DIR, `${taskId}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Update task status
   */
  updateTask(taskId, updates) {
    const task = this.loadTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    Object.assign(task, updates);
    this.saveTask(task);
    return task;
  }

  /**
   * Mark task as running
   */
  startTask(taskId) {
    return this.updateTask(taskId, { status: 'running', startedAt: new Date().toISOString() });
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId, result) {
    return this.updateTask(taskId, {
      status: 'completed',
      result,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Mark task as failed
   */
  failTask(taskId, error) {
    return this.updateTask(taskId, {
      status: 'failed',
      error: error.message || String(error),
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Cancel task
   */
  cancelTask(taskId) {
    return this.updateTask(taskId, {
      status: 'cancelled',
      completedAt: new Date().toISOString()
    });
  }

  /**
   * List all tasks (optionally filtered by status)
   */
  listTasks(filter = {}) {
    const files = readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
    const tasks = files.map(file => {
      try {
        return JSON.parse(readFileSync(join(TASKS_DIR, file), 'utf-8'));
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Sort by createdAt descending
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply filters
    if (filter.status) {
      return tasks.filter(t => t.status === filter.status);
    }
    if (filter.type) {
      return tasks.filter(t => t.type === filter.type);
    }
    if (filter.limit) {
      return tasks.slice(0, filter.limit);
    }

    return tasks;
  }

  /**
   * Get recent tasks
   */
  getRecentTasks(limit = 20) {
    return this.listTasks({ limit });
  }

  /**
   * Get running tasks
   */
  getRunningTasks() {
    return this.listTasks({ status: 'running' });
  }

  /**
   * Get pending tasks
   */
  getPendingTasks() {
    return this.listTasks({ status: 'pending' });
  }

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(maxAgeDays = 30) {
    const tasks = this.listTasks();
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const task of tasks) {
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        const completedAt = task.completedAt ? new Date(task.completedAt).getTime() : 0;
        if (completedAt && completedAt < cutoff) {
          const filePath = join(TASKS_DIR, `${task.id}.json`);
          try {
            import('fs').then(fs => fs.unlinkSync(filePath));
            cleaned++;
          } catch {
            // Ignore
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * Get task directory path
   */
  static getTasksDir() {
    return TASKS_DIR;
  }
}

export default TaskManager;