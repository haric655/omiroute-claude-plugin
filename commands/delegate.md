---
name: delegate
description: Delegate a coding task to an OmniRoute model
arguments:
  - name: prompt
    description: The task prompt for the model
    required: true
  - name: model
    description: Specific model to use (auto-selects best if omitted)
    required: false
  - name: provider
    description: Filter by provider (openai, anthropic, google, etc.)
    required: false
  - name: task-type
    description: Type of task for model selection
    required: false
    choices: [code_review, adversarial_review, security_audit, refactoring, debugging, documentation, testing, general_coding, architecture, quick_fix]
    default: general_coding
  - name: files
    description: Files to include as context (comma-separated)
    required: false
  - name: diff
    description: Git diff to review (for code review tasks)
    required: false
  - name: background
    description: Run in background
    required: false
    default: false
  - name: temperature
    description: Sampling temperature
    required: false
    default: 0.3
  - name: max-tokens
    description: Maximum tokens in response
    required: false
    default: 8192
  - name: stream
    description: Stream response
    required: false
    default: true
---

# /omiroute:delegate

Delegate a coding task to an OmniRoute model. The model is auto-selected based on task type unless specified.

## Usage

```bash
# General coding task
/omiroute:delegate "Refactor the authentication module to use JWT"

# Code review with diff
/omiroute:delegate --task-type code_review --diff "$(git diff HEAD~1)"

# Adversarial review
/omiroute:delegate --task-type adversarial_review --diff "$(git diff)"

# Security audit
/omiroute:delegate --task-type security_audit --files "src/auth/*,src/api/*"

# Background task
/omiroute:delegate --background "Write comprehensive tests for the payment module"

# Specific model
/omiroute:delegate --model "anthropic/claude-3.5-sonnet" "Explain this algorithm"
```

## Task Types

| Type | Best For | Model Preference |
|------|----------|------------------|
| `code_review` | Standard code review | Reasoning + Coding |
| `adversarial_review` | Aggressive security review | Reasoning models |
| `security_audit` | Security-focused review | Reasoning + Security |
| `refactoring` | Code restructuring | Coding models |
| `debugging` | Bug fixing | Coding + Reasoning |
| `documentation` | Writing docs | Coding models |
| `testing` | Test generation | Coding models |
| `general_coding` | General tasks | Coding models |
| `architecture` | System design | Reasoning + Coding |
| `quick_fix` | Small quick tasks | Fast models |

## Examples

```bash
# Review current changes
/omiroute:delegate --task-type code_review --diff "$(git diff)"

# Security audit of auth module
/omiroute:delegate --task-type security_audit --files "src/auth/**" "Audit for OWASP Top 10"

# Background refactoring
/omiroute:delegate --background --task-type refactoring "Extract service layer from controllers"

# Quick bug fix
/omiroute:delegate --task-type quick_fix "Fix off-by-one error in pagination"
```