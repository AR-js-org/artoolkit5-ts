**Title:** ci: add GitHub Actions for build, typecheck, lint and test

## Proposal

`.github/workflows/ci.yml`, triggered on push and PR to `dev` and `main`:

```yaml
strategy:
  matrix:
    node: [20, 22]
steps:
  - npm ci
  - npm run lint
  - npm run typecheck   # tsc --noEmit
  - npm test
  - npm run build
```

## Note on `npm ci`

Until `@ar-js-org/artoolkit5-wasm` resolves on npm (see #12, Risk R1), the dependency is a pinned git commit URL. `npm ci` handles git dependencies, but the checkout must have network access to GitHub — fine on hosted runners. Revisit once the package is on the registry.

## Also add

- ESLint + Prettier config aligned with `arjs-plugin-artoolkit` (both use ESLint, Prettier, husky)
- `no-console` rule scoped to `src/` so #01 cannot regress

## Acceptance

- [ ] CI green on `dev`
- [ ] Lint, typecheck, test, build all run
- [ ] Status badge in the README
