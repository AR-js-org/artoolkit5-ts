# Issue drafts for AR-js-org/artoolkit5-ts

Historical drafts, written before the repository existed. **All of them have been
filed.** The GitHub issues are the live record — these files are kept for their
design reasoning and are not updated.

> ⚠️ **Draft numbers are not issue numbers.** They diverge, and in two cases they
> cross over: draft `10` is issue #13, draft `11` is issue #12. Referring to a
> draft number as though it were an issue number is what put a reference to a
> nonexistent "#06" into issue #9. Always use the table below or the link in each
> file's header.

## Filed as

| Draft file | Filed as | State |
|---|---|---|
| `01-remove-logging.md` | [#3](https://github.com/AR-js-org/artoolkit5-ts/issues/3) | closed |
| `02-fix-typing-bugs.md` | [#4](https://github.com/AR-js-org/artoolkit5-ts/issues/4) | closed |
| `03-zero-allocation-hot-path.md` | [#5](https://github.com/AR-js-org/artoolkit5-ts/issues/5) | closed |
| `04-lifecycle-dispose.md` | [#6](https://github.com/AR-js-org/artoolkit5-ts/issues/6) | closed |
| `05-frame-result-lost.md` | [#7](https://github.com/AR-js-org/artoolkit5-ts/issues/7) | closed |
| `06-configure-detector.md` | [#8](https://github.com/AR-js-org/artoolkit5-ts/issues/8) | **open** |
| `07-barcode-markers.md` | [#9](https://github.com/AR-js-org/artoolkit5-ts/issues/9) | **open** |
| `08-verify-camera-lens.md` | [#10](https://github.com/AR-js-org/artoolkit5-ts/issues/10) | **open** |
| `09-worker-example.md` | [#11](https://github.com/AR-js-org/artoolkit5-ts/issues/11) | **open** |
| `10-tests-vitest.md` | [#13](https://github.com/AR-js-org/artoolkit5-ts/issues/13) | closed |
| `11-ci-workflow.md` | [#12](https://github.com/AR-js-org/artoolkit5-ts/issues/12) | closed |
| `12-readme-license-packaging.md` | [#14](https://github.com/AR-js-org/artoolkit5-ts/issues/14) | closed |
| `13-upstream-constants.md` | [artoolkit5-constants#2](https://github.com/AR-js-org/artoolkit5-constants/issues/2) | closed |

## Where the drafts are now out of date

The drafts were written against `@ar-js-org/artoolkit5-constants@0.1.0` and
reflect what was true then. Two of the still-open ones argue from premises that
have since been fixed:

- **`06-configure-detector.md` / #8** — argues for string unions on the grounds
  that the constants package lacks `AR_MATRIX_CODE_*` values and combined
  detection modes. `0.2.0` generates all of them. String unions remain the
  chosen design, but for ergonomic reasons rather than that one.
- **`07-barcode-markers.md` / #9** — records the combined-mode risk as the
  constants being ungenerated. They now exist; the real constraint is that
  `getMarkerInfo` does not bind `idPatt`/`idMatrix`, so pattern-vs-barcode
  cannot be read from the engine.

Both are superseded by [`docs/DESIGN-detector-and-barcode.md`](../DESIGN-detector-and-barcode.md),
which is the current design of record for that work.

## Not filed

The `getCameraMatrix` issue drafted at the end of
`.agents/Gemini-Ristrutturazione ARToolkit.js! Analisi Funzionale.md` is **moot** —
`getCameraLens` already provides that data. See D10 in
[`docs/DESIGN-v0.1.md`](../DESIGN-v0.1.md).
