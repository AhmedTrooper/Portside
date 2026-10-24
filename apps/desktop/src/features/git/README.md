# Git Feature Module

Placeholder for future git / source-control-management tooling integration.

## Planned layout

```
git/
├── README.md
├── GitPage.tsx            # dashboard at /git
├── repos/                 # cloned-repo browser + actions
├── commits/               # log viewer across selected repos
└── status/                # working-tree status per repo
```

Each sub-resource should mirror the `docker/containers/` and `docker/images/`
pattern:

- a thin page wrapper that hosts a heading and the table component
- a virtualized table with `<DropdownMenu>` for resource-specific actions
- backend commands in `src-tauri/src/git/<resource>.rs`, registered in
  `src-tauri/src/lib.rs` and re-exported through `src-tauri/src/git/mod.rs`

Until the first git feature ships, this directory contains only this README
and the `GitPage.tsx` placeholder below (so the route is wired but renders an
empty dashboard).
