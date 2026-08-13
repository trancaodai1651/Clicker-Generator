# AGENTS.md

## Scope
- This folder contains the Tauri v2 desktop shell for the Clicker Generator app.
- Keep desktop-specific changes here; keep frontend app logic in `src/`.

## Working Rules
- Prefer minimal Rust changes.
- Keep Tauri config aligned with the Vite frontend build.
- Run `npm run typecheck` after frontend changes and `cargo check` or `tauri build` checks if Rust code changes.
- Do not add desktop-only behavior unless the task explicitly needs it.

## Layout
- `src/main.rs` for the Tauri entrypoint.
- `tauri.conf.json` for app/window/bundle config.
- `Cargo.toml` for Rust dependencies and build config.

## Notes
- This is a single desktop package, not a monorepo package boundary.
