#!/usr/bin/env node
// Syncs and runs the install-skill evals on hosted Gauge.
// Usage: node evals/install-skills/gauge.mjs <sync|run|results|plan> [--sample] [--week <n>] [--skill <name>] [--app <substring>] [--agent <agent:model>] [--limit <n>] [--wait]
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(join(here, 'evals.json'), 'utf8'))
const [command, ...rest] = process.argv.slice(2)
const flag = (name) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] || undefined : undefined)
const has = (name) => rest.includes(name)

function gauge(args, { allowFail = false } = {}) {
    try {
        return JSON.parse(execFileSync('gauge', [...args, '--hosted', '--org', config.org, '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024 }))
    } catch (error) {
        if (!allowFail) throw new Error(`gauge ${args.join(' ')} failed: ${String(error.stderr || error.message).slice(-500)}`)
        return { failed: `${error.stdout || ''}${error.stderr || ''}` }
    }
}

const list = (value) => (Array.isArray(value) ? value : (value.items ?? value.runs ?? []))
const evalName = (skill, app) => `[install-skills] ${skill} on ${app}`

// The weekly sample takes `weeklySample` apps per skill. It walks the apps one framework at a
// time, so a week spreads across frameworks, and the window moves each week until every app has run.
function sampleOf(entry, week) {
    const groups = new Map()
    for (const app of entry.apps) {
        const framework = app.split('/')[0]
        groups.set(framework, [...(groups.get(framework) ?? []), app])
    }
    const ordered = []
    for (let i = 0; ordered.length < entry.apps.length; i++) {
        for (const apps of groups.values()) if (apps[i]) ordered.push(apps[i])
    }
    const size = Math.min(entry.weeklySample, ordered.length)
    const start = (week * size) % ordered.length
    return Array.from({ length: size }, (_, i) => ordered[(start + i) % ordered.length])
}

function selected() {
    const skill = flag('--skill')
    const app = flag('--app')
    const limit = Number(flag('--limit') ?? Infinity)
    const week = Number(flag('--week') ?? Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)))
    const out = []
    for (const entry of config.skills) {
        if (skill && entry.skill !== skill) continue
        for (const name of has('--sample') ? sampleOf(entry, week) : entry.apps) {
            if (app && !name.includes(app)) continue
            out.push({ entry, app: name, name: evalName(entry.skill, name) })
        }
    }
    return out.slice(0, limit)
}

function criteriaFor(entry) {
    return entry.criteria.flatMap((file) => JSON.parse(readFileSync(join(here, 'criteria', `${file}.json`), 'utf8')))
}

// Gauge only stages a skill as name@label, so each sync pins the newest label.
function latestLabel(skill) {
    const versions = gauge(['skills', 'get', skill]).versions ?? []
    return [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].label
}

function agentsOf(saved) {
    return (saved.agents ?? []).map((a) => `${a.agent.toLowerCase().replace('_cli', '').replace('_', '-')}:${a.models.join(',')}`)
}

function sync() {
    const existing = new Map(list(gauge(['eval', 'list'])).map((e) => [e.name, e]))
    const scratch = mkdtempSync(join(tmpdir(), 'install-skill-evals-'))
    const labels = new Map()
    const counts = { created: 0, updated: 0, unchanged: 0 }
    for (const { entry, app, name } of selected()) {
        if (!labels.has(entry.skill)) labels.set(entry.skill, latestLabel(entry.skill))
        const skillRef = `${entry.skill}@${labels.get(entry.skill)}`
        const prompt = entry.prompt.replace('{app}', `${entry.appsRoot}/${app}`)
        const criteria = criteriaFor(entry)
        const saved = existing.get(name)
        const same =
            saved &&
            saved.promptText === prompt &&
            saved.repoRef === config.ref &&
            JSON.stringify(saved.skillRefs) === JSON.stringify([skillRef]) &&
            JSON.stringify(agentsOf(saved)) === JSON.stringify(config.agents) &&
            JSON.stringify(saved.criteria.map((c) => [c.name, c.rubric])) === JSON.stringify(criteria.map((c) => [c.name, c.rubric]))
        if (same) {
            counts.unchanged++
            continue
        }
        const criteriaFile = join(scratch, `${entry.skill}.json`)
        writeFileSync(criteriaFile, JSON.stringify(criteria))
        const shared = ['--text', prompt, '--ref', config.ref, '--skill', skillRef, '--criteria-file', criteriaFile, ...config.agents.flatMap((a) => ['--agent', a])]
        if (saved) {
            gauge(['eval', 'edit', saved.id, ...shared])
            counts.updated++
        } else {
            gauge(['eval', 'create', '--name', name, '--repo', config.repo, '--samples', '1', '--cadence', 'none', '--tag', config.tag, ...shared])
            counts.created++
        }
    }
    console.log(counts)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A launch holds more credits than the run ends up costing, so wait for holds to clear and retry.
async function run() {
    const existing = new Map(list(gauge(['eval', 'list'])).map((e) => [e.name, e]))
    const agent = flag('--agent') ?? config.defaultRunAgent
    let pending = selected().filter(({ name }) => existing.has(name) || console.log(`no saved eval, run sync first: ${name}`))
    for (let attempt = 0; pending.length && attempt < 30; attempt++) {
        const next = []
        for (const item of pending) {
            const result = gauge(['run', '--eval', existing.get(item.name).id, '--agent', agent, '--samples', '1', '--yes'], { allowFail: true })
            if (!result.failed) console.log(`launched ${item.name}`)
            else if (result.failed.includes('Out of credits')) next.push(item)
            else console.log(`failed ${item.name}: ${result.failed.slice(-200)}`)
        }
        pending = next
        if (pending.length) await sleep(60_000)
    }
    if (pending.length) console.log(`not launched, out of credits: ${pending.map((p) => p.name).join(', ')}`)
}

const DONE = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'ERRORED']

// Prints one Markdown table row per eval from its newest run. With --wait, polls until every run is graded.
async function results() {
    const existing = new Map(list(gauge(['eval', 'list'])).map((e) => [e.name, e]))
    const items = selected()
    for (let attempt = 0; ; attempt++) {
        const rows = []
        let open = 0
        for (const { name } of items) {
            const saved = existing.get(name)
            const latest = saved && list(gauge(['run', 'list', '--eval', saved.id]))[0]
            if (!latest) {
                rows.push(`| ${name} | no runs | | | |`)
                continue
            }
            const run = gauge(['run', 'get', latest.id])
            const graded = run.criterionResults ?? []
            const failed = graded.filter((c) => !c.passed).map((c) => c.name)
            if (!DONE.includes(run.status) || (run.status === 'SUCCEEDED' && !graded.length)) open++
            rows.push(`| ${name} | ${run.status} | ${run.model} | ${graded.length - failed.length}/${graded.length} | ${failed.join(', ')} |`)
        }
        if (!has('--wait') || !open || attempt >= 90) {
            console.log(['| Eval | Status | Model | Passed | Failed criteria |', '|---|---|---|---|---|', ...rows].join('\n'))
            return
        }
        await sleep(60_000)
    }
}

// Lists what the other commands would act on, and starts nothing.
function plan() {
    const items = selected()
    for (const { name } of items) console.log(name)
    console.log(`${items.length} evals`)
}

const commands = { sync, run, results, plan }
if (!commands[command]) {
    console.error('usage: gauge.mjs <sync|run|results|plan> [--sample] [--week <n>] [--skill <name>] [--app <substring>] [--agent <agent:model>] [--limit <n>] [--wait]')
    process.exit(1)
}
await commands[command]()
