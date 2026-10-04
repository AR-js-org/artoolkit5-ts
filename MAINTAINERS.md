# MAINTAINERS.md

Operational notes for cutting a release of `@ar-js-org/artoolkit5-ts`.

[`AGENTS.md`](AGENTS.md) covers the day-to-day: architecture, branching and the
commit convention. This file covers the parts that only come up at release
time, and the failure modes that have actually happened rather than the ones
that might.

## The release in one paragraph

Releases are cut by dispatching the **Release** workflow by hand, from `main`,
with a version number. The workflow does everything else: bumps `package.json`,
promotes the changelog, builds, commits, tags, creates the GitHub Release and
publishes to npm. You do not perform any of those steps yourself.

## Cutting a release

1. **Get the work onto `main`.** Open a PR from `dev` to `main` titled
   `Release X.Y.Z`. This is the one PR that targets `main`; everything else
   targets `dev`.

2. **Merge it with a merge commit.** Not squash, and preferably not rebase —
   see [Merge strategy](#merge-strategy-for-dev--main) for why each matters.

3. **Dispatch the Release workflow** from `main`, with the version without a
   leading `v`:

   ```bash
   gh workflow run release.yml --repo AR-js-org/artoolkit5-ts --ref main -f version=X.Y.Z
   ```

   Add `-f dry_run=true` to run every check and stop before anything is pushed
   or published.

4. **Re-sync `dev` from `main`** once it succeeds. See
   [After a release](#after-a-release).

## Things you must not do by hand

**Do not create the tag.** The workflow creates an annotated tag itself, on the
`chore(release): X.Y.Z` commit that it also creates. A hand-made tag causes two
problems at once: nothing happens when you push it, because **Release** is
`workflow_dispatch:` only and has no tag trigger; and the next dispatch fails
outright, because validation refuses to run when `refs/tags/vX.Y.Z` already
exists. A hand-made tag also points at the wrong commit — the release commit
does not exist until the workflow makes it, so the tag lands on a tree where
`package.json` still carries the previous version.

**Do not promote the changelog by hand.** `scripts/promote-changelog.mjs`
refuses to run when `CHANGELOG.md` already contains a `## [X.Y.Z]` section, so
adding one yourself fails `prepare` before it does anything. Leave the entries
under `## [Unreleased]`; the workflow renames that heading, opens a fresh empty
one above it and rewrites the link definitions at the bottom.

**Do not commit `dist/`.** It is gitignored and built during `prepare`. The
built tree is handed to the `release` job as a build artifact rather than
rebuilt there, so the tarball that `npm pack --dry-run` reports on is the one
that actually gets published.

## Merge strategy for `dev` → `main`

**Never squash.** `scripts/release-notes.mjs` builds the GitHub Release body
from `git log <previous-tag>..HEAD --no-merges`. Squashing replaces the
branch's history with a single commit, so a release containing five commits
would produce a one-line release body.

**Prefer a merge commit over rebase.** Both preserve the individual commits, so
both produce correct release notes. But rebase rewrites the commit SHAs as they
land on `main`, which leaves `dev` and `main` holding two sets of commits with
identical content and different identities. Git then reports them as having
diverged, and `dev` has to be reset onto `main` rather than fast-forwarded. A
merge commit keeps `dev`'s commits as ancestors of `main`, so the two branches
continue to share history.

## After a release

The `chore(release): X.Y.Z` commit is pushed to `main` only, so `dev` is left
behind by at least that commit, with a stale version in its `package.json`.
Re-sync it before starting the next branch, or that branch begins from a tree
that thinks it is on the previous version.

When `dev` and `main` share history, this is a fast-forward:

```bash
git checkout dev && git merge --ff-only origin/main && git push origin dev
```

If the release PR was rebase-merged, the branches have diverged and this fails.
Reset instead, which rewrites `dev` and therefore needs coordinating with
anyone else working on it:

```bash
git checkout dev && git reset --hard origin/main && git push --force-with-lease origin dev
```

## Preconditions the workflow enforces

`prepare` checks all of these and stops before changing anything if one fails:

| Check | Fails when |
| --- | --- |
| Run from `main` | dispatched from any other branch |
| Version is valid semver | malformed, or carries a leading `v` |
| Tag does not exist | `vX.Y.Z` was created by hand |
| Repository is public | npm cannot generate provenance from a private repo |
| Version not on npm | that version was already published — npm never allows a replacement |
| Typecheck, test, build | any of the three fails |

## Publishing

The workflow publishes through npm **trusted publishing**, which authenticates
over OIDC instead of with a token. The runner exchanges a short-lived OIDC
token for publish rights, scoped to this repository and this workflow filename
as registered on npmjs.com. There is no `NPM_TOKEN`, nothing to expire or
rotate, and nothing for the package's 2FA requirement to reject — that
requirement is what broke the 0.2.0 and 0.2.1 publishes.

Three consequences worth knowing:

- **Provenance is automatic.** `--provenance` is not passed, and should not be:
  publishing this way attests provenance on its own.
- **The `release` job runs Node 24.x while `prepare` runs 22.x.** That is not
  an oversight. Trusted publishing needs npm 11.5.1 or newer, and Node 22.x
  still ships npm 10.9.x. Nothing is built in `release` — it publishes a tree
  `prepare` already built and handed over — so the two jobs do not need to
  agree on a Node version.
- **The `release` job must not set `registry-url` on `actions/setup-node`.**
  It makes setup-node write an `.npmrc` line reading
  `_authToken=${NODE_AUTH_TOKEN}`. With no token in the environment that
  expands to empty, npm concludes authentication is already configured and
  never performs the OIDC exchange, failing with 403 or ENEEDAUTH.
  registry.npmjs.org is npm's default, so omitting it changes nothing else.
  npm's own example workflow still includes it, so this is easy to reintroduce
  by copying the docs — see actions/setup-node#1551 and npm/documentation#1960.

Registered publishers live on the package's settings page on npmjs.com:
organisation `AR-js-org`, repository `artoolkit5-ts`, and the **workflow
filename alone**, not the path. npm does not validate that configuration when it
is saved, so a wrong value is accepted silently and only surfaces as a failed
publish.

**Authorisation is per workflow filename**, so each workflow that publishes needs
its own entry — a package may have up to ten:

| Entry | Used by |
| --- | --- |
| `release.yml` | the normal release |
| `publish-tag.yml` | the recovery publish, see [Known failure modes](#known-failure-modes) |


## Known failure modes

### `403 Two-factor authentication is required ... but an automation token was specified`

**This should no longer happen.** The workflow no longer authenticates with a
token at all — see [Publishing](#publishing) above. The section is kept because
the failure is worth recognising if it returns, and because the recovery below
is still the fallback until trusted publishing has carried a release end to
end.

The publish step failed while everything before it succeeded. The cause was a
setting on the npm package rather than anything in this repository: publishing
access required 2FA, which rejects the automation token the workflow used to
authenticate with.

It was a regression rather than a permanent condition. 0.1.0 published from CI
without trouble on 2026-08-16 and carries a provenance attestation. Both 0.2.0
and 0.2.1 then failed at this step — 0.2.0 has no attestation on npm, which is
the fingerprint of a hand publish.

The state it leaves behind is the awkward one the workflow's own comments warn
about — the release commit, the tag and the GitHub Release have all been
pushed, and only the package is missing.

**To recover the current release**, dispatch the **Publish tag** workflow with
the tag that was already pushed:

```bash
gh workflow run publish-tag.yml --repo AR-js-org/artoolkit5-ts -f tag=vX.Y.Z
```

It does only the publish — no commit, no tag, no changelog promotion — so it is
safe against a tag that is already released. It checks the tag agrees with the
manifest and that the version is not already on npm, then builds from the tagged
tree and publishes. Crucially it publishes **with provenance**, which is the
whole reason not to fall back to doing it by hand.

> [!IMPORTANT]
> This needs **its own trusted publisher** on npmjs.com. npm authorises a
> publish per workflow filename, and the existing entry names `release.yml`, so
> a second entry naming `publish-tag.yml` is required — a package may have up to
> ten. Without it the publish is rejected however correct the workflow is.

**The hand publish is the last resort, not the first.** It works, and it is what
rescued 0.2.0 and 0.2.1:

```bash
git checkout main && git pull && npm ci && npm run build && npm publish --access public
```

But the package it produces carries **no provenance attestation** — npm only
generates those from a supported CI provider — which is why 0.2.0 and 0.2.1 have
none while 0.1.0 and 0.2.2 do. Reach for it only if the workflow route is itself
broken.

Re-running the release workflow is not a route back. After a partial failure the
release commit is already on `main`, so a re-run fails twice over: the tag now
exists, and the changelog has already been promoted. Recovering that way would
mean deleting the tag, deleting the GitHub Release and reverting the release
commit — which is why the publish-only workflow exists instead.

### The push to `main` is rejected

`main` is not protected today, so this cannot happen yet. When it does, the
error names the two causes, which need opposite responses: a non-fast-forward
means something landed on `main` after the run started and the workflow should
be re-run against the new tip; a protection rejection means `main` now blocks
direct pushes. See [Open items](#open-items).

The branch push is deliberately ordered before the tag push, so a rejection
leaves nothing tagged and nothing published, and the run can simply be retried.

## Dry runs, and what they cannot tell you

`dry_run: true` runs `prepare` in full and skips `release` entirely, as a whole
job rather than step by step. That covers every check, the version bump, the
changelog promotion, the build and the packed tarball.

It cannot cover anything in `release`, because that job does not run: the
commit, the tag, the push to `main`, the GitHub Release and the npm publish are
all unexercised. A dry run passing tells you the release is *prepared*
correctly, not that it will *publish* correctly — which is exactly why the npm
403 above was never caught before a real release.

That gap is now survivable rather than closed. The publish still cannot be
rehearsed, but a failure at that step no longer needs improvising: the recovery
publish is a workflow that was written in advance, which is the whole point of
having it ready before the release that needs it.

## Open items

- **[#22](https://github.com/AR-js-org/artoolkit5-ts/issues/22), part 2** —
  when `main` is eventually protected, the workflow's push will be rejected
  unless `github-actions[bot]` is exempted. The alternative, restructuring the
  workflow to open a pull request and tag once it merges, would turn an
  explicit dispatch into publish-on-merge and is not recommended. Part 1 of
  that issue, dry-run safety, was resolved structurally in #43.
