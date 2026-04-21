# DevOps Learning Knowledge Base

This file is a day-by-day learning notebook for CI/CD and DevOps.
The focus is beginner-friendly understanding first, then practical depth.

## Table of Contents
- Day 1 - CI/CD Basics from Repo
- Day 2+ - Learning Template
- Glossary - Core Terms

---

## Day 1 - CI/CD Basics from Repo

### Date
2026-04-21

### Goal
Understand `trigger -> quality checks -> safe build` using `.github/workflows/ci.yml`, and be able to explain the flow without reopening the file line by line.

### Level 1 Theory (Absolute Basics)

#### What is software delivery in simple words?
Software delivery means taking code from a developer laptop to a stable version that users can run.  
Before release, teams need automatic checks to reduce mistakes.

#### What is CI (Continuous Integration)?
CI is a practice where every code change is automatically verified (lint, tests, type checks, build checks) after push/PR events.

Simple meaning:  
"When code changes, run robots that check quality and correctness."

#### What is CD?
CD has two common meanings:
- Continuous Delivery: software is always in a releasable state, but deployment can be a manual decision.
- Continuous Deployment: every passing change deploys automatically to an environment.

This repo workflow is CI-focused (quality + test + build safety gate).

#### Why teams need CI
- Catch defects early (cheap to fix).
- Prevent broken code from spreading to shared branches.
- Standardize quality across all developers.
- Improve trust in pull requests and releases.
- Provide fast feedback loops.

---

### Level 2 Theory (GitHub Actions Structure)

A GitHub Actions workflow file has key blocks:
- `name`: label shown in GitHub UI.
- `on`: events that start the workflow.
- `env`: environment variables available to jobs/steps.
- `jobs`: independent or dependent units of work.
- `steps`: commands/actions inside each job.

In this repo, the key learning focus is:
- `on` = when the workflow starts.
- `jobs` = what checks are done.
- `needs` = in what order jobs are allowed to run.

---

### Workflow Understanding from `.github/workflows/ci.yml`

#### 1) `on` (When workflow runs)
- `push` on branches: `main`, `develop`
- `pull_request` targeting branches: `main`, `develop`

Meaning:
- A direct push to `main`/`develop` starts CI.
- A PR opened/updated against `main`/`develop` also starts CI.

#### 2) `jobs` (What stages exist)
- `lint`: code style/rule and centralization checks.
- `test`: unit + integration tests, with coverage artifact upload.
- `build`: build impacted projects.
- `typecheck`: TypeScript type validation on impacted projects.

#### 3) `needs` (Dependencies / order)
- `test` needs `lint`.
- `build` needs `test`.
- `typecheck` needs `lint`.

Dependency graph:
- `lint -> test -> build`
- `lint -> typecheck`

Important behavior:
- If `lint` fails, both `test` and `typecheck` are blocked.
- If `test` fails, `build` is blocked.

---

### Practical Task A - Answers (Short Form)

1. **What events trigger this workflow?**  
   `push` and `pull_request`.

2. **Which branches are included?**  
   `main` and `develop`.

3. **Which job runs first?**  
   `lint` runs first (no `needs` dependency).

4. **Which job depends on test?**  
   `build` depends on `test`.

5. **Which job depends on lint?**  
   `test` and `typecheck` depend on `lint`.

---

### Practical Task B - Flow and Reasoning

#### Flow diagram (text form)
- `lint -> test -> build`
- `lint -> typecheck`

#### Why this order is useful
- "Fail fast": stop early on basic issues.
- Save CI resources by not building obviously bad code.
- Build only after behavior correctness is verified by tests.
- Keep release pipeline safer and more predictable.

#### Risk if lint is skipped
- Low-quality or inconsistent code can enter shared branches.
- Team standards become weaker over time.
- Review effort increases (humans catch what linter could catch).
- Technical debt accumulates faster.

---

### Deep Dive: What each job is doing internally

#### `lint` job
Purpose: quality gate and rule compliance.

Key steps:
1. Checkout code (`actions/checkout` with full history).
2. Setup Node.js 20 and npm cache.
3. Install dependencies (`npm ci`).
4. Run centralization lint script.
5. Upload centralization report as artifact.
6. Run `nx affected --target=lint`.

Why first:
- Lint checks are usually cheaper than test/build.
- Blocking early reduces wasted compute time.

#### `test` job
Purpose: verify behavior still works.

Key steps:
1. Wait for lint success (`needs: lint`).
2. Checkout + setup Node + `npm ci`.
3. Run `nx affected --target=test` with coverage flags.
4. Upload coverage report artifact.

Notes:
- Uses `RUN_STRESS_TESTS=0` in CI to avoid heavy stress tests by default.
- Coverage artifacts help debugging and quality tracking.

#### `build` job
Purpose: verify project can compile/package successfully.

Key steps:
1. Wait for test success (`needs: test`).
2. Checkout + setup Node + `npm ci`.
3. Run `nx affected --target=build`.

Why after tests:
- Building untested code may produce artifacts for unstable logic.
- This order increases confidence in build output.

#### `typecheck` job
Purpose: static type safety validation.

Key steps:
1. Wait for lint success (`needs: lint`).
2. Checkout + setup Node + `npm ci`.
3. Run `nx affected --target=typecheck`.

Why parallel branch after lint:
- Typecheck and tests validate different quality dimensions.
- They can run independently after basic lint gate.

---

### Nx Affected - Beginner Explanation

#### What problem does it solve?
In monorepos, running lint/test/build for every project every time is slow and expensive.

#### How `nx affected` helps
It compares:
- base (`origin/main`) and
- head (`HEAD`)
to detect changed files and impacted dependent projects.

Then it runs the target only for impacted projects.

Benefits:
- Faster CI completion.
- Lower compute usage.
- Better scaling as repository grows.
- Faster feedback for developers.

---

### Push-to-Develop Walkthrough (Narrative)

When a developer pushes to `develop`, this happens:
1. GitHub receives `push` event.
2. Workflow trigger matches `develop`, so CI starts.
3. `lint` job runs first.
4. If lint passes:
   - `test` starts.
   - `typecheck` starts.
5. If test passes, `build` starts.
6. Final workflow status is reported (green if all pass).

If any required dependency job fails, downstream dependent jobs do not execute.

---

### Reflection (Day 1 - Detailed)

CI in this repo is an automated quality gate for every important branch update and PR.  
It enforces a staged safety model: lint first, then behavior/type validation, then build.  
This order reduces risk, catches problems early, and avoids unnecessary pipeline cost.  
`nx affected` is a key performance strategy because it limits checks to impacted projects only.  
One remaining confusion: understanding transitive impact calculation in complex Nx dependency graphs.

---

### Definition of Done (Day 1)
I can confidently explain what happens on a push to `develop`, including trigger, job order, dependencies, and why this ordering protects quality.

### Quick Self-Check Questions
- Can I explain `on`, `jobs`, and `needs` in one minute?
- Can I draw `lint -> test -> build` and `lint -> typecheck` from memory?
- Can I explain why build should not run before tests?
- Can I explain why `nx affected` is faster than running everything?

---

## Day 2+ - Learning Template

### Date
- YYYY-MM-DD

### Day Title
- (Example: Branching and Pull Request Strategy)

### Goal
- What I need to understand and be able to explain.

### Theory Notes
- Core concepts:
- Why it matters:
- Key terms:

### Repo-Based Learning
- Files reviewed:
- What I learned from those files:

### Practical Tasks
- Task A:
- Task B:
- Task C:

### Reflection
- What CI/CD/DevOps value this gives the team:
- What became clear today:
- What is still confusing:

### Definition of Done
- Observable statement that proves I learned the day objective.

---

## Glossary - Core Terms

- **Workflow**: Full automation process in GitHub Actions.
- **Job**: A stage within a workflow (e.g., lint/test/build).
- **Step**: A single command or action inside a job.
- **Runner**: Machine/environment where jobs execute.
- **Trigger (`on`)**: Event that starts workflow.
- **Dependency (`needs`)**: Job ordering rule.
- **Artifact**: Saved output from CI (reports, coverage, build files).
- **Fail Fast**: Stop pipeline early when critical checks fail.
- **Monorepo**: One repository containing multiple apps/libs.
- **Nx Affected**: Runs targets only for changed/impacted projects.

