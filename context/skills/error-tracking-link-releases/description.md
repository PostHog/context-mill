# Link releases to PostHog Error Tracking for {display_name}

This skill links every exception a {display_name} app sends to the release that produced it. {display_name} runs its source directly, so there are no source maps to upload and stack traces are already readable. What is missing is the release: which deploy, version, and commit the error came from.

The mechanism has two halves. The production deploy **resolves** a release (finds or creates it in PostHog) and gets back its ID. The deployed app then starts with that ID in its `POSTHOG_RELEASE_ID` environment variable, and the SDK sends it as `$release_id` on every event. The SDK reads the variable **once, when the PostHog client is created**, and treats an unset or blank value as "no release".

## Reference files

{references}

The {display_name} reference is the source of truth for the minimum SDK version, the GitHub Actions step, and the CLI command. When this page and the reference disagree, follow the reference.

## Steps

The stages of linking releases, in order. Each step has a short overview, gotchas under **Tips**, and per-setup notes under **Examples**.

### Update the SDK

Release linking needs a recent SDK. Older versions ignore `POSTHOG_RELEASE_ID` without an error. Minimum versions: `posthog` 7.59.0 (Python), `posthog-ruby` 3.25.0 (Ruby), `posthog/posthog-php` 4.14.0 (PHP).

#### Tips
- Read the version the project actually resolves: the lockfile (`poetry.lock`, `uv.lock`, `Pipfile.lock`, `Gemfile.lock`, `composer.lock`) or an exact pin in `requirements*.txt`. The manifest's range alone does not tell you what is installed.
- Already at or above the minimum: change nothing.
- Below the minimum within the same major version: raise the manifest constraint to the minimum, then refresh the lock for **that one package** with the project's own tool (examples below). Never regenerate the whole lock.
- Below the minimum in an **older major version**, in an app that already called the SDK before this change: do not upgrade. A major upgrade can change APIs that existing code calls. Name it as a manual follow-up with the target version.
- The SDK was added in this same run (the install handoff says so): no existing code depends on the old version, so raise it straight to the minimum, across a major version too.
- When the tool that refreshes the lock is missing, or the refresh fails for a reason in the environment (no network, no interpreter), keep the raised constraint and name the lock refresh as a manual follow-up. A constraint that the lock does not satisfy fails the next install loudly, and that is better than a release ID that is ignored without an error.
- **Never lower the SDK below the minimum to make a local install pass.** The production runtime decides what installs: the base image in the `Dockerfile`, the CI image, `.python-version`, `runtime.txt`, the `ruby` line in the `Gemfile`, the `php` requirement in `composer.json`. A local interpreter that is older than that runtime (for example, Python 3.9 on the laptop while the image runs 3.12; `posthog` 7.x needs Python 3.10 or later) is the local environment's gap. Keep the minimum, and name the local interpreter upgrade as a manual follow-up. Only when the **production** runtime is too old for the minimum version, leave the version as it is and name the runtime upgrade as the follow-up.

#### Examples
- **pip + `requirements.txt`**: set `posthog>=7.59.0` (or raise an exact pin to at least `7.59.0`). No lock to refresh.
- **Poetry / uv / Pipenv**: raise the constraint in `pyproject.toml` / `Pipfile`, then `poetry update posthog`, `uv lock --upgrade-package posthog`, or `pipenv update posthog`.
- **Bundler**: raise the constraint in the `Gemfile` if it has one (`gem "posthog-ruby", ">= 3.25.0"`), then `bundle update posthog-ruby`. On Rails, `posthog-rails` pins one exact `posthog-ruby` version, so update both in one command: `bundle update posthog-rails posthog-ruby`.
- **Composer**: `composer require "posthog/posthog-php:^4.14" --no-interaction`. It updates `composer.json` and refreshes only that package in `composer.lock`.

### Find the production deploy

Resolve the release only where the app is **deployed to production**. Resolving creates the release when it does not exist yet, so a step that runs on pull requests, preview builds, test jobs, or local development makes a release for every branch. **Only edit CI and deploy files that already exist.** Never create a new workflow, pipeline, or deploy script. Trace the path first:

1. Open every CI config in the repo (`.github/workflows/*`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `azure-pipelines.yml`, …) and find the job that deploys to production. It is usually gated on the default branch, a tag, a release event, or a manual dispatch, and it runs the deploy command: `docker push` + a rollout, an SSH deploy, `kamal deploy`, `fly deploy`, a PaaS CLI, or a deploy script.
2. Follow that job to where the app **process** starts: a `Dockerfile`, a compose file, a systemd unit, a PHP-FPM pool config, a `Procfile`, a platform config. This is where the ID must arrive (see "Give the release ID to the running app").
3. No CI config and no deploy path you can trace: make no CI changes. Hand the requirement to the user (see "Untraceable setup").

#### Tips
- Leave test, lint, and pull-request jobs alone, even when they build the same image. When one workflow both tests pull requests and deploys `main`, put the resolve step in the deploy job only. If the deploy job itself also runs on pull requests, add a condition to the resolve step so it runs only for the production event.
- Several jobs deploy the same commit (a matrix, or separate web and worker jobs)? Resolve the release **once**, in one job, and pass its ID to the others through job outputs. Two jobs that resolve the same new release at the same time can both try to create it, and one of them then fails.
- A workflow that already uploads source maps (for example, a JavaScript frontend in the same repo) uses the repository name and commit SHA for its release by default, and so does the resolve step. Keep the defaults and both steps link to one release. Set `release-name` / `release-version` only when the source map upload sets custom ones, and then set the same values.

### Resolve the release in CI

The resolve step needs a PostHog **personal API key** with the error tracking write scope, and the project ID. It reads the repository name and commit from the CI run or from Git. It names the release after the repository and uses the commit SHA as the version.

#### Tips
- You cannot create CI secrets. Reference them by name. The user creates them after the run.
- Reuse credential names the pipeline already has. If the repo already uploads source maps with `POSTHOG_CLI_API_KEY` / `POSTHOG_CLI_PROJECT_ID` secrets, read those. Otherwise use the names from the reference: the secret `POSTHOG_CLI_API_KEY` and, on GitHub Actions, the variable `POSTHOG_PROJECT_ID`.
- The host: US Cloud is the default. For any other PostHog app URL (EU Cloud `https://eu.posthog.com`, or a self-hosted instance), set the host explicitly to the PostHog app URL from your project context. The host is not a secret, so write it as a literal.
- A deploy must never fail because PostHog is unreachable or the secret is not created yet. On GitHub Actions, add `continue-on-error: true` and `timeout-minutes: 5` to the resolve step. With the CLI, let a failed resolve produce an empty ID. The SDK treats an empty `POSTHOG_RELEASE_ID` as unset.
- Never write a key value into a file. Secrets stay in the CI provider's secret store.

#### Examples
- **GitHub Actions** — add the `PostHog/resolve-release@v1` action to the deploy job, **before** the step that ships the app, and read its `release-id` output where the ID has to go:
  ```yaml
  - name: Resolve PostHog release
    id: posthog-release
    uses: PostHog/resolve-release@v1
    continue-on-error: true
    timeout-minutes: 5
    with:
      api-key: ${{ secrets.POSTHOG_CLI_API_KEY }}
      project-id: ${{ vars.POSTHOG_PROJECT_ID }}
      # Only when the PostHog app URL is not US Cloud:
      # host: https://eu.posthog.com
  ```
  The action does not need a checkout and installs its own checksum-verified `posthog-cli`. Its output is `${{ steps.posthog-release.outputs.release-id }}`.
- **GitHub Actions, several deploy jobs** — resolve in one job, expose it as a job output (`outputs: release-id: ${{ steps.posthog-release.outputs.release-id }}`), add `needs: <that job>` to the others, and read `${{ needs.<that job>.outputs.release-id }}` there.
- **GitLab CI, CircleCI, Jenkins, Bitbucket, and other providers** — run `posthog-cli release resolve` in the deploy job, from a checkout of the repository. The CLI reads `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, and `POSTHOG_CLI_HOST` from the job's environment. Expose them through the provider's secret store (GitLab: **Settings → CI/CD → Variables**, injected into every job automatically). Install the CLI in the job:
  ```yaml
  deploy:
    stage: deploy
    # PostHog release linking: this job needs POSTHOG_CLI_API_KEY (masked) and
    # POSTHOG_CLI_PROJECT_ID as CI/CD variables (Settings → CI/CD → Variables).
    script:
      - curl --proto '=https' --tlsv1.2 -LsSf https://download.posthog.com/cli | sh
      - export PATH="$HOME/.posthog:$PATH"
      - export POSTHOG_RELEASE_ID="$(posthog-cli release resolve || true)"
      - ./deploy.sh   # must hand POSTHOG_RELEASE_ID to the app — see the next step
  ```
  The command prints only the release ID. Use `npm install -g @posthog/cli` instead of the installer when the job image already ships Node. The CLI needs 0.12.0 or later. The installer needs `curl` in the image. On a slim image that has no `curl`, install it in the same job with the image's package manager. Set `POSTHOG_CLI_HOST` in the job's `variables:` only when the PostHog app URL is not US Cloud.

### Give the release ID to the running app

This is where release linking usually fails without an error. The ID must be in the environment of **the process that creates the PostHog client**, and that process is rarely the CI step that resolved the release. The environment does not cross a `docker build`, an SSH session, or a process manager on its own. At every boundary between the CI step and the app process, pass the value on explicitly. Pass it the same way the deploy already passes the app's other runtime variables.

#### Tips
- The release ID is **not** a secret. You can bake it into an image with `ARG` + `ENV`, write it into a unit or env file on the server, or pass it on a command line.
- Docker: bake it into the **runtime (final) stage**, because the running container reads it. This is the opposite of source-map credentials, which belong in the build stage. A value set only in a build stage never reaches the running container.
- The same boundary has names too: while you are in the start step, check that the variables the app's PostHog init reads (its token and host) also reach the process by the same names. If the start step passes the app's other variables by hand and leaves those out, add them the same way and name any new secret in your handoff.
- PHP-FPM removes environment variables from its workers by default (`clear_env = yes`). When the repo ships a pool config, check its `clear_env`. If it is `yes` or not set, add `env[POSTHOG_RELEASE_ID] = $POSTHOG_RELEASE_ID` to that pool (the master process must have the variable, for example from the container's `ENV`). The official `php:*-fpm` Docker images set `clear_env = no` in `docker.conf`, so a stock image passes the container's environment through. A repo config that sets `clear_env` again overrides that.
- Laravel with `php artisan config:cache` does not load `.env` at runtime. A value written only to the server's `.env` file never reaches `getenv()`, which is how the SDK reads it. The ID must be a real process environment variable: a container `ENV`, the FPM pool `env[...]`, or the service environment.
- A long-running server (gunicorn, uWSGI, Puma, Unicorn, PHP-FPM) gives workers the master process's environment at start. Put the ID where the service manager reads it, then restart the service so the new value takes effect. A graceful reload does not re-read the service environment.
- Leave the ID out of `.env`, `.env.example`, and every local config. Local runs send no release ID, and that is the correct behavior.

#### Examples
- **CI builds a Docker image** — pass the ID as a build argument and declare it in the final stage:
  ```yaml
  - name: Build and push image
    uses: docker/build-push-action@v6
    with:
      # ...existing context/push/tags...
      build-args: |
        POSTHOG_RELEASE_ID=${{ steps.posthog-release.outputs.release-id }}
  ```
  ```dockerfile
  # Final stage: the running container reads it when the PostHog client is created.
  ARG POSTHOG_RELEASE_ID
  ENV POSTHOG_RELEASE_ID=$POSTHOG_RELEASE_ID
  ```
  Merge into the existing `build-args:` / `with:` block. Do not add a second build step. With raw `docker build`, add `--build-arg POSTHOG_RELEASE_ID="$POSTHOG_RELEASE_ID"`.
- **CI starts the container** (`docker run` / `docker compose up` in the deploy script, often over SSH) — pass it with the other runtime variables: `-e POSTHOG_RELEASE_ID="${{ steps.posthog-release.outputs.release-id }}"`, or an `environment:` entry in the compose file that reads `${POSTHOG_RELEASE_ID}` from the shell that runs compose.
- **SSH deploy that starts the process inline** (`nohup gunicorn …`, `bundle exec puma -d`) — set it inline on that command, exactly like the variables already passed there. Actions substitutes `${{ … }}` before it sends the script:
  ```yaml
  script: |
    cd /srv/app
    POSTHOG_RELEASE_ID="${{ steps.posthog-release.outputs.release-id }}" \
      nohup gunicorn app:app > app.log 2>&1 &
  ```
- **SSH deploy that restarts a service** (systemd, supervisord) — the SSH session's environment never reaches the service. Write the value into the file the unit already reads (its `EnvironmentFile=`), replace the old line rather than appending another, and restart the service. If the repo ships the unit or its env file template, add `POSTHOG_RELEASE_ID` there too.
- **PHP-FPM pool config in the repo**:
  ```ini
  ; Pass the release ID from the master process to the workers.
  env[POSTHOG_RELEASE_ID] = $POSTHOG_RELEASE_ID
  ```
- **Platforms** (Fly.io, Render, Heroku, Kamal, Kubernetes) — use the platform's per-deploy environment mechanism: `fly deploy --env POSTHOG_RELEASE_ID=…`, a Kamal `env.clear` entry filled from the deploy environment, a Kubernetes `env:` entry set by the rollout (`kubectl set env` / Helm `--set`). If the platform only takes environment variables from its dashboard, you cannot set a per-deploy value. Name that as a manual follow-up.

### Leave local development alone

Release linking is a **production-deploy concern only**. Local runs, tests, and preview builds send no release ID, and that is correct.

#### Tips
- Do not edit local run scripts, `Makefile` targets, `Procfile.dev`, `bin/dev`, `docker-compose.yml` files used for development, or test configuration.
- Do not add `POSTHOG_RELEASE_ID` or the CLI credentials to `.env` or `.env.example`, and do not ask for the personal API key. Nothing runs locally that uses them.
- Do not install `posthog-cli` locally, and do not run `posthog-cli release resolve` yourself. Running it creates a real release.

### Verify and hand off

You cannot run the deploy. Check the path by reading it, then report what the user still owes.

#### Tips
- Walk the path once more, from the resolve step to the process that creates the client. Check that every hop passes the value on, and that the name is exactly `POSTHOG_RELEASE_ID` at the end.
- In your handoff, list the files you changed (paths only), the SDK version before and after, and the traced deploy path, hop by hop.
- List every secret and variable the user must create, with its exact name and where it goes: GitHub **Settings → Secrets and variables → Actions** (secret `POSTHOG_CLI_API_KEY`, variable `POSTHOG_PROJECT_ID`), or the provider's equivalent. The key needs the error tracking write scope.
- Say plainly that local runs are unchanged and send no release ID.
- Verification after the next production deploy: capture an exception, open it in Error Tracking. The stack trace shows the release with its version and commit, and the exception's `$release_id` equals the ID the deploy resolved.

#### Examples
- **Untraceable setup** — no CI config, no deploy script, and no start step you can open: make no CI changes. Tell the user that their production deploy must run `posthog-cli release resolve` (or the `PostHog/resolve-release` action) and start the app with the printed ID in `POSTHOG_RELEASE_ID`. Link the {display_name} reference. If part of the path is recognisable (for example, a `Dockerfile` that an unknown CI builds), wire the parts you recognise and say exactly what the rest must pass in, such as `--build-arg POSTHOG_RELEASE_ID=…`.

## General tips
- Two different keys: the **personal API key** resolves releases in CI; the **public project token** powers the SDK at runtime. Do not swap them, and never put the personal key in the app's environment.
- The SDK reads `POSTHOG_RELEASE_ID` once, when the client is created. Setting it after the app has started does nothing until the next restart.
- Only production deploys resolve releases. Pull requests, previews, tests, and local runs stay untouched.
- Only edit deploy files that already exist, and follow the patterns they already use.

## Framework guidelines

{commandments}
