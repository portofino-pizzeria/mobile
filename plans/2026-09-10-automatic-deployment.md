# Portofino — automatic deployment (2026-09-10)

> **Status:** IMPLEMENTED 2026-09-12 — every phase is merged; NOT yet SHIPPED,
> because the plan's own "Verification of this plan's own work" is only partly
> met. Ledger, measured 2026-09-12 rather than inferred from merges (backend
> rows re-measured 2026-09-13, rollback rows measured 2026-09-14):
>
> | Phase | Landed as | State |
> |---|---|---|
> | 1 web marker | `mobile#6` | live — `<meta name="build-sha">` on portofino-essen.com reads `35bf7e0`, the tip of `main` |
> | 1 backend marker | `backend#1` | **live** — on 2026-09-13 `api.portofino-essen.com/api/health` answered `commit: 577f21575992…`, the tip of `master` |
> | 2 OIDC + roles + SSM | `infra#1`, `3e02a93` | **applied** — both roles exist, all three `/portofino/production/*` parameters exist |
> | 3 web deploy | `mobile#6`, `ebd9dc6` | working — push-triggered runs green, marker moves (verification 1 ✔) |
> | 4a backend CI | `backend#1` | working — green on every PR and master push |
> | 4b backend deploy | `backend#1`, `#2`, `#4`, `#8`, `#11` | **working, with no reviewer** — `backend#11` removed the human approval gate (operator decision 2026-09-12) and the `production-backend` environment now carries only its master-only branch policy. Master pushes deploy unattended: runs 34746809481, 34747478263 and 34747755643 (2026-09-13) all green; the last carried App Runner operation `b65ae19b3c9e42d3ab85d036d36747e8`, named in its job log (verification 2 ✔) |
> | 5 retire the Terraform path | `infra#1`, applied; `infra#3` follow-up | **done** — `terraform plan` against the live state (serial 16, 2026-09-12) shows no `null_resource`, no change to `aws_apprunner_service.backend` (not tainted by the dropped `depends_on`) and no infrastructure diff; the `null` provider #1 retained for the destroy is removed by `infra#3` (verification 5 ✔) |
> | Rollback, web | `mobile#6`, `#9` | **exercised** — Deploy web run 34719947683 (2026-09-12 21:26Z, `workflow_dispatch`, `ref=07c2606`, then the parent of `main`'s head) built and published that commit, and its own live assertion read `build-sha=07c2606db982…` from portofino-essen.com; run 34720114949 three minutes later published `main`'s head `8716c97` again (its `notify-recovery` ran, the rollback's did not — the job is keyed on the published sha equalling `main`'s head, and behaved). Both green |
> | Rollback, backend | `backend#4` | **exercised** — Deploy backend run 34812439656 (2026-09-14 06:12Z, `workflow_dispatch`, `sha=603eb23`, the parent of `master`'s tip) took the retag path: "Found portofino-production-backend:603eb235… (sha256:638afa1a…): retagging, not rebuilding", no snapshot (`drizzle/` identical to the live commit), App Runner operation `c0355e483f514ed384888f4611de55c8` SUCCEEDED, "Verified: 603eb235… is live", and `/api/health` read `commit: 603eb235…` independently. Run 34812853560 rolled forward the same way (operation `32477190028c4fd4995af09975fb4eca`) and `/api/health` reads `577f215…`, `master`'s tip, again. The target was chosen to differ from the tip by one comment line, so an interrupted exercise would have left production functionally unchanged |
>
> Outstanding before SHIPPED: verification 3 only (a web deploy observed
> mid-flight from a warm-cache browser — a person at a browser while a deploy
> that changes the bundle is running; it cannot be checked from CI, and none of
> the sessions so far has been at one at the right moment). Verifications 1, 2,
> 4 and 5 are met (rows above). Until 2026-09-14 this block said the web
> rollback was unexercised; it had been run on 2026-09-12, and the text was
> corrected by reading the run list rather than the block.
>
> **A gap the pipeline showed on 2026-09-13, closed by `mobile` follow-up to
> `#20`.** The push deploy of `c25c2d4` (Deploy web run 34748395985, 08:43Z)
> was never started — GitHub: "The job was not started because it repeatedly
> failed to be acquired (5 attempts)" — and `notify-failure`, in the same run,
> died the same way. No issue was opened; `main`'s head was not live until the
> next unrelated push (`f955875`, 14:54Z) happened to ship it, six hours later.
> The failure-notification decision below assumed the alarm could run when the
> deploy could not, and a hosted-runner outage falsifies that. What closes it
> is `.github/workflows/web-site-current.yml`: every half hour it fetches the
> site, proves the referenced bundle is served as JavaScript, and compares the
> `build-sha` with `main`'s head as read at that moment. It raises the same
> `Web deploy failed` issue when the site or its bundle does not answer three
> times, when the bundle is not JavaScript, or when the sha differs and the
> head is older than fifteen minutes with no deploy of it queued or running
> (or a deploy of it stuck longer than thirty). The first tick that finds the
> site current closes the issue again. It shares the runner pool, and so the
> outage, but not the moment: the first tick that acquires a runner alarms.
>
> Superseded by operator decision 2026-09-12 (`backend#11`): backend deploys no
> longer wait on a human. The "required reviewer" in Phase 4 and in "Decisions
> taken during vetting" is the original design, kept for the record; what
> stands in for it is the master-only `resolve` job, the test job at the target
> commit, and the pre-deploy Aurora snapshot (`backend#8`). The environment
> itself stays, because the CI role's OIDC trust pins its claim.
>
> Superseded by implementation: the backend rollback is retag-first rather
> than rebuild-only (`ecr:BatchGetImage` was granted by `infra@425abd3` for
> exactly this; `backend#4` retags when a `:<sha>` image exists and rebuilds
> only when none does, or on an explicit `rebuild: true` dispatch). The backend OIDC subject pins `environment:production-backend`
> rather than the ref — see `infra/github-oidc.tf`'s comment for why the
> ref form could never match.
>
> Previously: VETTED 2026-09-10.
>
> **Vet outcome:** NEEDS-REWORK on the first draft — 2 critical, 4 high,
> 4 medium defects, 3 factual claims wrong, 4 ordering errors. All are resolved
> below; the "Vet record" section at the end keeps the ones worth remembering.
> The core split (Terraform provisions, CI deploys) and the verify-by-reading
> rule survived vetting unchanged; almost everything else moved.
>
> **Repos:** `portofino-pizzeria/infra` (leads), `.../mobile`, `.../backend`.
> Filed in `mobile/plans/` — this tenant's one plan home.
>
> ⚠️ **`portofino-pizzeria/mobile` is a PUBLIC repo.** `backend` and `infra` are
> private. This governs the whole design and is the first thing to check before
> changing any trigger below.

---

## The measurement this starts from

PR `mobile#5` merged 2026-09-10 and changed nothing a customer can see:

```
$ curl https://portofino-essen.com/ -D -
Last-Modified: Thu, 03 Sep 2026 05:12:28 GMT    Age: 3472    X-Cache: Hit from cloudfront
<html lang="en">
```

`lang="en"` is the pre-`#5` marker. The live site is a seven-day-old build.

## Why nothing happened

One workflow exists across all three repos — `mobile/.github/workflows/
qontinui-ci.yml` — and it has **no deploy step**. Publishing today is
`terraform apply` on an operator's Windows box, driven by two `null_resource`s
running PowerShell:

| Surface | Script | Trigger hash |
|---|---|---|
| Web | `deploy-web.ps1` — `expo export` → `s3 sync --delete` → invalidation | `web.tf:106`, over `../mobile/src/**` |
| Backend | `push-backend.ps1` → ECR `:latest`; App Runner `auto_deployments_enabled = true` | `backend-service.tf:42-43`, over `../backend/src/**` + `Dockerfile` |

### Four properties, each independently a problem

1. **Merge ≠ ship, with nothing surfacing the gap.** No build marker exists, so
   "is the site current?" is answerable only by fetching HTML and inferring.
2. **The trigger hashes the wrong set — wider than first thought.** Uncovered:
   `mobile/package.json`, `app.json`, `assets/`, `tsconfig.json`, and on the
   backend side `package*.json`, `data/`, **and `drizzle/`** — the migrations,
   which are applied on container boot. A migrations-only change ships nothing.
3. **Windows-bound.** `interpreter = ["powershell", …]` — not `pwsh`.
4. **Provisioning and deploying are the same action.** `terraform apply` ships
   application code as a side effect of reconciling infrastructure.

---

## The design

**Terraform provisions; CI deploys; every deploy proves the artifact is live.**

### Phase 1 — Build markers first

Both markers, before anything consumes them:

- **Web** — a `<meta name="build-sha" content="…">` in `mobile/src/app/+html.tsx`,
  fed from an env var at export time.
- **Backend** — a `commit` field on `/api/health`
  (`backend/src/app.ts:45`; the route is `/api/health`, **not** `/health` —
  the first draft had this wrong, and App Runner's own `health_check` already
  points at `/api/health`, `backend-service.tf:174`).

This is Phase 1 because the verification steps in Phases 3 and 4 assert on
these. The first draft had it last, which made its own headline property
unbuildable.

### Phase 2 — Config channel, then OIDC and two roles (`infra`)

**Config first.** CI must not hardcode the bucket, distribution id or API URL:
the bucket name embeds the AWS account id (`web.tf:5`), the distribution id is
a Terraform output, and `EXPO_PUBLIC_API_URL` is derived from `domain_name`
(`locals.tf:16`). A workflow copy of any of them is a silent drift channel — and
`deploy-web.ps1`'s bundle guard, ported as-is, would happily pass while shipping
the wrong host. Terraform writes all three to **SSM parameters**; the workflows
read them after assuming the role.

**Then `infra/github-oidc.tf`** — today `identity.tf` has only a billing user;
there is no OIDC provider and no CI role.

- `aws_iam_openid_connect_provider` for `token.actions.githubusercontent.com`.
- `portofino-ci-web` — `s3:PutObject`, `DeleteObject`, **`GetObject`** (sync
  does HEAD comparisons), `ListBucket` on the web bucket; `cloudfront:
  CreateInvalidation` **and `GetInvalidation`** (the wait needs it) on that one
  distribution; `ssm:GetParameter` on the three parameters.
- `portofino-ci-backend` — `ecr:GetAuthorizationToken` in its **own statement
  with `Resource: "*"`** (it cannot be resource-scoped), the push actions scoped
  to the `backend` repository, plus `apprunner:DescribeService` and
  `ListOperations`.

Both trust policies pin `aud = sts.amazonaws.com` and pin `sub` to the specific
repo **and** `ref:refs/heads/<that repo's default branch>` — `main` for
`mobile`, `master` for `backend`.

> **Phase 2 must be APPLIED, not merely merged, before Phases 3–4 can
> authenticate — and applying it is dangerous while Phase 5 has not run.** With
> both `null_resource`s still present, a plain `terraform apply` ships whatever
> is in `mobile/src` and `backend/src` at that moment: the "provisioning and
> deploying are the same action" defect biting during this plan's own execution.
> **Apply Phase 2 with `-target` on the OIDC and SSM resources only.**

### Phase 3 — Web deploy (`mobile`)

**One workflow, `on: push: branches: [main]`, with the deploy job in
`needs: [build]`. NOT `workflow_run`.**

> ⛔ **This is the plan's most important constraint and the first draft got it
> wrong.** `mobile` is public and its CI runs `on: [push, pull_request]`, so a
> fork PR produces a completed run. A `workflow_run`-triggered job runs on the
> default branch with full OIDC access, and its `sub` is
> `repo:portofino-pizzeria/mobile:ref:refs/heads/main` — exactly what the trust
> policy pins. Checking out `event.workflow_run.head_sha`, or merely running
> `npm ci` against the attacker's `package.json` (lifecycle scripts), executes
> fork code holding the S3 + CloudFront role. The first draft asserted "a pull
> request from a fork cannot assume them", which is **false for the trigger it
> chose**. A `push`-triggered job in the same workflow never runs for a fork.

Also on the workflow: `permissions: { id-token: write, contents: read }`, and a
`concurrency` group so two quick merges cannot interleave two syncs.

Steps: `npm ci` → `expo export --platform web --clear` with
`EXPO_PUBLIC_API_URL` from SSM and the build SHA from Phase 1 → keep the
existing bundle guard on `dist/_expo/static/js/web/*.js` → assume role → **the
safe publish sequence below** → wait for the invalidation → fetch
`https://portofino-essen.com/` and assert the just-built SHA.

#### The safe publish sequence — this is not a detail

`aws s3 sync --delete` against this distribution can **white-screen live
diners for up to an hour**, silently:

- The export is stable-path HTML plus one content-hashed bundle.
- `--delete` removes the OLD bundle while edge- and browser-cached HTML still
  references it (`default_ttl` 3600; `Age: 3472` measured on the live site).
- That request 403s — and `web.tf:56-61` rewrites 403 to `/index.html` with
  **HTTP 200**, so the browser parses HTML as JavaScript. Blank page, no error
  anyone sees, and `forwarded_values.query_string = false` (`web.tf:43`) means
  cache-busting cannot rescue it.

So: **upload `_expo/` and `assets/` FIRST without `--delete`; upload HTML
LAST; never prune in the same run.** Old builds are pruned by an S3 lifecycle
rule. Set `Cache-Control: public,max-age=31536000,immutable` on hashed assets
and `no-cache` on `*.html`. Separately, consider making `/_expo/*` return a
real 404 rather than a 200 — the rewrite is there for SPA routing and should
not apply to asset paths.

#### Also fix the gate this phase leans on

`mobile/package.json` has **no `build` and no `test` script**, so CI's `--if-present`
steps are silent no-ops: today's CI is typecheck + lint only, and it never runs
`expo export`. "A red build never reaches customers" currently means "a type
error never reaches customers". **Add `expo export --platform web` to the PR
job**, or the principal safety claim for a live ordering system is weaker than
it reads.

### Phase 4 — Backend CI, then backend deploy (`backend`)

Two sub-phases, because `backend` has **no workflow at all** today and its tests
need a live Postgres (`vitest.config.ts` `globalSetup` fails loudly without one).

- **4a** — a CI workflow with a `services: postgres` container and a migrated
  test DB.
- **4b** — deploy on push to `master`, gated on 4a: build, push `:latest` **and
  `:<sha>`**, then verify.

**Verify by operation, not by state.** The service is already `RUNNING` before
the push, and auto-deploy is asynchronous — polling for `RUNNING` observes the
old service and passes. An identical digest fires no deployment at all and the
poll still passes. So: poll `apprunner:ListOperations` for an operation
**started after the push**, wait for it to succeed, then assert the `commit`
field Phase 1 added to `/api/health`.

> ⚠️ **Backend deploys are not symmetric with web deploys, and this plan does
> not treat them as if they were.** Migrations run on container boot from
> `drizzle/` (`Dockerfile:21`, `src/index.ts:11`). An automatic backend deploy
> therefore applies schema changes to production Aurora with no gate and no way
> back once data is written under the new schema. **4b runs through a GitHub
> Environment with a required reviewer.** Automatic to the door, human through
> it. This is the one place in this plan where a person stays in the loop, and
> it is deliberate.
>
> **Superseded 2026-09-12 (`backend#11`):** the reviewer was removed — a
> deploy held at it left `master` red and blocked the merge train. The
> pre-deploy snapshot is now the way back; see the Status block.

### Phase 5 — Retire the Terraform deploy path (`infra`)

Delete both `null_resource`s and their triggers. Three things must move with
them, only one of which the first draft saw:

1. `aws_apprunner_service.backend` has `depends_on = [null_resource.push_image, …]`
   (`backend-service.tf:182-186`) — that reference goes too.
2. Because `aws_ecr_repository.backend` is created by this same Terraform, an
   operator cannot push the bootstrap image before `apply`. Green-field bootstrap
   becomes **three steps**: `terraform apply -target=aws_ecr_repository.backend`
   → run `push-backend.ps1` by hand → `terraform apply`. That invalidates the
   two-phase flow in `deploy.ps1` and `infra/README.md:56-62`.
3. **The web side needs the same treatment and had none.** With `deploy_web`
   gone, a green-field apply leaves an EMPTY bucket, and the 403→200 rewrite
   means a fresh stand-up serves HTTP 200 with no content. Document the first
   publish as an operator-run `deploy-web.ps1`, or a `workflow_dispatch` on the
   Phase 3 workflow.

The `infra/README.md` rewrite belongs to **this** phase, not Phase 4 — this is
what removes the flow that README documents.

---

## Rollback

**Re-running a workflow replays the same commit, so that is not a rollback.**
Both deploy workflows take a `workflow_dispatch` with a ref/sha input.

For the web, note that after a `--delete` prune the previous build's objects are
gone, so rollback means a **rebuild at that SHA** — which requires the
dependency tree at that SHA to still resolve. For the backend, rollback is
retagging a known-good `:<sha>` to `:latest`; a rollback across a migration is
**not** a rollback and must be treated as a forward fix.

**Both paths are executed once, on purpose, before this plan is done.** An
untested rollback is a claim, not a capability. *(Done: web on
2026-09-12, backend on 2026-09-14 — runs in the Status block.)*

## Decisions taken during vetting

- **Deploy during service hours: allowed for web, gated for backend.** Blocking
  a web deploy by clock delays a fix for a bug a diner is hitting now, and the
  safe publish sequence above removes the reason to fear it. The backend's real
  risk is migrations, and that is gated by a required reviewer rather than by
  the time of day. *(Superseded 2026-09-12 by `backend#11`: no reviewer; the
  pre-deploy snapshot is the restore point.)*
- **Failure notification is in scope.** Open question 3 was the difference
  between fixing the problem and moving it: today a stale site is invisible;
  after this, a **failed deploy** would be invisible too. Every deploy workflow
  gets an `if: failure()` notification step. *(Extended 2026-09-14: an
  `if: failure()` step cannot run when the run itself never starts — measured
  on 2026-09-13, see the Status block — so the web side also gets a scheduled
  watchdog that asks the site directly.)*
- **`infra` CI stays out of scope.** `terraform plan` on PR needs state access
  this plan deliberately does not grant CI.

## Cross-repo ordering — unresolved, and named

A wire-contract change spans `mobile` and `backend`. Two independent pipelines
will ship the web calling an endpoint the API does not have yet, or the reverse.
On a live ordering system that is a broken checkout, not a cosmetic bug. This
plan does not solve it; it records it, because pretending two pipelines are one
is worse. Candidate: expand-migrate-contract discipline plus a documented rule
that backend ships first.

## Out of scope

`portofino-essen.de` (not ours). The `web` repo. EAS / app-store builds.

## Verification of this plan's own work

1. A trivial commit to `mobile/main` moves the live `build-sha` marker — checked
   by fetching the site, not by reading a job's exit code.
2. A trivial commit to `backend/master` moves `commit` on `/api/health`, and the
   App Runner operation that carried it is identified in the job log.
3. **A deploy is observed mid-flight from a second browser session with a warm
   cache**, confirming the white-screen window is closed. This is the one that
   proves the sequencing, and it cannot be checked from CI.
4. Both rollbacks executed.
5. After Phase 5, `terraform apply` **then** `terraform plan` is clean — plan
   alone will show "2 to destroy" until the apply runs, so apply-then-plan is
   the check. Confirm the App Runner service was not tainted by the dropped
   `depends_on`.

---

## Vet record — what the first draft got wrong

Kept because these are the failure modes to watch for on the next revision.

| Severity | Defect |
|---|---|
| CRITICAL | `workflow_run` gating on a **public** repo — fork-PR privilege escalation to a production-capable role. The draft asserted forks were excluded; for its own chosen trigger, false. |
| CRITICAL | Phase 4 (now 5) bootstrap: missed `depends_on` on the App Runner service, missed that ECR is created by the same apply, and never considered the empty-bucket case at all. |
| HIGH | `s3 sync --delete` + the 403→200 rewrite + a 1-hour TTL = a silent white-screen window on every deploy. |
| HIGH | Both liveness checks passed without proving anything — the exact rule the plan itself was written to enforce. |
| HIGH | Phase 2's verification asserted a build marker that Phase 5 created. |
| MEDIUM | IAM policies under-scoped (`s3:GetObject`, `cloudfront:GetInvalidation`, `ecr:GetAuthorizationToken` resource, `apprunner:*` reads, `aud` condition). |
| MEDIUM | No channel for bucket / distribution / API URL; hardcoding them creates silent drift a ported guard would not catch. |
| MEDIUM | Backend "gated on tests" — backend had no CI, and its tests need Postgres. |
| MEDIUM | The gate Phase 3 leans on is nearly vacuous: `build` and `test` are `--if-present` no-ops. |
| WRONG | "CI runs typecheck, lint, build, test" — the last two are no-ops. |
| WRONG | Backend smoke-check on `/health` — the route is `/api/health`. |
| WRONG | "nothing in the system can tell you which [commits shipped]" — `git log origin/main --since` answers it. The build-marker argument stands; the framing overstated. |
| ORDERING | Phase 5→1; Phase 2 must be `-target`-applied before 3–4; README rewrite belongs to Phase 5; "plan shows no drift" is apply-then-plan. |
