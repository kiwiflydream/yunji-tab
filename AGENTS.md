# Agent Instructions

## Check workflow

- Whenever the `check` skill is used, delegate at least one independent review to a subagent, including quick reviews and commit-only checks.
- The main agent remains responsible for validating subagent findings, applying any changes, running verification, and performing Git operations.
