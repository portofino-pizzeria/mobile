# Portofino — automatic deployment (2026-09-10)

> **Status:** DRAFT
>
> **Repos:** `portofino-pizzeria/infra` (leads), `portofino-pizzeria/mobile`,
> `portofino-pizzeria/backend`. Filed here because `mobile/plans/` is this
> tenant's one plan home (`bc49e37 docs(plans): adopt the Portofino plans into
> the mobile repo`); splitting a three-repo plan across three plan directories
> is the divergent-corpus problem, not organisation.
>
> **Trigger:** PR `portofino-pizzeria/mobile#5` merged to `main` on 2026-09-10
> and changed nothing a customer can see. That is not a defect in the PR — it
> is the system working as built, and this plan is about that.

---

## The measurement this starts from

Taken 2026-09-10, after `#5` landed:

```
$ curl --resolve portofino-essen.com:443:18.66.122.124 https://portofino-essen.com/ -D -
Last-Modified: Thu, 03 Sep 2026 05:12:28 GMT
Server: AmazonS3      Via: CloudFront
<html lang="en">      <meta name="description" content="Order authentic wood-fired pizza…">
```

`lang="en"` is the pre-`#5` marker; the new build emits `lang="de"`. The live
site is a **seven-day-old build**, and `main` has had exactly one commit since
2026-08-29 — so everything merged in that window is either already in the
3 September bundle or has never shipped, **and nothing in the system can tell
you which.** That ambiguity is itself part of what this plan closes.

## Why nothing happened

There is exactly one workflow in all three repos — `mobile/.github/workflows/
qontinui-ci.yml` — and it runs typecheck, lint, build, test. **No deploy step
exists anywhere.** Publishing today is:

| Surface | Mechanism | Trigger |
|---|---|---|
| Web app | `infra/scripts/deploy-web.ps1` — `expo export --platform web --clear` → `aws s3 sync --delete` → CloudFront invalidation | `null_resource.deploy_web` in `infra/web.tf`, on `terraform apply` |
| Backend | `infra/scripts/push-backend.ps1` → ECR `:latest`; App Runner has `auto_deployments_enabled = true` | `null_resource.push_image` in `infra/backend-service.tf`, on `terraform apply` |

So a deploy requires an operator, on a Windows box, with the `portofino` AWS
profile and access to the S3 remote state, running `terraform apply` by hand.
Merging is not connected to publishing at all.

### Four properties of that arrangement, each independently a problem

1. **Merge ≠ ship, silently.** No signal anywhere says the live site is behind
   `main`. The only way to find out is to fetch the site and read a marker out
   of the HTML, which is how this was found.
2. **The trigger is content-hashed over the wrong set.** Both `null_resource`s
   hash `../mobile/src/**` and `../backend/src/**` respectively.
   `mobile/package.json` is **not** covered — so a change that only touches
   dependencies (a font package bump; a security patch) produces **no
   redeploy** even under `terraform apply`. `#5` happened to touch `src/`, so
   this did not bite; it is a live trap, not a hypothetical one.
3. **It is Windows-bound.** All three scripts are `.ps1` invoked as
   `interpreter = ["powershell", …]` — `powershell`, not `pwsh`. Deployment is
   therefore a property of one operator's machine.
4. **Provisioning and deploying are the same action.** `terraform apply`
   both reconciles infrastructure and ships application code. Shipping a
   one-line copy fix means running a plan that could also alter the database,
   the DNS or the budget alarm.

---

## What this plan builds

**One rule: Terraform provisions; CI deploys.** After this, `terraform apply`
never ships application code, and no human ever needs to in the steady state.

### Phase 1 — GitHub OIDC and two least-privilege roles (`infra`)

New `infra/github-oidc.tf`. Today `identity.tf` contains only a billing-viewer
IAM user; there is **no** OIDC provider and no CI role.

- `aws_iam_openid_connect_provider` for `token.actions.githubusercontent.com`.
- `portofino-ci-web` — `s3:PutObject`/`DeleteObject`/`ListBucket` on the web
  bucket only, plus `cloudfront:CreateInvalidation` on that one distribution.
- `portofino-ci-backend` — ECR auth + push to the `backend` repository only.

Both trust policies **pin `sub` to the specific repo and to `ref:refs/heads/
<default-branch>`**, so a pull request from a fork cannot assume them. Note the
branches differ per repo — `mobile` is `main`, `backend` and `infra` are
`master`; a policy written for `main` everywhere silently fails closed on two
of three, which reads like an auth bug rather than a typo.

No long-lived access keys, and no AWS credentials in any repo's secrets.

### Phase 2 — Web deploy workflow (`mobile`)

`.github/workflows/deploy-web.yml`, on push to `main`, **gated on the existing
CI job passing** — never in parallel with it.

1. `npm ci`
2. `npx expo export --platform web --clear`, with `EXPO_PUBLIC_API_URL` set to
   the production API. `--clear` is not optional: the URL is inlined at build
   time and a stale Metro cache bakes in the wrong one. `deploy-web.ps1`
   already carries this warning and its reasoning ("Verified 2026-07-18");
   port the guard, do not re-derive it.
3. **Keep the existing bundle guard** — fail the deploy if the intended API
   host is absent from `dist/_expo/static/js/web/*.js`.
4. Assume `portofino-ci-web` via OIDC; `aws s3 sync dist/ --delete`;
   `cloudfront create-invalidation --paths "/*"`.
5. **Verify by reading back.** See "The verification rule" below.

### Phase 3 — Backend deploy workflow (`backend`)

`.github/workflows/deploy-backend.yml`, on push to `master`, gated on tests.

1. Build the image from `backend/Dockerfile`.
2. Push **two** tags: `:latest` (App Runner's `auto_deployments_enabled` watches
   it) and `:<git-sha>` — immutable, so a rollback names a specific artifact
   rather than hoping `:latest` still means what it did.
3. Poll the App Runner service to `RUNNING` **and** smoke-check the deployed
   API. A push to `:latest` returning success says the image is in ECR, not
   that the service took it.

### Phase 4 — Retire the double path (`infra`)

Delete `null_resource.deploy_web` and `null_resource.push_image`, and with them
the `src_hash` triggers whose coverage gap is problem 2 above.

**Bootstrap is the one thing that must survive this.** `backend-service.tf`
notes that App Runner needs an image present before the service can start, so a
green-field `terraform apply` cannot simply have no image path. Keep the push
script as an explicitly operator-run bootstrap step documented in
`infra/README.md` — invoked by hand on first stand-up, never by `apply`. If
that proves impossible to separate cleanly, the fallback is a `count`/variable
guard defaulting to off, and the plan should say which was chosen rather than
leaving both in the tree.

### Phase 5 — Make "is the site current?" answerable

Stamp the built commit into the web bundle (a `<meta name="build-sha">` in
`+html.tsx`, or an emitted `dist/build-info.json`) so the question this plan
opened with is answerable in one request by anyone, forever, without reading
`Last-Modified` and guessing.

---

## The verification rule

**A deploy step must prove the artifact is live, not that the command exited
zero.** This whole plan exists because a green merge sat on top of a stale
bundle for a week.

So the web workflow's last step fetches `https://portofino-essen.com/` after the
invalidation and asserts the just-built commit SHA appears in the response,
failing the job otherwise. `s3 sync` exiting 0 proves bytes reached a bucket;
CloudFront can still serve the old object, and an invalidation is asynchronous.
Same for the backend: the job passes when the deployed `/health` answers, not
when `docker push` returns.

This mirrors the rule that governed the UI work in `#5` — an action's own
success is not evidence it had an effect — and it is the property that makes
this plan self-checking rather than one more thing to trust.

---

## Risks, and what they change

**This ships to a live restaurant on every merge.** There is no staging
environment. Two consequences the plan accepts deliberately:

- Deployment is gated on CI passing, so a red build never reaches customers.
  This is why Phase 2 is `workflow_run`-gated rather than a parallel job.
- Rollback must be one documented command, written in `infra/README.md` as part
  of Phase 3 — not discovered during an incident. For the web that is
  re-running the workflow at an earlier SHA; for the backend it is retagging a
  known-good `:<sha>` to `:latest`. **The rollback path is tested once, on
  purpose, before this is considered done** — an untested rollback is a claim,
  not a capability.
- Kitchen service hours are Mo, Wed–Fri 12:00–22:00 and Sat–Sun 13:00–22:00
  (`audience_profile/owner-operator`). A deploy during service is a deploy
  while orders are in flight. Whether to add a time guard is an open question
  below rather than a decision this plan makes alone.

**`portofino-essen.de` is not ours and is untouched by any of this.** It is the
restaurant's live WordPress site, run by the current operator. Nothing in this
plan points at it.

## Open questions

1. **Deploy during service hours — block, or allow?** A time-window guard costs
   little; it also delays a fix for a bug a diner is hitting right now. The
   owner's tolerance is the deciding input and it is not recorded anywhere.
2. **Does `infra` get CI at all?** `terraform plan` on PR is the obvious win,
   but it needs read access to state and this plan does not otherwise give CI a
   terraform role. Out of scope here; worth its own plan.
3. **Who is told when a deploy fails?** Today: nobody, because there are no
   deploys. A failed workflow is a red mark nobody is watching.

## Out of scope

- Anything touching `portofino-essen.de`.
- The `web` repo (the eventual site replacement) — it has no backend wiring yet.
- EAS / app-store builds for the native app. `initiative/current-initiative`
  records that the app has no `eas.json` and has never been on a phone; that is
  a separate and larger piece of work.

## Verification of this plan's own work

- After Phase 2 lands, a trivial commit to `mobile/main` must move
  `Last-Modified` **and** the `lang="de"` marker on the live site, observed by
  fetching it.
- After Phase 3, a trivial commit to `backend/master` must appear in the
  deployed `/health`.
- Both rollbacks executed once and observed.
- `terraform plan` shows no drift after Phase 4 — i.e. the `null_resource`
  removal is a clean removal, not a resource waiting to be re-created.
