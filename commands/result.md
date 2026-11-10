---
name: result
description: Get result of a completed background task
arguments:
  - name: task-id
    description: Task ID to get result for
    required: true
  - name: raw
    description: Output raw result without formatting
    required: false
    default: false
---

# /omiroute:result

Get the result of a completed background task.

## Usage

```bash
# Get formatted result
/omiroute:result <task-id>

# Get raw result (for piping)
/omiroute:result <task-id> --raw
```