# GSTLST

GSTLST is an installable web app (PWA) where ravers check in to events and the DJ sets they saw, rate them and share them with friends: Untappd for electronic music. It starts as an invite-only beta for about 10 friends on GitHub Pages and may launch publicly later. Running costs must stay at 0 €, so never add a paid service.

The full specification is in [docs/SPEC.md](docs/SPEC.md). Read the relevant chapters before starting work, and ask instead of guessing when something is unclear or contradictory.

## Folder structure

- `src/app/`: app shell, router, bottom navigation, shared page layouts
- `src/features/<feature>/`: everything belonging to one feature, with its tests next to the code
- `src/lib/`: shared clients and setup (Supabase, i18n, TanStack Query)
- `src/locales/`: UI text, one JSON file per language
- `src/styles/index.css`: design tokens as CSS variables, mapped to the Tailwind theme
- `public/`: generated icons and splash screens (`npm run brand`)
- `e2e/`: Playwright tests
- `scripts/`: build and generator scripts
- `.github/workflows/`: deploy to GitHub Pages, Supabase keep-alive

## Conventions

- TypeScript strict, no `any`.
- Features live in `src/features/<feature>`.
- All UI text goes through i18n, with every key in both `en.json` and `de.json`.
- Mobile-first, touch targets at least 48 px (`min-h-touch`, `size-touch`).
- Use the design tokens instead of hard-coded colors. Red is for own actions, blue for social, both together only in brand moments.
- Everything is in English: code, comments, commits, docs.
- Fonts are self-hosted, and nothing loads from a third-party CDN.
- Respect `prefers-reduced-motion`, and no flashing effects.

## Commands

```bash
npm run dev         # dev server at http://localhost:5173/gstlst/
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest unit tests
npm run test:e2e    # Playwright (builds and serves the app itself)
npm run build       # production build in dist/, including the 404.html SPA fallback
npm run preview     # serve the production build locally
npm run brand       # regenerate logo, icons and splash screens
```

Deployment happens through GitHub Actions on every push to `main`.
