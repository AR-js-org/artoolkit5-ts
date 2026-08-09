---
name: license-header-adder
description: Adds the artoolkit5-ts MIT license header to source files. Use when creating new source files, or when auditing the repository for files missing a header.
---

# License Header Adder

Applies the project's MIT license header to source files in `artoolkit5-ts`.

The project lands in [AR-js-org](https://github.com/AR-js-org) and follows [AR.js's licence](https://github.com/AR-js-org/AR.js/blob/master/LICENSE).

## Template

`resources/HEADER.txt`. Replace `{{FILENAME}}` with the target file's **basename** (`tracking.ts`, not `src/tracking.ts`) before inserting.

## Applies to

- `.ts` files in `src/`
- `.ts` files in `examples/`

## Rules

1. **Insert at the very top of the file**, followed by one blank line before the first line of code.
2. **Skip files that already have a license header.** Detect this by checking whether the first block comment contains `Copyright (c)`. Never stack a second header.
3. **Do not modify** `node_modules/`, `dist/`, `public/`, `.agents/`, or any vendored code.
4. **Do not apply to** `.json`, `.md`, `.html`, or data files (`.patt`, `.dat`).
5. **Config files** (`vite.config.ts`, `tsconfig*.json`) are out of scope — they carry no meaningful authorship.
6. **Year**: the template is fixed at `2026`. Do not bump it per-file on edit; update the template and reapply repo-wide when the project's copyright year changes.
7. **Author line**: keep `Walter Perdan @kalwalt` unless a file has a different principal author, in which case add them rather than replacing.

## Copyright attribution

The copyright holder is **`AR-js-org`** — the organisation, not an individual. Individual credit belongs on the `Author(s):` line.

Note this deliberately differs from `AR-js-org/AR.js`, whose LICENSE reads `Copyright (c) 2020 AR.js`. New projects in the organisation attribute the org itself.

## Note on the ARToolkit5 (WebARKitLib) lineage

The header states that this library wraps a WebAssembly build of ARToolkit5 (WebARKitLib), which is LGPLv3. Keep that paragraph, and keep that exact wording: the MIT licence covers this TypeScript code, not the underlying engine, and downstream users need to know what they are shipping.
