# DevOpsEasy - Progress Tracker

## Global Architecture
- [x] Integrate Rust Tauri backend with Vite + React + TypeScript
- [x] Configure `@astryxdesign/core` components and tokens
- [x] Implement `GlobalState` engine in Rust for polling backend tools
- [x] Configure 60-second polling interval for `global-state-updated` events
- [x] Move to Frameless UI (`decorations: false`) with custom Draggable Titlebar

## Docker Features
- [x] Connect Docker CLI JSON output to GlobalState
- [x] Docker dashboard with live resource counts and routing
- [x] Live container card grid with auto-refresh and search
- [x] Standalone container lifecycle actions (start, stop, restart, pause, unpause, remove)
- [x] Image card grid (pull, remove, force remove, streaming progress)
- [x] Network card grid (create with driver selection, remove)
- [x] Volume card grid (create, remove, prune)
- [x] Docker Compose projects (list, deploy, up, stop, restart, down)
- [x] Compose-managed containers and networks are protected from individual actions

## UI/UX Enhancements
- [x] Create Custom Draggable Titlebar with Window Controls (Minimize, Maximize, Close)
- [x] Integrate Framer Motion for draggable widgets
- [x] Sidebar navigation with Collapsible state
- [x] Migrate to strict component-based layouts (Astryx rules)
- [x] Responsive card-grid layouts for every Docker resource
- [x] Add loading skeletons for data fetching

## Future Integrations
- [ ] AWS Tooling
- [ ] Git / Source Control Management
