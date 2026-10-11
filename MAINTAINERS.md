# MAINTAINERS.md

Operational notes for cutting a release of `@ar-js-org/artoolkit5-ts`.

[`AGENTS.md`](AGENTS.md) covers the day-to-day: architecture, branching and the
commit convention. This file covers the parts that only come up at release
time, and the failure modes that have actually happened rather than the ones
that might.

## The release in one paragraph

**Pushing the tag is the release.** The version bump and the changelog come in
through an ordinary pull request into `dev`, that reaches `main` through the
usual release PR, and pushing `vX.Y.Z` on the merge commit triggers the
**Release** workflow, which creates the GitHub Release and publishes to npm.
Nothing pushes to a branch on your behalf.

This is the process every AR-js-org package follows
([arjs-dev-tools#8](https://github.com/AR-js-org/arjs-dev-tools/issues/8)),
with `arjs-plugin-artoolkit` as its reference. It replaced a dispatch that
committed the bump and pushed it straight to `main`, which is why `main` here
could not carry the pull-request rule the other repositories have (#22, #86).

## Cutting a release

1. **Prepare the release on a branch off `dev`**, as you would any change:

   ```bash
   git switch dev && git pull
   git switch -c release/X.Y.Z
   npm version X.Y.Z --no-git-tag-version
   node scripts/promote-changelog.mjs X.Y.Z
   ```

   `npm version` writes `package.json` and `package-lock.json`;
   `promote-changelog.mjs` renames `## [Unreleased]` to `## [X.Y.Z] - <today>`,
   opens a fresh empty `[Unreleased]` above it and rewrites the compare links at
   the bottom. Commit both as `chore(release): X.Y.Z` and open the PR into
   `dev`.

2. **Check it would release cleanly**, before going near `main`. The Release
   workflow has a dispatch that runs every check and cannot publish anything:

   ```bash
   gh workflow run release.yml --repo AR-js-org/artoolkit5-ts --ref release/X.Y.Z
   ```

   See [Verification runs](#verification-runs-and-what-they-cannot-tell-you).

3. **Merge to `dev`, then open the release PR from `dev` to `main`.** This is
   the one PR that targets `main`; everything else targets `dev`.

4. **Merge it with a merge commit.** Not squash, and preferably not rebase —
   see [Merge strategy](#merge-strategy-for-dev--main) for why each matters.

5. **Tag the merge commit on `main` and push the tag.** This is the step that
   releases:

   ```bash
   git switch main && git pull
   git tag -a vX.Y.Z -m "Release X.Y.Z"
   git push origin vX.Y.Z
   ```

   The workflow refuses a tag whose version disagrees with `package.json`, and
   one that is not an ancestor of `origin/main`.

6. **Re-sync `dev` from `main`** once it succeeds. See
   [After a release](#after-a-release).

## Things you must not do by hand

**Do not push the tag before the version commit is on `main`.** The tag is the
trigger, so pushing it early starts a release against a tree whose
`package.json` still carries the previous version. The workflow refuses that
rather than publishing it, and refuses a tag that is not an ancestor of
`origin/main` — but a pushed tag then has to be deleted locally and remotely
before it can be re-pushed, which is avoidable noise.

**Do not publish from your machine.** `npm publish` by hand produces a release
with no provenance attestation, and it cannot be added afterwards: 0.2.0 and
0.2.1 carry none, because both were finished by hand after the workflow's
publish failed. If the workflow's publish fails, the recovery path is
[`publish-tag.yml`](#publishing), which keeps provenance.

**Do not commit `dist/`.** It is gitignored and built during `verify`. The built
tree is handed to the `release` job as a build artifact rather than rebuilt
there, so the tarball that `npm pack --dry-run` reports on is the one that
actually gets published.

**Do not promote the changelog twice.** `scripts/promote-changelog.mjs` refuses
to run when `CHANGELOG.md` already contains a `## [X.Y.Z]` section, which is
what makes running it a safe step to repeat. Promoting it *is* now your job —
see [Cutting a release](#cutting-a-release) — because CI no longer touches the
changelog at all.

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

`main` has the release PR's merge commit, which `dev` does not, so the two have
diverged by at least that commit. Re-sync `dev` before starting the next branch.

Less pressing than it was: the `chore(release): X.Y.Z` commit now lands on `dev`
first, so `dev`'s `package.json` is already the released version and a branch cut
from it no longer thinks it is on the previous one. The merge commit still has to
come across.

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

`verify` runs for both triggers and nothing survives it, so a failure there has
released nothing:

| Check | Fails when |
| --- | --- |
| Tag names a version | the tag is not `vX.Y.Z`, optionally with a prerelease suffix |
| Tag matches `package.json` | the tag points at a commit carrying a different version |
| Tag is on `main` | the tag is not an ancestor of `origin/main` |
| Typecheck, test, build | any of the three fails |
| Release notes exist | there are no commits since the previous tag |

`release` adds two more, before the Release is created:

| Check | Fails when |
| --- | --- |
| Repository is public | npm cannot generate provenance from a private repo |
| Version not on npm | that version was already published, **or** the registry lookup could not answer (#81) |

The first three in `verify` only apply to a tag push; a dispatch has no tag to
check. That is decided inside one shell script rather than through step-level
`if:` conditions, deliberately — see the comments in the workflow.

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
- **Both jobs run Node 24.x, and 22.x will not do.** Trusted publishing needs
  npm 11.5.1 or newer, and Node 22.x still ships npm 10.9.x; Node 24.x ships
  11.19.x. `verify` used to run 22.x, which was harmless while only `release`
  published — but there is no reason for the tree to be built on a different
  major from the one that publishes it.
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

### A publish run was cancelled before it started

Not an error, and nothing was published. **Release** and **Publish tag** share
one concurrency group so they cannot publish at the same time (#82), and a
concurrency group holds one run in progress plus one *pending* run — no more.
GitHub's workflow syntax reference puts it plainly: "any existing `pending` job
or workflow in the same concurrency group will be canceled".

So with three publishes in flight, the one waiting in the middle is displaced by
the newest and never reaches its publish step. It appears in the Actions list as
cancelled, with no steps run.

Recovery is to request it again once the queue is clear. Nothing needs undoing,
because a displaced run is cancelled before it does anything.

This is a deliberate trade rather than an oversight. The alternative — a group
per workflow, which is what this repository had — let a recovery publish and a
normal release run at the same time and point `latest` at whichever finished
last. That failure is silent and affects every `npm install`; this one is
visible and costs a re-dispatch. A durable dispatch queue would remove it
properly, and is not worth building for a case that needs three overlapping
publishes.

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
safe against a tag that is already released. Crucially it publishes **with
provenance**, which is the whole reason not to fall back to doing it by hand.

What it refuses, each as early as the check can be made — the first three before
it fetches anything, the rest before it builds:

- a tag that is not `vX.Y.Z`, so a branch name cannot be passed as one
- a ref outside `refs/tags/`, so a *branch* called `v0.3.0` cannot stand in for
  the tag — `checkout` would otherwise resolve either
- a tag with no GitHub Release, since a bare tag only proves someone pushed a
  tag, not that a release ran
- a tag whose name disagrees with `package.json`, meaning the wrong tree
- a version already on npm, so a re-run says so plainly instead of hitting npm's
  E403, which reads like an authentication failure
- a registry lookup that did not answer. "Not published" and "registry
  unreachable" are different facts, and `npm view` distinguishes them: it exits
  non-zero with `E404` only for a genuine absence. Treating any failure as an
  absence is what let a network blip point `latest` at an older version (#81),
  so an unanswered lookup stops the run instead.

**It chooses the dist-tag rather than inheriting it.** `npm publish` moves
`latest` unless told otherwise, and this workflow can publish a version *older*
than one already released — recovering 0.2.1 after 0.2.2 shipped, say. That
would point `latest` backwards and every plain `npm install` would fetch the
older package. So it publishes under `recovered` when the version is not the
newest, or is a prerelease, and only takes `latest` when it genuinely is the
newest. The run summary says which it chose, and how to remove the extra tag:

```bash
npm dist-tag rm @ar-js-org/artoolkit5-ts recovered
```

That decision is the **last** step before the publish, not an early check. It
reads the registry and the next step acts on what it read, so any gap between
the two is a gap in which a normal release can move `latest` and invalidate the
answer. Both workflows also share one non-cancelling concurrency group,
`publish-<owner>/<repo>`, so a recovery publish and a normal release queue
behind each other rather than racing (#82). The shared group is the exclusion;
deciding late is what makes the step correct even without it.

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

### The tag is rejected

Three messages, three different mistakes, and none of them has released
anything:

- **"does not name a version"** — the tag is not `vX.Y.Z`. Delete it and push
  the right one.
- **"implies version X but package.json says Y"** — the tag is on the wrong
  commit, almost always one before the version bump landed. Delete it, and tag
  the merge commit on `main`.
- **"is not an ancestor of origin/main"** — the tag is on a branch. Delete it,
  get the release PR merged, and tag there.

In each case: `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z`, then
push the corrected tag. Re-pushing a moved tag without deleting it needs
`--force`, which the ruleset does not block for tags but which leaves anyone
who already fetched it holding the old one.

## Verification runs, and what they cannot tell you

A `workflow_dispatch` of **Release** runs `verify` in full and skips `release`
entirely — as a whole job, on the event rather than on an input. That covers
every check, the build, the release notes and the packed tarball.

It cannot cover anything in `release`, because that job does not exist for a
dispatch: the GitHub Release and the npm publish are unexercised. A clean
verification tells you the tree is *releasable*, not that it will *publish*
correctly — which is exactly why the npm 403 above was never caught before a
real release.

What changed is that the dispatch can no longer publish **by construction**
rather than by remembering a flag. The old `dry_run: false` default meant a
dispatch without the flag was a real release; now a dispatch is never one, and
the only way to publish is to push a tag. That removes the failure mode #22 was
opened about: a step added to `release` without its own `if:`.

The publish still cannot be rehearsed. A failure there no longer needs
improvising, though — [`publish-tag.yml`](#publishing) is the recovery path, and
it keeps provenance.

## Open items

- **The `pull_request` rule on `main`.** Nothing pushes to `main` from a
  workflow any more, so ruleset `24843561` ("Protect main branch", currently
  `deletion` and `non_fast_forward` only) can gain the pull-request rule the
  other AR-js-org repositories have. That is the last box in
  [arjs-dev-tools#8](https://github.com/AR-js-org/arjs-dev-tools/issues/8) for
  this repository, and it needs doing **after** the first tag-triggered release
  has run, not before — so that a problem with the new flow can still be fixed
  by pushing to `main`.
