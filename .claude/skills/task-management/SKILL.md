---
name: task-management
description: >
  Project management skill for creating and managing tasks in the issue tracker
  from OpenSpec artifacts. Use whenever creating tasks, updating status, planning
  sprints, or coordinating work between development agents. Trigger on any
  mention of tickets, tasks, sprint planning, or project tracking.
---

# Issue Tracker Task Management

> **Tracker**: not yet wired to a specific MCP integration. Current workflow is to create
> tasks either (a) as GitHub Issues on the `EyeSeeTea/metadata-visualizer` repo via `gh`,
> or (b) in whichever tracker the team has active (ClickUp / Jira / Linear). Update this
> section once the canonical tracker is decided and enable the corresponding MCP tools in
> `project-manager.md`.

## Creating Tasks from OpenSpec

When given an OpenSpec change proposal:

1. Read `openspec/changes/<change-name>/tasks.md` for the task breakdown
2. Read `openspec/changes/<change-name>/design.md` for technical context
3. For each task, create a task in the issue tracker with:
   - **Name**: `[ROLE] Task description`
   - **Description**: Include acceptance criteria from the spec
   - **Priority**: Based on dependency order (blocking tasks = high)
   - **Assignee**: Map to the appropriate agent role
   - **Tags**: Feature name, sprint number

## Role-to-Assignee Mapping

| Role Tag | Agent | Task Type |
|----------|-------|-----------|
| [FE]     | frontend-developer | Webapp components, pages, hooks, view logic |
| [DI]     | dhis2-integration-developer | Domain entities, use cases, DHIS2 repository adapters |
| [GD]     | graphical-designer | Wireframes, mockups, design tokens, visual specs |
| [CR]     | code-reviewer | PR review, architecture audit |
| [PM]     | project-manager | Task coordination, sprint planning |

There is no `[BE]` or `[DB]` role in this project — DHIS2 is the backend and there is no
custom database.

## Task Dependencies
Create tasks in dependency order:
1. `[DI]` domain + repositories → `[DI]` use cases → `[FE]` webapp wiring
2. `[GD]` wireframes → `[GD]` mockups → `[FE]` implementation
3. Both tracks can run in parallel when the UI depends on use cases that already exist.

## Task Structure Strategy
Choose the structure based on feature complexity:

**Simple features** (roughly 5 or fewer tasks):
- Create ONE parent issue named: `[Feature name] - Brief description`
- Create subtasks under it for each individual task from tasks.md
- Subtask names: `[ROLE] Task description`

**Complex features** (more than 5 tasks, or multiple parallel tracks):
- Create multiple standalone issues
- Every issue title MUST include the feature name as a prefix so they can be filtered together
- Format: `[Feature name] [ROLE] Task description`

When in doubt, prefer the simple approach (parent + subtasks).

## Project Structure Notes

- Source OpenSpec artifacts live under `openspec/changes/<change-name>/` — always link the
  created task to the corresponding change directory.
- Tasks that produce user-facing changes must reference the DHIS2 version(s) the feature
  is being verified against.
- When a task depends on `[DI]` work (new repository / use case), link it explicitly as a
  blocker of the `[FE]` task that will consume it.
