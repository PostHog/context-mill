# Install skill evals

Checks that a coding agent with one of the omnibus `instrument-*` skills sets up PostHog correctly. Each eval gives the agent a one-line request in a real app with the skill staged, and a judge grades the result against a rubric. The evals run on [Gauge](https://docs.withgauge.com/agents).

## What runs

`evals.json` lists the skills, their prompts, their apps, and their criteria files. One eval is one skill on one app, named `[install-skills] <skill> on <app>`.

| Skill | Apps | Criteria |
|---|---|---|
| `instrument-integration` | 36 | 22 |
| `instrument-product-analytics` | 36 | 28 |
| `instrument-error-tracking` | 30 | 22 |
| `instrument-llm-analytics` | 8 | 28 |
| `instrument-logs` | 11 | 19 |
| `instrument-metrics` | 11 | 21 |
| `instrument-tracing` | 11 | 22 |
| `instrument-feature-flags` | 2 | 22 |

- **Apps.** They come from [wizard-workbench](https://github.com/PostHog/wizard-workbench) `apps/`, pinned to the commit in `evals.json`. Logs, metrics, and tracing use the server apps from `basic-integration`.
- **Skills.** Gauge tracks `PostHog/skills#main/skills/omnibus/<skill>`, the mirror of this repo's released skills. A change here reaches the evals after a release and the daily mirror sync.
- **Agents.** Each saved eval holds four models. A launch uses `defaultRunAgent` from `evals.json` unless you pass `--agent`.

## The criteria

`criteria/` holds one JSON file per group, and every item is its own judged criterion.

- **`common.json`.** The wizard-workbench items on file analysis and app sanity.
- **`instrument-integration.json`.** The wizard install items only, plus `sc_install_only`, which fails a run that adds events, error tracking, or flags nobody asked for.
- **`instrument-product-analytics.json`.** The full wizard PostHog implementation and event quality items.
- **`instrument-llm-analytics.json`.** The wizard-workbench AI observability rubric.
- **The other four.** Written from each skill's own steps.

The wording follows wizard-workbench `services/pr-evaluator/prompts/`. One item differs: `ph_reverse_proxy` passes when the agent suggests a reverse proxy in its handoff, since the task can't set one up.

## The weekly sample

Running all 145 evals costs about 16 Gauge credits each. The weekly run takes `weeklySample` apps per skill, 32 runs in total. It walks each skill's apps one framework at a time, so a week spreads across frameworks, and the window moves each week until every app has run.

## Run it

Sign in once with `npm install -g @withgauge/cli` and `gauge auth login`.

```sh
node evals/install-skills/gauge.mjs plan --sample                 # what this week's sample holds, starts nothing
node evals/install-skills/gauge.mjs sync                          # make Gauge match evals.json, starts nothing
node evals/install-skills/gauge.mjs run --sample                  # launch this week's sample (spends credits)
node evals/install-skills/gauge.mjs run --skill instrument-logs   # launch one skill on every app
node evals/install-skills/gauge.mjs run --app next-js             # launch every skill on matching apps
node evals/install-skills/gauge.mjs results --sample --wait       # wait, then print a results table
```

`--skill`, `--app`, `--sample`, `--week <n>`, and `--limit <n>` work on every command. `run` also takes `--agent <agent:model>`.

Gauge stages a skill only as `name@label`, so `sync` pins the newest label of each skill. Run `sync` before `run`, or the run uses the last pinned version.

## From GitHub Actions

`.github/workflows/install-skill-evals.yml` runs the sample every Monday. Run it by hand from the Actions tab to pick the sample or everything, one skill, matching apps, and the agent. The results table lands in the job summary.

The workflow needs a `GAUGE_API_TOKEN` repository secret holding an org API key for the `posthog-main` Gauge org.

## Read a failure

Open the run in Gauge, or read it with `gauge run get <run-id> --logs --hosted`. A failure can come from the skill, the docs it bundles, the agent, or a badly worded criterion. Only the first two are fixes in this repo.
