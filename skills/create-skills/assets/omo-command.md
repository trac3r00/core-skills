---
description: Create reusable Agent Skills from source material using the create-skills workflow.
argument-hint: <source path or task description>
---

Read `~/.agents/skills/create-skills/SKILL.md`, resolving `~` to the current
user's home directory. Follow that skill for this request while respecting
higher-priority instructions. Resolve its referenced files relative to that
skill's directory and load them only when their stated conditions apply.

User request: $ARGUMENTS
