# Issue drafts for AR-js-org/artoolkit5-ts

Ready to paste once the repository exists. Each file is a complete issue body.

Create them with:

```bash
gh issue create --repo AR-js-org/artoolkit5-ts --title "<title from the file>" --body-file docs/issues/01-remove-logging.md
```

## Suggested order

| # | File | Milestone | Blocks |
|---|---|---|---|
| 01 | `01-remove-logging.md` | v0.1 | — |
| 02 | `02-fix-typing-bugs.md` | v0.1 | — |
| 03 | `03-zero-allocation-hot-path.md` | v0.1 | 02 |
| 04 | `04-lifecycle-dispose.md` | v0.1 | — |
| 05 | `05-frame-result-lost.md` | v0.1 | 02 |
| 06 | `06-configure-detector.md` | v0.1 | — |
| 07 | `07-barcode-markers.md` | v0.1 | 06 |
| 08 | `08-verify-camera-lens.md` | v0.1 | spike |
| 09 | `09-worker-example.md` | v0.1 | 04 |
| 10 | `10-tests-vitest.md` | v0.1 | 02, 05, 06 |
| 11 | `11-ci-workflow.md` | v0.1 | 10 |
| 12 | `12-readme-license-packaging.md` | v0.1 | — |
| 13 | `13-upstream-constants.md` | upstream | filed on `artoolkit5-constants` |

## Do not file

The `getCameraMatrix` issue drafted at the end of `.agents/Gemini-Ristrutturazione ARToolkit.js! Analisi Funzionale.md` is **moot**. `getCameraLens` already provides that data. See D10 in `docs/DESIGN-v0.1.md`.
