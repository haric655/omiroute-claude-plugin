---
name: cancel
description: Cancel a running background task
arguments:
  - name: task-id
    description: Task ID to cancel
    required: true
  - name: all
    description: Cancel all running tasks
    required: false
    default: false
---

# /omiroute:cancel

Cancel a running or pending background task.

## Usage

```bash
# Cancel specific task
/omiroute:cancel <task-id>

# Cancel all running tasks
/omiroute:cancel --all
```