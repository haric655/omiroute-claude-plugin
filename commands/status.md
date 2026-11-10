---
name: status
description: List background tasks or show specific task status
arguments:
  - name: task-id
    description: Specific task ID to check
    required: false
  - name: all
    description: Show all tasks including old ones
    required: false
    default: false
  - name: running
    description: Show only running tasks
    required: false
    default: false
  - name: limit
    description: Maximum tasks to show
    required: false
    default: 20
---

# /omiroute:status

Show status of background tasks.

## Usage

```bash
# List recent tasks
/omiroute:status

# Show only running tasks
/omiroute:status --running

# Show specific task
/omiroute:status <task-id>

# Show all tasks
/omiroute:status --all
```

## Output

```
📋 Background Tasks (5 total, 1 running)

🟢 RUNNING
  abc-123  background     2m ago   Refactor UserService
           model: anthropic/claude-3.5-sonnet

✅ COMPLETED
  def-456  adversarial_review  1h ago  Security audit auth module
           model: openai/o3-mini

❌ FAILED
  ghi-789  delegate        3h ago   Quick fix pagination
           Error: Model timeout

⏸️ CANCELLED
  jkl-012  background      1d ago   Generate tests
```