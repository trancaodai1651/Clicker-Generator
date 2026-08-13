# AGENTS.md

## Project Overview
- This is a single-repo TypeScript + Vite app with a Tauri v2 desktop shell in `src-tauri/`.
- Keep the existing clicker generator flow intact unless the task explicitly targets it.
- Long Row lives under `src/features/longRow/` and is treated as a separate feature path.

## Working Rules
- Prefer small, focused edits.
- Use `apply_patch` for file edits.
- Run `npm run typecheck` after code changes that affect TypeScript.
- Do not remove user changes unless explicitly requested.
- Preserve the current MVC-ish structure when adding new UI/features.

## Repo Layout
- `src/` for app code.
- `src/features/` for feature modules.
- `src-tauri/` for Tauri desktop build files.
- `public/` for static assets.

## Notes
- There is no monorepo package split today, so no per-package AGENTS files are needed yet.
