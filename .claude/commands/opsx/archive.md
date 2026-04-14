---
name: "OPSX: Archive"
description: Archive a completed change
category: Workflow
tags: [workflow, archive]
---

Archive a completed change.

**Input**: Optionally specify a change name after `/opsx:archive` (e.g., `/opsx:archive add-auth`). If omitted, prompt for selection.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use **AskUserQuestion tool**.

   **IMPORTANT**: Do NOT guess or auto-select. Always let the user choose.

2. **Check artifact completion**: `openspec status --change "<name>" --json`

   If any artifacts are not `done`: display warning, confirm with user.

3. **Check task completion**

   Read tasks file, count `- [ ]` vs `- [x]`.
   If incomplete: display warning, confirm with user.

4. **Assess delta spec sync state**

   Check for delta specs at `openspec/changes/<name>/specs/`.
   If they exist, compare with main specs and show summary.
   Offer sync before archiving.

5. **Perform the archive**

   ```bash
   mkdir -p openspec/changes/archive
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. **Display summary**

**Guardrails**
- Always prompt for change selection if not provided
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive
- Show clear summary of what happened
