---
name: adversarial-review
description: Aggressive adversarial code review via OmniRoute reasoning models
arguments:
  - name: diff
    description: Git diff to review (defaults to git diff HEAD)
    required: false
  - name: files
    description: Files to review (comma-separated)
    required: false
  - name: model
    description: Specific reasoning model to use
    required: false
  - name: provider
    description: Filter by provider
    required: false
  - name: background
    description: Run in background
    required: false
    default: false
  - name: focus
    description: Focus areas (comma-separated)
    required: false
  - name: severity
    description: Minimum severity to report
    required: false
    choices: [critical, high, medium, low]
    default: medium
---

# /omiroute:adversarial-review

Run an aggressive adversarial code review using the best reasoning models via OmniRoute. This review thinks like an attacker to find vulnerabilities, edge cases, and logic flaws that standard reviews miss.

## Usage

```bash
# Review current changes
/omiroute:adversarial-review

# Review specific files
/omiroute:adversarial-review --files "src/auth/*,src/api/*"

# Review specific diff
/omiroute:adversarial-review --diff "$(git diff main..feature)"

# Background review
/omiroute:adversarial-review --background

# Focus on specific areas
/omiroute:adversarial-review --focus "auth,injection,crypto"

# Only critical/high issues
/omiroute:adversarial-review --severity high
```

## Focus Areas

| Area | Checks |
|------|--------|
| `auth` | Authentication bypass, session fixation, token issues |
| `injection` | SQLi, XSS, command injection, LDAP injection |
| `crypto` | Weak algorithms, key management, randomness |
| `race` | Race conditions, TOCTOU, double-spend |
| `dos` | Resource exhaustion, ReDoS, infinite loops |
| `deserialization` | Unsafe deserialization, gadget chains |
| `access-control` | IDOR, privilege escalation, broken RBAC |
| `secrets` | Hardcoded keys, tokens in code/logs |
| `dependencies` | Vulnerable deps, supply chain |

## Example Output

```
🚨 CRITICAL VULNERABILITIES
- SQL Injection in UserRepository.findByEmail() line 42: unsanitized input in raw query
- Auth bypass in /api/admin: missing role check allows user->admin escalation

⚠️ HIGH RISK
- Path traversal in FileController.download() line 18: ../ sequence not validated
- Weak JWT secret: hardcoded "secret" in config line 5

🔍 MEDIUM RISK
- Potential ReDoS in regex validation line 88
- Missing rate limiting on /api/auth/login

💡 DEFENSIVE RECOMMENDATIONS
- Use parameterized queries everywhere
- Implement proper RBAC middleware
- Rotate JWT secrets, use env vars
- Add rate limiting with Redis
```