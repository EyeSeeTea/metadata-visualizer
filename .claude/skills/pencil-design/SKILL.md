---
name: pencil-design
description: >
  Design skill using Pencil MCP for wireframes, mockups, and UI prototypes.
  Use when the user asks to design a screen, create a wireframe, produce a
  mockup, sketch a layout, or plan a UI before implementing it.
---

# UI Design with Pencil MCP

## About Pencil MCP

Pencil is a visual design tool accessed via MCP tools. It works with `.pen`
files and provides direct programmatic access to create, read, and modify
design nodes (frames, text, shapes, components, images). No GUI interaction
is needed — you design entirely through tool calls.

## Available Tools

| Tool                           | Purpose                                                    |
|--------------------------------|------------------------------------------------------------|
| `get_editor_state`             | Get the active `.pen` file, selection, and available components |
| `open_document`                | Open an existing `.pen` file or create a new one (`"new"`) |
| `get_guidelines`               | Get design rules for a topic (web-app, mobile-app, etc.)   |
| `get_style_guide_tags`         | Discover available style guide tags for inspiration         |
| `get_style_guide`              | Get a style guide by tags or name                          |
| `batch_get`                    | Read nodes by pattern search or node IDs                   |
| `batch_design`                 | Insert, copy, update, replace, move, delete, or generate image nodes |
| `snapshot_layout`              | Check computed layout rectangles of nodes                  |
| `get_screenshot`               | Take a screenshot of a node for visual validation          |
| `get_variables`                | Read variables and themes defined in the file              |
| `set_variables`                | Add or update variables                                    |
| `find_empty_space_on_canvas`   | Find empty canvas space for placing new designs            |
| `export_nodes`                 | Export nodes to PNG/JPEG/WEBP/PDF                          |
| `search_all_unique_properties` | Find all unique property values in a node tree             |
| `replace_all_matching_properties` | Bulk-replace properties across a node tree              |

## Design Workflow

### 1. Prepare

1. Call `get_editor_state(include_schema=true)` to load the schema and see
   available components.
2. If no `.pen` file is open, call `open_document("new")` to create one, or
   `open_document(path)` to open an existing one.
3. Call `get_guidelines(topic)` for the relevant topic (e.g., `"web-app"`).
4. Call `get_style_guide_tags` then `get_style_guide(tags)` for visual
   inspiration and consistency.

### 2. Design

1. Call `find_empty_space_on_canvas` to find placement coordinates.
2. Use `batch_design` to create frames, insert components, add text, etc.
   - Keep to ~25 operations per call maximum.
   - Use the component IDs from `get_editor_state` to copy reusable components.
3. Periodically call `get_screenshot` to visually validate your work.
4. Use `snapshot_layout` to verify positioning and dimensions.

### 3. Export

1. Use `export_nodes` to export completed designs to `openspec/designs/exports/`.
2. Follow the naming convention: `[feature]-[screen]-[state].[format]`

## Design Output Directories

```
openspec/designs/
├── wireframes/          # .pen files for low-fidelity layouts
├── mockups/             # .pen files for high-fidelity visuals
└── exports/             # Exported images (PNG/SVG/PDF)
```

## Integration with Project Design System

The Metadata Visualizer's visual language is anchored on three stacks:

1. **`@dhis2/ui`** — canonical DHIS2 components and tokens. Prefer these wherever they
   fit; they are already reflected in the DHIS2 design language.
2. **Material-UI v4 theme** — see `src/webapp/pages/app/` for the active theme (palette,
   spacing, typography).
3. **styled-components / styled-jsx** — bespoke visuals for the 3D graph and its
   overlays/controls.

Before designing, read the MUI theme and a couple of sibling components under
`src/webapp/components/` to understand established patterns. Use `get_variables` /
`set_variables` in Pencil to mirror the MUI theme palette and spacing scale so mockups
stay visually faithful to what the `[FE]` developer will actually render.

## Export Naming Convention

```
[feature]-[screen]-[state].[format]
```

Examples:
- `dashboard-overview-default.png`
- `settings-profile-loading.png`
- `auth-login-error-states.svg`
