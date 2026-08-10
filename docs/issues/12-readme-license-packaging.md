**Title:** docs: add README, LICENSE, and fix package metadata for publication

## README

Missing entirely. Needs:

- What it is, and where it sits in the AR.js-next stack
- Install, quick start, full API reference
- The data-oriented rationale (condensed from `AGENTS.md`)
- Lifecycle: create → configure → load markers → process → dispose
- Worker usage (#09)
- `ImageBitmap` → pixels recipe, since `processFrame` takes RGBA bytes only and the helper is deferred to v0.2 (D8)
- Roadmap and current limitations (no NFT, no multi-marker)
- CI badge

## LICENSE — done

MIT, `Copyright (c) 2026 AR-js-org`, following [AR.js's LICENSE](https://github.com/AR-js-org/AR.js/blob/master/LICENSE) convention of attributing the organisation rather than an individual.

Per-file headers are applied to all `.ts` files in `src/` and `examples/` from `.agents/skills/license-header-adder/`.

Both the LICENSE and the header disclose the **ARToolkit5 (WebARKitLib) LGPLv3 lineage** — this library wraps a WASM build of ARToolkit5 (WebARKitLib), and downstream users need to understand what they are shipping. The README licence section should repeat it.

## package.json fixes

1. **`three` is in `dependencies`** but `src/` never imports it — it is used only by `examples/`. Move it to `devDependencies`. If a renderer integration is ever added, it becomes a `peerDependency`, never a hard one.
2. **`@ar-js-org/artoolkit5-wasm` is a pinned git commit URL.** Move it to `^0.1.2` — the package was published to npm on 2026-08-09 (MIT), so this is now unblocked. Consider whether it belongs in `dependencies` or `peerDependencies`: it is already `external` in the Vite config, and making it a peer lets consumers control which engine build they ship.
3. Add `repository`, `bugs`, `homepage`, `keywords`, `license`, `author`.
4. Verify the `files` array and `exports` map produce a correct package (`npm pack --dry-run`).

## Acceptance

- [ ] README, LICENSE present
- [ ] LGPLv3 lineage disclosed
- [ ] `three` out of runtime dependencies
- [ ] `npm pack --dry-run` output reviewed
