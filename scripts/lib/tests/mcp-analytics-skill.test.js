import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DOCS = 'https://posthog.com/docs/mcp-analytics';
const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Ruby', 'Rust'];
const INSTALL_PAGES = ['typescript', 'python', 'go', 'ruby', 'rust'];
const REDIRECTED = ['custom-servers.md', 'installation.md'];
const REPORT_FILE = 'posthog-mcp-analytics-report.md';

const urlOf = (entry) => (typeof entry === 'string' ? entry : entry.url);

describe('mcp-analytics skill family', () => {
    const config = loadSkillsConfig(CONFIG_DIR);
    const variants = expandSkillGroups(config, CONFIG_DIR).filter((s) => s._group === 'mcp-analytics');
    const urlsOf = (id) => variants.find((s) => s.id === id).docs_urls.map(urlOf);

    it('keeps the command skill (the variant the wizard installs by id) and the per-language variants', () => {
        expect(variants.map((s) => s.id).sort()).toEqual([
            'mcp-analytics',
            'mcp-analytics-python',
        ]);
    });

    // Every variant shares one template, which routes to every language's installation page.
    it.each(variants.map((s) => [s.id]))('%s bundles every installation page', (id) => {
        expect(urlsOf(id)).toEqual(
            expect.arrayContaining(INSTALL_PAGES.map((language) => `${DOCS}/installation/${language}.md`)),
        );
    });

    it.each(variants.flatMap((s) => REDIRECTED.map((page) => [s.id, page])))('%s links no redirected page %s', (id, page) => {
        expect(urlsOf(id)).not.toContain(`${DOCS}/${page}`);
    });

    // The generator names each reference after the last URL path segment, so
    // `installation/python.md` and `libraries/python.md` would overwrite each other.
    it.each(variants.map((s) => [s.id]))('%s bundles every doc under a distinct filename', (id) => {
        const filenames = urlsOf(id).map((url) => url.split('/').pop());
        expect(new Set(filenames).size).toBe(filenames.length);
    });

    it.each(LANGUAGES)('the command skill description names %s', (language) => {
        const command = variants.find((s) => s.id === 'mcp-analytics');
        expect(command.description).toContain(language);
        expect(command.display_name).toContain(language);
    });
});

describe('mcp-analytics instructions', () => {
    const [skill] = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR).filter(
        (s) => s.id === 'mcp-analytics',
    );
    const text = skill._template;
    const steps = text.split(/^### (?=STEP \d)/m).slice(1);
    const abortSection = text.slice(text.indexOf('### Abort cases'), text.indexOf('## Instructions'));
    const bundled = [...skill.docs_urls, ...skill._sharedDocs].map((entry) => urlOf(entry).split('/').pop());

    it('has seven steps', () => {
        expect(steps.map((step) => step.slice(0, 6))).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `STEP ${n}`));
    });

    // A language part opens with a `#### Go` heading or a bold `**Go` lead.
    it.each(steps.flatMap((step) => ['Go', 'Ruby', 'Rust'].map((language) => [step.slice(0, 6), language, step])))(
        '%s has a %s part',
        (_step, language, step) => {
            expect(step).toMatch(new RegExp(`^(#### ${language}$|\\s*(- )?\\*\\*${language}\\b)`, 'm'));
        },
    );

    it('lists every [ABORT] reason the steps emit in the abort cases', () => {
        const emitted = [...text.matchAll(/`\[ABORT\] ([^`<]+)`/g)].map(([, reason]) => reason);
        const listed = [...abortSection.matchAll(/^- `\[ABORT\] ([^`]+)`/gm)].map(([, reason]) => reason);
        expect(emitted.length).toBeGreaterThan(0);
        expect(listed).toEqual(expect.arrayContaining(emitted));
    });

    it('points only at reference files the skill bundles', () => {
        const named = [...text.matchAll(/`([\w./-]+\.md)`/g)].map(([, file]) => file).filter((f) => f !== REPORT_FILE);
        expect(named.length).toBeGreaterThan(0);
        expect(bundled).toEqual(expect.arrayContaining(named));
    });

    // The wizard's bash fence (wizard src/agent/bash-fence.ts) denies these, so the agent can't run them.
    it.each([
        ['a version constraint, read as a redirect', /`[^`\n]*\b(add|install)\b[^`\n]*[<>][^`\n]*`/],
        ['chained commands', /`[^`\n]*&&[^`\n]*`/],
        ['pytest', /`(python -m )?pytest/],
        ['ruby itself', /`ruby -/],
        ['bundle exec beyond lint tools', /`bundle exec (ruby|rspec|rake)/],
        ['rustc', /`rustc/],
        ['cargo test', /`cargo test/],
        ['bare gofmt', /`gofmt/],
        ['uv add with an @ version', /`uv add [^`]*@/],
    ])('never tells the agent to run %s', (_command, pattern) => {
        expect(text).not.toMatch(pattern);
    });

    it('never has go build write a binary into the project', () => {
        expect(text).not.toMatch(/`go build (?!-o \/dev\/null )/);
    });

    it.each(REDIRECTED)('never names the redirected page %s', (page) => {
        expect(text).not.toContain(page);
    });

    it.each(LANGUAGES)('the unsupported-language abort lists %s as supported', (language) => {
        const line = abortSection.split('\n').find((l) => l.startsWith('- `[ABORT] unsupported language for mcp analytics`'));
        expect(line, 'abort cases list `[ABORT] unsupported language for mcp analytics`').toBeDefined();
        expect(line).toContain(language);
    });

    it('names no supported language as an unsupported example', () => {
        const examples = text.match(/written in anything else \(([^)]*)\)/)?.[1];
        expect(examples, 'guardrail lists examples as "written in anything else (...)"').toBeDefined();
        for (const language of LANGUAGES) expect(examples).not.toMatch(new RegExp(`\\b${language}\\b`));
    });

    // Each SDK's minimum version, read wherever the package name is followed by a version.
    it.each([
        ['@posthog/mcp', /@posthog\/mcp[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '0.18.0'],
        ['posthog (Python)', /(?<![\w/@-])posthog(?![\w/-])[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '7.62.0'],
        ['posthogmcpsdk', /posthogmcpsdk[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '1.34.0'],
        ['posthog-ruby', /posthog-ruby[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '3.29.0'],
        ['posthog-rs', /posthog-rs[^\d\n]{0,12}(\d+\.\d+\.\d+)/g, '0.29.0'],
    ])('states one floor for %s', (_sdk, pattern, floor) => {
        expect([...new Set([...text.matchAll(pattern)].map(([, version]) => version))]).toEqual([floor]);
    });

    it('TypeScript Path C delivers conversation handles', () => {
        const start = text.indexOf('**Path C — custom dispatcher:**');
        const pathC = text.slice(start, text.indexOf('**Path D', start));
        expect(pathC).toContain('posthog.prepareToolResult(result, prepared)');
        expect(pathC).not.toMatch(/[Cc]onversation[- ]id[^.]*(isn't|not) available/);
    });

    it.each([
        ['Ruby is reported as experimental', 'experimental and not officially supported'],
        ['the notice goes in the wizard report', REPORT_FILE],
        ['Ruby is never called production-ready', 'never describe the Ruby setup as production-ready'],
        ['the Ruby warning stays on', "Never suppress the gem's experimental warning"],
        ['Ruby reads the token without raising', 'ENV["POSTHOG_PROJECT_TOKEN"]'],
        ['Python P2 prepares each call', 'posthog.prepare_tool_call(name, arguments)'],
        ['Python P2 delivers the conversation handle', 'posthog.prepare_tool_result(result, prepared)'],
        ['Go offers the intent fallback', 'WithIntentFallback'],
        ['Go offers the opt-in missing-capability tool', 'WithMissingCapabilityTool'],
        ['Go reports unknown tools', '`$mcp_unknown_tool`'],
        ['Go reports input_required rounds', '`$mcp_input_required`'],
        ['Go tidies go.mod', '`go mod tidy`'],
        // A bare package name keeps an already-declared version, so these raise one below the floor.
        ['TypeScript upgrades an existing @posthog/mcp', 'The `@` version also raises an already-declared older version'],
        ['TypeScript takes versions from the install doc', 'keeping the `@` version it puts on each name'],
        ['Python raises a declared posthog pin', 'raise that declaration to `posthog>=7.62.0`'],
        ['Rust reports an rmcp bump from cargo add', 'say in the report that `cargo add` raised `rmcp`'],
        ['Rust is reported as experimental', 'The Rust SDK is experimental'],
        ['Rust reads the token without exiting', 'std::env::var("POSTHOG_PROJECT_TOKEN").unwrap_or_default()'],
        ['Rust drains events on shutdown', 'posthog.shutdown().await'],
        ['Ruby 3.4+ gets the gems posthog-ruby requires but does not declare', 'bundle add logger base64'],
    ])('%s', (_claim, needle) => {
        expect(text).toContain(needle);
    });

    it('handles hard-pin [ABORT], Python greenfield/8.x/<7 branches, Rust 1.x/0.x, and Go v2 / Rust 1.x snippets consistently', () => {
        const step3 = steps[2];
        const step4 = steps[3];
        const step5 = steps[4];
        const section = (step, lang) => {
            const header = `#### ${lang}`;
            const start = step.indexOf(header);
            const next = step.indexOf('\n#### ', start + header.length);
            return next === -1 ? step.slice(start) : step.slice(start, next);
        };

        const ts1 = steps[0].slice(
            steps[0].indexOf('- **TypeScript / JavaScript**'),
            steps[0].indexOf('\n- **Python**'),
        );
        expect(ts1).toContain('posthog-node');
        expect(ts1).toMatch(/`major 5`\s+vs\s+`major 6`/);
        expect(ts1).toContain('never cross majors on an existing install');

        for (const lang of ['TypeScript / JavaScript', 'Python', 'Rust']) {
            expect(section(step3, lang)).toContain('[ABORT] posthog package pinned below required floor');
        }
        const ts3 = section(step3, 'TypeScript / JavaScript');
        expect(ts3).toMatch(/^\- \*\*No existing `posthog-node` declaration \(greenfield\):\*\*[^\n]*install `@posthog\/mcp` and `posthog-node`/m);
        expect(ts3).toMatch(/^\- \*\*Already declared on `5\.x` or `6\.x`:\*\*[^\n]*never upgrade `posthog-node` across majors[^\n]*install only `@posthog\/mcp`/m);
        expect(ts3).not.toMatch(/Already declared on `5\.x` or `6\.x`[^\n]*reinstall\s+`?posthog-node/i);
        expect(ts3).toMatch(/^\- \*\*Hard-pinned below `5\.0\.0`\*\*[^\n]*\[ABORT\] posthog package pinned below required floor/m);
        expect(ts3).toMatch(/^\- \*\*Range below `5\.0\.0`\*\*[^\n]*never silently upgrade across majors[^\n]*\(If a wide range such as `>=4` or `\*` already allows `5\.x` or `6\.x`, keep that declaration and install `@posthog\/mcp`\.\)/m);
        expect(ts3).toMatch(/^\- \*\*Range below `5\.0\.0`\*\*[^\n]*\[ABORT\] posthog package pinned below required floor/m);

        const py3 = section(step3, 'Python');
        expect(py3).toMatch(/^\- \*\*Already declared on major 8:\*\*[^\n]*`<9`/m);
        const py7 = py3.slice(py3.indexOf('**Already declared on major 7:**'), py3.indexOf('**Already declared unversioned'));
        expect(py7).toContain('posthog>=7.62.0');
        expect(py7).toContain('<8');
        expect(py7).toContain('never upgrade across majors to `8.x`');
        expect(py7).toContain('[ABORT] posthog package pinned below required floor');
        expect(py3).toMatch(/^\- \*\*Already declared unversioned or on an earlier major \(`<7`\):\*\*/m);
        const pyLt7 = py3.slice(py3.indexOf('**Already declared unversioned'), py3.indexOf('**No existing'));
        expect(pyLt7).toContain('[ABORT] posthog package pinned below required floor');
        expect(pyLt7).toMatch(/unversioned \(`posthog`\) or uses a non-pinned range below `7`, write `python\.md`'s range \(`posthog>=8,<9`\)/);
        expect(py3).toMatch(/^\- \*\*No existing `posthog` declaration \(greenfield\):\*\*[^\n]*`posthog>=8,<9`/m);

        const go3 = section(step3, 'Go');
        expect(go3).toContain('`v1` `github.com/posthog/posthog-go` vs `v2` `github.com/posthog/posthog-go/v2`');
        expect(go3).toMatch(/On `v1`, run `go get github\.com\/posthog\/posthog-go\/posthogmcpsdk@latest` \(on `v2`, `github\.com\/posthog\/posthog-go\/posthogmcpsdk\/v2@latest`\)/);
        expect(go3).toContain('[ABORT] go toolchain older than 1.25');

        const rs3 = section(step3, 'Rust');
        expect(rs3).not.toContain('If `posthog-rs` is absent');
        expect(rs3).not.toContain('=0.x');
        expect(rs3).toMatch(/^\- \*\*Neither `posthog` nor `posthog-rs` is declared \(greenfield\):\*\*[^\n]*`cargo add` for `posthog` `1\.x`[^\n]*--features mcp/m);
        expect(rs3).toContain('posthog-rs = "1"');
        expect(rs3).toMatch(/^\- \*\*`posthog` \(`1\.x`\) or `posthog-rs = "1"` is already declared:\*\*[^\n]*`cargo add posthog@1 --features mcp`[^\n]*`posthog-rs@1 --features mcp`/m);
        expect(rs3).toContain('"=0.28.0"');
        expect(rs3).toMatch(/^\- \*\*`posthog` \(`1\.x`\) or `posthog-rs = "1"` is already declared:\*\*[^\n]*\[ABORT\] posthog package pinned below required floor/m);
        const rs0x = rs3.slice(rs3.indexOf('**`posthog-rs` (`0.x`) is already declared:**'));
        expect(rs0x).toContain('keep `posthog-rs` within `0.x`');
        expect(rs0x).toContain('0.29.0');
        expect(rs0x).toContain('[ABORT] posthog package pinned below required floor');
        expect(rs3).toContain('[ABORT] rmcp older than 3.7');
        expect(rs3).toContain('[ABORT] rust toolchain older than 1.88');

        const go4 = section(step4, 'Go');
        expect(go4).toContain('"github.com/posthog/posthog-go/v2"');
        expect(go4).toContain('"github.com/posthog/posthog-go/v2/posthogmcp"');
        expect(go4).toContain('"github.com/posthog/posthog-go/posthogmcpsdk/v2"');

        const rs2 = section(steps[1], 'Rust');
        expect(rs2).toContain('posthog_rs::mcp::instrument');
        expect(rs2).not.toMatch(/when staying on `posthog-rs` 0\.x/);

        const rs4 = section(step4, 'Rust');
        expect(rs4).toContain('posthog::client(');
        expect(rs4).toContain('posthog::mcp::instrument(');
        expect(rs4).toContain('`posthog-rs` crate (`0.x` or `1.x` forwarding)');
        expect(rs4).toContain('posthog_rs::client(');
        expect(rs4).toContain('posthog_rs::mcp::instrument(');
        expect(step5).toContain('posthog::client');
        expect(step5).toContain('`posthog_rs::client` when keeping the `posthog-rs` crate');
    });

    // The version rules this change added to the STEP 3 language branches, so deleting or editing one fails here.
    const STEP3_CLAUSES = {
        "TypeScript / JavaScript": [
            "Look for an existing `posthog-node` declaration in `package.json` first:",
            "install `@posthog/mcp` and `posthog-node` with the project's package manager and the install command in `typescript.md`, keeping the `@` version it puts on each name",
            "**stay on that existing `posthog-node` major** (never upgrade `posthog-node` across majors) and install only `@posthog/mcp` with the `@` version from `typescript.md`, since its latest releases support both `5.x` and `6.x`",
            "(for example an exact `\"4.2.0\"` or `\"=4.2.0\"` pin): keep the pin untouched and emit `[ABORT] posthog package pinned below required floor`, telling the user MCP analytics needs `posthog-node` `5.x` or later",
            "(such as `\"^4.0.0\"` or `\"~4.1.0\"`): never silently upgrade across majors; ask the user before moving to `posthog-node@^5` (or `^6` per `typescript.md`), or emit `[ABORT] posthog package pinned below required floor` if they cannot upgrade",
            "Translate the install command to the project's manager (with pnpm, `pnpm add -E` followed by the same package specs) and add `-E` / `--save-exact`, which pins `@posthog/mcp` to the current release of that major",
            "The `@` version also raises an already-declared older version, which a bare name leaves in place.",
            "Read the installed version back from `package.json` / the lockfile rather than guessing: it must be `@posthog/mcp>=0.18.0`, the first release with model capture and conversation IDs on by default on both paths, including `prepareToolResult` for custom dispatchers. Upgrade an older installed version.",
        ],
        "Python": [
            "The SDK ships inside `posthog`, so first look for an existing `posthog` declaration (`requirements*.txt`, `pyproject.toml`, `setup.py`):",
            "**Already declared on major 8:** keep the `8.x` declaration (staying within `<9`) and install/update so the resolved package satisfies `posthog>=7.62.0`.",
            "If it already requires `7.62.0` or later within major 7 (e.g. `>=7.69,<8` or exact `==` pin at/above that floor), keep it as declared (staying within `<8` rather than jumping across majors).",
            "If it uses a range below `7.62.0` (`posthog>=7.40,<8`, `posthog~=7.0`, or unpinned floor within major 7), raise that declaration to `posthog>=7.62.0` by editing the file and keep `<8` as the upper bound (never upgrade across majors to `8.x`).",
            "If it hard-pins an exact version below that floor (for example `==` at an earlier patch release), keep the pin untouched and emit `[ABORT] posthog package pinned below required floor`, telling the user that MCP analytics needs `posthog>=7.62.0`.",
            "If hard-pinned with `==` below `7.62.0`, keep the pin untouched and emit `[ABORT] posthog package pinned below required floor`, telling the user that MCP analytics needs `posthog>=7.62.0`.",
            "If it is unversioned (`posthog`) or uses a non-pinned range below `7`, write `python.md`'s range (`posthog>=8,<9`) when safe (or ask before crossing majors if `<7` was intentionally capped) and install (`pip install -r requirements.txt`, `uv sync`, or `poetry install`).",
            "write `python.md`'s range (`posthog>=8,<9`) into the project's manifest (`requirements.txt`, `pyproject.toml`) and install (`pip install -r requirements.txt`, `uv sync`, or `poetry install`).",
            "Read the resolved version back from the lockfile or environment: it must be `posthog>=7.62.0`.",
            "Never put a version constraint in a shell command; the wizard reads `>` as a redirect and refuses it.",
            "It's the first release with model capture and conversation IDs on by default on both paths, including `prepare_tool_result` for custom dispatchers.",
            "The MCP SDK is a peer dependency tested across `mcp>=1.26,<3`; don't add or change it as part of this command. jlowin's standalone `fastmcp` package is also supported.",
            "A custom-dispatcher (path P2) project needs nothing beyond `posthog`.",
        ],
        "Go": [
            "Stay on the project's existing PostHog Go module major when already present (`v1` `github.com/posthog/posthog-go` vs `v2` `github.com/posthog/posthog-go/v2`), and use `/v2` on greenfield installs.",
            "in the module that contains the server, then read the version back from `go.mod`: `posthogmcpsdk` must be `v1.34.0` or later, the first release with `WithIntentFallback`.",
            "It pulls in the matching `posthog-go` major and raises the `go-sdk` requirement to the supported minimum if needed.",
            "The package needs Go 1.25 or later; if the installed toolchain is older and `go get` can't switch to a newer one, emit `[ABORT] go toolchain older than 1.25`.",
            "Never add or change anything else in `go.mod` by hand.",
            "In the report, say whether `go get` raised the `go` directive (to `1.25.0`) or bumped go-sdk, and tell the user to check the Go version in their Dockerfiles and CI.",
            "Serving the `2026-07-28` revision needs go-sdk `v1.8.0` or later; if the project's go-sdk is older, leave it and say so in the report.",
        ],
        "Rust": [
            "Check whether `Cargo.toml` already declares `posthog` (`1.x`), `posthog-rs = \"1\"` (the `1.x` forwarding crate), or `posthog-rs` (`0.x`), and stay on the declared major:",
            "run `cargo add` for `posthog` `1.x` per `rust.md` with `--features mcp`.",
            "stay on `1.x` and ensure `--features mcp` is enabled (`cargo add posthog@1 --features mcp`, or `posthog-rs@1 --features mcp` if `Cargo.toml` already declares `posthog-rs` `1.x`). If an exact `=` pin sits below `1.0`, keep the pin untouched and emit `[ABORT] posthog package pinned below required floor`. Read the version back from `Cargo.lock`: it must be `1.0` or later.",
            "keep `posthog-rs` within `0.x` and add `--features mcp`. If `Cargo.toml` hard-pins `posthog-rs` with an exact `=` requirement below the `0.29.0` floor (for example `\"=0.28.0\"`), keep the pin untouched and emit `[ABORT] posthog package pinned below required floor`, telling the user MCP analytics needs `posthog-rs` `0.29.0` or later.",
            "Otherwise read the version back from `Cargo.lock`: `posthog-rs` must be `0.29.0` or later (`posthog` crate on `1.x` already includes MCP behind `--features mcp`).",
            "The `mcp` feature turns on the async client and pulls in `rmcp` with its `server` feature. `mcp` integration needs `rmcp` 3.7 or later.",
            "If the project's `Cargo.toml` allows it (for example `\"3.6\"`), `cargo add` moves the lock forward on its own; say in the report that `cargo add` raised `rmcp`, from the version you recorded in STEP 1.",
            "If the project pins an older one exactly (`\"=3.6.0\"`) so `cargo add` fails, emit `[ABORT] rmcp older than 3.7`. Never edit the `rmcp` requirement yourself.",
            "It also needs Rust 1.88 or later; if the pinned toolchain is older, or `cargo build` fails because the compiler is too old, emit `[ABORT] rust toolchain older than 1.88`. The server already runs on `tokio`; never change its features or the `rmcp` transport features.",
        ],
    };

    it.each(Object.entries(STEP3_CLAUSES).flatMap(([language, clauses]) => clauses.map((clause) => [language, clause])))(
        'STEP 3 %s keeps: %s',
        (language, clause) => {
            const header = `#### ${language}`;
            const start = steps[2].indexOf(header);
            const next = steps[2].indexOf('\n#### ', start + header.length);
            const branch = next === -1 ? steps[2].slice(start) : steps[2].slice(start, next);
            expect(branch).toContain(clause);
        },
    );

    // The version branches are lists whose order and nesting carry meaning (which rule sits under which major),
    // so pin each line's leading text and indentation, in order.
    const STEP3_BULLET_HEADS = {
        "TypeScript / JavaScript": [
            "Look for an existing `posthog-node` declaration in `package.",
            "- **No existing `posthog-node` declaration (greenfield):** i",
            "- **Already declared on `5.x` or `6.x`:** **stay on that exi",
            "- **Hard-pinned below `5.0.0`** (for example an exact `\"4.2.",
            "- **Range below `5.0.0`** (such as `\"^4.0.0\"` or `\"~4.1.0\"`)",
        ],
        "Python": [
            "The SDK ships inside `posthog`, so first look for an existin",
            "- **Already declared on major 8:** keep the `8.x` declaratio",
            "- **Already declared on major 7:**",
            "  - If it already requires `7.62.0` or later within major 7 ",
            "  - If it uses a range below `7.62.0` (`posthog>=7.40,<8`, `",
            "  - If it hard-pins an exact version below that floor (for e",
            "- **Already declared unversioned or on an earlier major (`<7",
            "  - If hard-pinned with `==` below `7.62.0`, keep the pin un",
            "  - If it is unversioned (`posthog`) or uses a non-pinned ra",
            "- **No existing `posthog` declaration (greenfield):** write ",
        ],
        "Rust": [
            "Check whether `Cargo.toml` already declares `posthog` (`1.x`",
            "- **Neither `posthog` nor `posthog-rs` is declared (greenfie",
            "- **`posthog` (`1.x`) or `posthog-rs = \"1\"` is already decla",
            "- **`posthog-rs` (`0.x`) is already declared:** keep `postho",
        ],
    };

    it.each(Object.entries(STEP3_BULLET_HEADS))('STEP 3 %s keeps its bullets in order with their nesting', (language, expected) => {
        const header = `#### ${language}`;
        const start = steps[2].indexOf(header);
        const next = steps[2].indexOf('\n#### ', start + header.length);
        const branch = next === -1 ? steps[2].slice(start) : steps[2].slice(start, next);
        const heads = branch
            .split('\n')
            .filter((line) => /^\s*- /.test(line) || (line.trim().endsWith(':') && !line.startsWith('#')))
            .map((line) => line.slice(0, 60));
        expect(heads).toEqual(expected);
    });

    // Text this change added outside the STEP 3 branches. Abort lines are exact (the wizard matches the reason string).
    const ADDED_CLAUSES = [
        ['overview', '- **Rust** — `posthog::mcp` (or `posthog_rs::mcp` on the `posthog-rs` crate, `0.x` or `1.x` forwarding), which ships inside the [`posthog`](https://posthog.com/docs/libraries/rust) crate (`posthog-rs` for `0.x` or `1.x` forwarding) behind its `mcp` feature, for servers built on `rmcp`'],
        ['guardrail', '`posthog::mcp` / `posthog_rs::mcp` may change its API, options, and `$mcp_*` events in any `posthog` / `posthog-rs` release.'],
        ['STEP 1 detection', 'Look for existing `posthog-node` major declarations too (`major 5` vs `major 6`, never cross majors on an existing install).'],
        ['STEP 1 already wired in', '`posthog::mcp::instrument(`, `posthog_rs::mcp::instrument(`, or `McpAnalytics` in Rust), don\'t duplicate it.'],
        ['STEP 2 Rust path', 'wrap it with `posthog::mcp::instrument(server, posthog.clone())` (or `posthog_rs::mcp::instrument(...)` when keeping the `posthog-rs` crate, whether `0.x` or `1.x` forwarding) and serve the wrapped server in place of yours.'],
        ['STEP 4 Rust crate choice', 'When staying on the `posthog-rs` crate (`0.x` or `1.x` forwarding) from STEP 3, use `posthog_rs::client(...)` and `posthog_rs::mcp::instrument(...)` (or `posthog_rs::mcp::{McpOptionsBuilder, McpAnalytics}`). Only use `posthog::client(...)` and `posthog::mcp::...` when `Cargo.toml` depends on the `posthog` crate.'],
        ['STEP 5 Rust host', 'the host goes in the `posthog::client` (or `posthog_rs::client` when keeping the `posthog-rs` crate) call as in STEP 4.'],
        ['key principles', 'Construct the `PostHog` / `Posthog` / `PostHogMCP` / `PostHog::Client` / `posthog` (`posthog_rs`) client once, not per request.'],
    ];

    it.each(ADDED_CLAUSES)('keeps the added %s text', (_where, clause) => {
        expect(text).toContain(clause);
    });

    it.each([
        '- `[ABORT] rmcp older than 3.7` — `posthog::mcp` / `posthog_rs::mcp` needs `rmcp` 3.7 or later (STEP 3).',
        "- `[ABORT] rust toolchain older than 1.88` — `posthog` / `posthog-rs` with the `mcp` feature can't build (STEP 3).",
        '- `[ABORT] posthog package pinned below required floor` — an existing `posthog` / SDK dependency is hard-pinned below the minimum version needed for MCP analytics (STEP 3).',
    ])('lists the abort case exactly: %s', (line) => {
        expect(abortSection.split('\n')).toContain(line);
    });

    it('keeps the Go and Rust STEP 4 snippets on the right crate and major', () => {
        const branchOf = (lang) => {
            const header = `#### ${lang}`;
            const start = steps[3].indexOf(header);
            const next = steps[3].indexOf('\n#### ', start + header.length);
            return next === -1 ? steps[3].slice(start) : steps[3].slice(start, next);
        };
        const go = branchOf('Go');
        expect(go).toMatch(/^\t"github\.com\/posthog\/posthog-go\/posthogmcpsdk\/v2"\s+\/\/ omit \/v2 when staying on v1$/m);
        expect(go).toMatch(/^\tposthog "github\.com\/posthog\/posthog-go\/v2"\s+\/\/ omit \/v2 when staying on v1$/m);
        expect(go).toMatch(/^\t"github\.com\/posthog\/posthog-go\/v2\/posthogmcp"\s+\/\/ omit \/v2 when staying on v1$/m);
        const rust = branchOf('Rust');
        const fenced = [...rust.matchAll(/```rust\n([\s\S]*?)```/g)].map(([, code]) => code).join('\n');
        expect(fenced).toContain('    posthog::client((token.as_str(), "https://us.i.posthog.com")).await, // or https://eu.i.posthog.com');
        expect(fenced).toContain('let server = posthog::mcp::instrument(MyServer, posthog.clone());');
        expect(fenced).not.toContain('posthog_rs::');
    });
});
