---
name: background
description: Run a long-running task in background via OmniRoute
arguments:
  - name: prompt
    description: Task prompt
    required: true
  - name: model
    description: Specific model to use
    required: false
  - name: task-type
    description: Type of task for model selection
    required: false
    choices: [code_review, adversarial_review, security_audit, refactoring, debugging, documentation, testing, general_coding, architecture, quick_fix]
    default: general_coding
  - name: files
    description: Files to include as context
    required: false
  - name: diff
    description: Git diff for context
    required: false
---

# /omiroute:background

Run a long-running coding task in the background via OmniRoute. Use for tasks that take minutes (refactoring, test generation, documentation, etc.).

## Usage

```bash
# Generate tests in background
/omiroute:background "Write comprehensive unit tests for src/services/payment.ts"

# Refactor in background
/omiroute:background --task-type refactoring "Extract repository pattern from UserController"

# Documentation in background
/omiroute:background --task-type documentation "Generate API docs for all endpoints"

# With specific files context
/omiroute:background --files "src/**/*.ts" "Add JSDoc comments to all public functions"
```

## Managing Background Tasks

```bash
# List all tasks
/omiroute:status

# Check specific task
/omiroute:status <task-id>

# Get result when done
/omiroute:result <task-id>

# Cancel running task
/omiroute:cancel <task-id>
```

## Task Lifecycle

```
pending → running → completed/failed/cancelled
```

Results are stored locally and persist across sessions.