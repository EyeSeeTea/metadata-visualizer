# Metadata Visualizer

DHIS2 web app (React 18 + TypeScript + Vite) to explore and visualize metadata
relationships as interactive 2D/3D graphs.

## Installation

Requirements: Node 22 (see `.nvmrc`) and Yarn 4 (via `corepack`).

```
$ nvm use
$ corepack enable
$ yarn install
```

Copy `.env.example` to `.env.local` and configure the target DHIS2 instance
(`VITE_DHIS2_BASE_URL`, `DHIS2_AUTH`).

## Development

Start the development server:

```
$ yarn start
```

Open `http://localhost:8081`. Requests to DHIS2 are transparently proxied from
`/dhis2/...` to `VITE_DHIS2_BASE_URL` (see `vite.config.ts`) to avoid CORS issues.

## Build

Produce the distributable DHIS2 zip:

```
$ yarn build
```

The web build output is placed under `build/`. The `.zip` ready to upload via App
Management is written to the repository root.

## Tests

```
$ yarn test
```

## Features

The app is organized in two main tabs:

### 1. Instance Metadata

Live queries against the configured DHIS2 instance.

- Pick the **resource type**. Currently only the following types are supported:
  `dataElements`, `dataSets`, `categories`, `categoryCombos`, `categoryOptions`,
  `categoryOptionCombos`.
- Adjust **fields** and **filters** (standard DHIS2 API syntax, one filter per line or
  separated by `;`). Any top-level field you add to **fields** is automatically rendered
  as an additional column in the results table, so you can tailor the view to the
  attributes you care about.
- The table shows paginated results; selecting a row renders the dependency graph of
  that item on the right panel.
- Each row is prefixed with a deterministic **identicon avatar** derived from the item's
  type and UID, providing a stable visual fingerprint that makes metadata easier to scan
  and recognize across the table and graph views.

### 2. JSON Package

Load a metadata package exported as JSON (for example, from the DHIS2 import/export
module) and explore its relationships without needing a live instance.

- Upload the `.json`, filter by type / id / name and pick an item to view its graph.
- **Direct only** mode: shows just the references directly declared in the JSON.
- **Expanded** mode: follows references transitively within the package.

### Graph views

On both tabs the graph panel offers three visualization modes:

- **2D View** — flat layout, best for seeing the structure at a glance.
- **3D Tree** — 3D force-directed graph (based on `react-force-graph-3d`).
- **3D Timeline** — 3D layout grouping nodes by type / level.

Clicking a node in the graph selects it as the new focus and recomputes its
dependencies.

## Architecture

Clean Architecture with three layers (`src/domain`, `src/data`, `src/webapp`) and a
`CompositionRoot` as the single dependency-injection point. Use cases live under
`src/domain/usecases/`.

## i18n

After adding or modifying `i18n.t(...)` strings:

```
$ yarn extract-pot
$ yarn localize
```
