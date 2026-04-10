---
name: "OPSX: Apply"
description: Implement tasks from an OpenSpec change
category: Workflow
tags: [workflow, artifacts]
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name (e.g., `/opsx:apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` and use **AskUserQuestion tool**

   Always announce: "Using change: <name>"

2. **Check status**: `openspec status --change "<name>" --json`

3. **Get apply instructions**: `openspec instructions apply --change "<name>" --json`

   **Handle states:**
   - `state: "blocked"` -> show message, suggest `/opsx:propose`
   - `state: "all_done"` -> congratulate, suggest `/opsx:archive`
   - Otherwise -> proceed

4. **Read context files** from `contextFiles` in apply instructions output

5. **Show progress**: Schema, N/M tasks complete, remaining overview

6. **Implement tasks** (loop until done or blocked)

   For each pending task:
   - Show which task is being worked on
   - Make code changes
   - Mark complete: `- [ ]` -> `- [x]`
   - Continue to next

   **Pause if:** unclear task, design issue discovered, error/blocker, user interrupts

7. **On completion or pause, show status**

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting
- If task is ambiguous, pause and ask
- Keep code changes minimal and scoped
- Update task checkbox immediately after completing
- Use contextFiles from CLI output, don't assume specific file names
