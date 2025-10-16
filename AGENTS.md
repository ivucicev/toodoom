# AGENTS GUIDE
1. **Install**: `npm install` (requires Node 20+, npm 10+).
2. **Dev servers**: `npm start`; run `./pocketbase serve` or `docker compose up --build`.
3. **Builds**: `npm run build`; use `build-prod` or `build-hosted` for release targets.
4. **Watch mode**: `npm run watch` rebuilds with development config.
5. **Unit tests**: `npm test`; add `--watch=false` for CI runs.
6. **Single spec**: `npm test -- --include=src/app/<feature>/<file>.spec.ts`.
7. **Docker server image**: `npm run build-docker-server` then `npm run run-docker-server`.
8. **Linting**: No Angular lint target; rely on TypeScript checks and review before PRs.
9. **Imports**: Angular packages first, then third-party, then relative paths; prefer named imports.
10. **Components**: Use standalone declarations with `imports: []`, selectors prefixed `app-`.
11. **State**: Favor Angular `signal()` stores; mutate via `.set` with cloned data.
12. **Types**: Reuse interfaces from `pocketbase.service.ts`; avoid `any` unless bridging PocketBase data.
13. **Error handling**: Wrap async calls in try/catch, log via `console.error`, notify with `ToastService`.
14. **Data access**: Route PocketBase operations through `PocketbaseService` to keep offline sync logic intact.
15. **Formatting**: Preserve repo style (tabs in TS/HTML, spaces in CSS, single quotes outside JSON).
16. **Naming**: PascalCase components/services, camelCase members, kebab-case CSS classes and filenames.
17. **Templates**: Keep template logic declarative; use `*ngFor`, `*ngIf`, and `[(ngModel)]` bindings consistently.
18. **Styling**: Extend gradients and CSS variables in `styles.css`; respect `data-theme` toggles in UI.
19. **External rules**: No Cursor or Copilot instructions present—follow this guide.
