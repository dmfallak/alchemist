# Filesystem-as-Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop SQLite entirely; make markdown files + JSONL the sole source of truth for Alchemist lab state, and tighten the CLI surface so a future Being can drive it with tool-use.

**Architecture:** Every record type (experiments, tasks, insights, reasoning nodes) lives as a YAML-frontmatter markdown file on disk. Experiments are directories (`experiments/EXP-001-slug/protocol.md`) with append-only `measurements.jsonl` alongside. Everything else is a flat `TSK-001.md` / `INS-001.md` / `LOG-001.md`. The CLI reads and writes these files directly: no DB, no migrations, no schema drift, no sync step. Every command supports a global `--json` flag so automated callers (human scripts today, a tool-use Being tomorrow) get a stable structured surface.

**Tech Stack:** TypeScript, Commander.js, `yaml` package, Vitest. No SQLite, no `sqlite3` package. Filesystem reads via `fs`, full-text search via shell-invoked `grep -r` (no ripgrep dependency needed — `grep` is universal on Linux/macOS).

---

## Scope

This plan covers one subsystem end-to-end: the Alchemist storage and CLI layer. It produces working software at every green-bar checkpoint — after each task the project builds, tests pass, and the subset of CLI commands already rewritten works against filesystem state.

Out of scope:
- Giving the Being tool-use (separate future plan; this CLI is the prep work)
- Redesigning `AGENTS.md` / `GEMINI.md` philosophy (we only update them to reflect the new command surface)
- Any Being-side changes (the Being project is untouched)

---

## File Structure

**New files:**
- `src/lib/frontmatter.ts` — parse/stringify YAML frontmatter + markdown body
- `src/lib/ids.ts` — next-ID generator that scans filesystem
- `src/lib/experiments.ts` — replaces `protocols.ts`; CRUD + measurements
- `src/lib/insights.ts` — new; CRUD for insights
- `src/lib/reasoning.ts` — replaces `strategy.ts`; CRUD for reasoning nodes + Mermaid
- `src/lib/search.ts` — new; `grep -r` across all .md files
- `scripts/migrate-db-to-fs.ts` — one-shot DB→filesystem migration
- `reasoning/LOG-001.md` — written by migration

**Rewritten files:**
- `src/lib/tasks.ts` — filesystem only, no DB
- `src/lib/journal.ts` — reads filesystem, not DB
- `src/cli/index.ts` — new command surface (list, show, measure, note, conclude, insight, hypothesize, search) + global `--json`
- `tests/lib/strategy.test.ts` → `tests/lib/reasoning.test.ts` (rewritten)
- `tests/lib/protocols.test.ts` → `tests/lib/experiments.test.ts` (rewritten)
- `tests/lib/tasks.test.ts` (rewritten without DB)
- `tests/cli/plan.test.ts` → `tests/cli/experiments-cli.test.ts` (rewritten)
- `tests/cli/consult.test.ts` → folded into `tests/cli/experiments-cli.test.ts`
- `AGENTS.md`, `GEMINI.md` — document new CLI surface

**Deleted files:**
- `src/db/` — entire directory
- `src/lib/bridge.ts` — bridge.json becomes redundant (CLI is the interface)
- `src/lib/consultant.ts` — `generateBriefing` folds into `show <expId>` command
- `src/lib/protocols.ts` — renamed and rewritten as `experiments.ts`
- `src/lib/strategy.ts` — renamed and rewritten as `reasoning.ts`
- `tests/db/init.test.ts` — no more DB
- `tests/lib/bridge.test.ts` — no more bridge
- `data/alchemist.db` — delete after verifying migration (Task 12)
- `data/bridge.json` — delete after CLI rewrite (Task 10)

**Modified config:**
- `.gitignore` — remove `experiments/`, keep `*.db`, add `scripts/*.ts` is NOT needed
- `package.json` — remove `sqlite3` and `@types/sqlite3` dependencies

---

## Conventions

**Testing:** All tests use real filesystem with a per-test temp directory under `os.tmpdir()`. No `vi.mock('fs')` — mocking `fs` is more fragile than using a temp dir and lets real file behavior (frontmatter parsing edge cases, etc.) surface in tests. No in-memory SQLite (there is no SQLite). `beforeEach` creates a fresh temp dir, `afterEach` removes it.

**Commits:** One commit per task. Commit messages use conventional commits (`feat:`, `refactor:`, `chore:`, `docs:`) to match existing repo style.

**IDs:** `EXP-`, `TSK-`, `INS-`, `LOG-` prefixes followed by 3-digit zero-padded numbers. Generator scans the relevant directory, parses existing IDs, returns `prefix-{max+1}`.

**Frontmatter:** YAML, delimited by `---\n...\n---\n`. Body follows on the next line.

---

## Task 1: Repo Hygiene — Gitignore and Failing-Test Baseline

**Goal:** Unignore `experiments/` so the lab notebook is versioned. Fix the broken `strategy.test.ts` assertions so baseline is 19/19 green before the rewrite begins. (We are going to rewrite `strategy.ts` as `reasoning.ts` later, so this fix is temporary — but it keeps CI green during the rewrite.)

**Files:**
- Modify: `.gitignore`
- Modify: `tests/lib/strategy.test.ts`

- [ ] **Step 1: Verify current .gitignore contents**

Run: `cat .gitignore`
Expected output:
```
node_modules/
dist/
*.db
.worktrees/
experiments/
```

- [ ] **Step 2: Remove `experiments/` line from .gitignore**

Edit `.gitignore` — remove the `experiments/` line. Final content:
```
node_modules/
dist/
*.db
.worktrees/
```

- [ ] **Step 3: Copy existing experiments into the worktree**

The main checkout has `experiments/EXP-001-pilot-wave-silicon-droplet/` but the worktree does not (because it was gitignored at branch-creation time). Bring it in so we can version it.

Run from worktree root:
```bash
cp -R ../../experiments ./
```

Verify: `ls experiments/EXP-001-pilot-wave-silicon-droplet/` shows `protocol.md`.

- [ ] **Step 4: Fix the strategy test to match actual Mermaid output**

The current test asserts `LOG-001 --> LOG-002;` as a direct edge, but the code (correctly) generates an intermediate outcome node `LOG-001_A` that labels the branch outcome. The test expectations are wrong; the code is right. Update the test.

Replace the `should generate a strategy map in Mermaid format` test body in `tests/lib/strategy.test.ts`:

```typescript
it('should generate a strategy map in Mermaid format', async () => {
    await createReasoningNode('LOG-001', 'Root Hypothesis', undefined, 'Branch A leads to LOG-002', 'Branch B leads to LOG-003');
    await createReasoningNode('LOG-002', 'Branch A Follow-up', 'LOG-001');
    await createReasoningNode('LOG-003', 'Branch B Follow-up', 'LOG-001');

    const map = await generateStrategyMap();
    expect(map).toContain('graph TD;');
    expect(map).toContain('LOG-001["Root Hypothesis"];');
    expect(map).toContain('LOG-001_A["Branch A leads to LOG-002"];');
    expect(map).toContain('LOG-001 --> LOG-001_A;');
    expect(map).toContain('LOG-001_A --> LOG-002;');
    expect(map).toContain('LOG-001_B["Branch B leads to LOG-003"];');
    expect(map).toContain('LOG-001 --> LOG-001_B;');
    expect(map).toContain('LOG-001_B --> LOG-003;');
});
```

- [ ] **Step 5: Run tests — expect 19/19 green**

Run: `npm test`
Expected: `Test Files  7 passed (7)`, `Tests  19 passed (19)`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore experiments/ tests/lib/strategy.test.ts
git commit -m "chore: version experiments/, fix strategy test assertions"
```

---

## Task 2: Shared Frontmatter Utility

**Goal:** One library function for parsing/writing YAML-frontmatter markdown files. Every other module will use this instead of regex-matching inline.

**Files:**
- Create: `src/lib/frontmatter.ts`
- Create: `tests/lib/frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/frontmatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../../src/lib/frontmatter';

describe('frontmatter', () => {
    it('parses a frontmatter block and body', () => {
        const input = `---\nid: EXP-001\ntitle: Test\n---\n# Body\n\nHello.\n`;
        const result = parseFrontmatter(input);
        expect(result.metadata).toEqual({ id: 'EXP-001', title: 'Test' });
        expect(result.body).toBe('# Body\n\nHello.\n');
    });

    it('returns empty metadata and full input when no frontmatter', () => {
        const input = `# Body\n\nHello.\n`;
        const result = parseFrontmatter(input);
        expect(result.metadata).toEqual({});
        expect(result.body).toBe(input);
    });

    it('stringifies metadata and body together', () => {
        const output = stringifyFrontmatter({ id: 'EXP-001', title: 'Test' }, '# Body\n');
        expect(output).toBe(`---\nid: EXP-001\ntitle: Test\n---\n# Body\n`);
    });

    it('round-trips: parse then stringify preserves content', () => {
        const original = `---\nid: EXP-001\nstatus: active\n---\n# Body\n\nHello.\n`;
        const { metadata, body } = parseFrontmatter(original);
        const rebuilt = stringifyFrontmatter(metadata, body);
        expect(rebuilt).toBe(original);
    });

    it('handles nested/array values in YAML', () => {
        const input = `---\nid: INS-001\ntags:\n  - theory\n  - quantum\n---\nBody\n`;
        const { metadata } = parseFrontmatter(input);
        expect(metadata.tags).toEqual(['theory', 'quantum']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/frontmatter.test.ts`
Expected: FAIL — module `../../src/lib/frontmatter` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/frontmatter.ts`:

```typescript
import { parse, stringify } from 'yaml';

export interface ParsedFile {
    metadata: Record<string, any>;
    body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseFrontmatter(content: string): ParsedFile {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        return { metadata: {}, body: content };
    }
    try {
        const metadata = parse(match[1]) || {};
        return { metadata, body: match[2] };
    } catch {
        return { metadata: {}, body: match[2] };
    }
}

export function stringifyFrontmatter(metadata: Record<string, any>, body: string): string {
    const yaml = stringify(metadata);
    return `---\n${yaml}---\n${body}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/frontmatter.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/frontmatter.ts tests/lib/frontmatter.test.ts
git commit -m "feat: add shared frontmatter parser/stringifier"
```

---

## Task 3: Shared ID Generator

**Goal:** One function that, given a directory and a prefix like `EXP-`, returns the next zero-padded 3-digit ID. Reads filesystem, no DB.

**Files:**
- Create: `src/lib/ids.ts`
- Create: `tests/lib/ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/ids.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { nextId } from '../../src/lib/ids';

describe('nextId', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-ids-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns prefix-001 for an empty directory', () => {
        expect(nextId(tmpDir, 'EXP-')).toBe('EXP-001');
    });

    it('returns prefix-001 if the directory does not exist', () => {
        const missing = path.join(tmpDir, 'does-not-exist');
        expect(nextId(missing, 'TSK-')).toBe('TSK-001');
    });

    it('finds the max existing numeric suffix and increments', () => {
        fs.writeFileSync(path.join(tmpDir, 'TSK-001.md'), '');
        fs.writeFileSync(path.join(tmpDir, 'TSK-003.md'), '');
        fs.writeFileSync(path.join(tmpDir, 'TSK-002.md'), '');
        expect(nextId(tmpDir, 'TSK-')).toBe('TSK-004');
    });

    it('ignores files with unrelated prefixes', () => {
        fs.writeFileSync(path.join(tmpDir, 'INS-007.md'), '');
        expect(nextId(tmpDir, 'EXP-')).toBe('EXP-001');
    });

    it('works with directory entries for EXP- (e.g. EXP-001-slug/)', () => {
        fs.mkdirSync(path.join(tmpDir, 'EXP-001-pilot-wave'));
        fs.mkdirSync(path.join(tmpDir, 'EXP-002-another'));
        expect(nextId(tmpDir, 'EXP-')).toBe('EXP-003');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/ids.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ids.ts`:

```typescript
import * as fs from 'fs';

export function nextId(dir: string, prefix: string): string {
    if (!fs.existsSync(dir)) {
        return `${prefix}001`;
    }
    const entries = fs.readdirSync(dir);
    const re = new RegExp(`^${prefix}(\\d+)`);
    let max = 0;
    for (const entry of entries) {
        const match = entry.match(re);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
        }
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/ids.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ids.ts tests/lib/ids.test.ts
git commit -m "feat: add filesystem-scanning next-id generator"
```

---

## Task 4: Rewrite experiments.ts (filesystem only)

**Goal:** Replace `protocols.ts` with an experiments module that uses filesystem only, exposes measurements append, and knows how to conclude an experiment.

**Files:**
- Create: `src/lib/experiments.ts`
- Create: `tests/lib/experiments.test.ts`
- Delete (after tests pass): `src/lib/protocols.ts`, `tests/lib/protocols.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/experiments.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    createExperiment,
    listExperiments,
    getExperiment,
    appendMeasurement,
    readMeasurements,
    appendObservation,
    concludeExperiment,
    setExperimentsDir,
    slugify,
} from '../../src/lib/experiments';

describe('experiments', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-exp-'));
        setExperimentsDir(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates an experiment with protocol.md and parseable frontmatter', async () => {
        const exp = await createExperiment('Test Experiment', 'My Hypothesis');
        expect(exp.id).toBe('EXP-001');
        expect(exp.title).toBe('Test Experiment');
        expect(exp.hypothesis).toBe('My Hypothesis');
        expect(exp.status).toBe('active');

        const dir = path.join(tmpDir, `EXP-001-${slugify('Test Experiment')}`);
        expect(fs.existsSync(path.join(dir, 'protocol.md'))).toBe(true);
        const content = fs.readFileSync(path.join(dir, 'protocol.md'), 'utf-8');
        expect(content).toContain('id: EXP-001');
        expect(content).toContain('title: Test Experiment');
    });

    it('increments IDs based on filesystem state', async () => {
        await createExperiment('First', 'H1');
        const second = await createExperiment('Second', 'H2');
        expect(second.id).toBe('EXP-002');
    });

    it('lists experiments ordered by ID ascending', async () => {
        await createExperiment('One', 'H1');
        await createExperiment('Two', 'H2');
        const all = await listExperiments();
        expect(all.map(e => e.id)).toEqual(['EXP-001', 'EXP-002']);
    });

    it('getExperiment returns metadata + body or null', async () => {
        await createExperiment('Test', 'H');
        const exp = await getExperiment('EXP-001');
        expect(exp).not.toBeNull();
        expect(exp!.metadata.id).toBe('EXP-001');
        expect(exp!.body).toContain('# Protocol: Test');
        expect(await getExperiment('EXP-999')).toBeNull();
    });

    it('appendMeasurement writes one JSON line per call', async () => {
        await createExperiment('M', 'H');
        await appendMeasurement('EXP-001', 'temperature', 22.5, 'C');
        await appendMeasurement('EXP-001', 'amplitude', 4.8);
        const ms = await readMeasurements('EXP-001');
        expect(ms).toHaveLength(2);
        expect(ms[0].key).toBe('temperature');
        expect(ms[0].value).toBe(22.5);
        expect(ms[0].unit).toBe('C');
        expect(ms[0].timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
        expect(ms[1].unit).toBeUndefined();
    });

    it('readMeasurements returns [] when file is absent', async () => {
        await createExperiment('M', 'H');
        expect(await readMeasurements('EXP-001')).toEqual([]);
    });

    it('appendObservation adds a bullet under "## Observations"', async () => {
        await createExperiment('Obs', 'H');
        await appendObservation('EXP-001', 'Droplet walked stably for 30s.');
        const exp = await getExperiment('EXP-001');
        expect(exp!.body).toContain('## Observations');
        expect(exp!.body).toContain('- Droplet walked stably for 30s.');
    });

    it('concludeExperiment sets status=concluded and appends outcome', async () => {
        await createExperiment('Done', 'H');
        await concludeExperiment('EXP-001', 'Hypothesis refuted: no interference observed.');
        const exp = await getExperiment('EXP-001');
        expect(exp!.metadata.status).toBe('concluded');
        expect(exp!.body).toContain('## Outcome');
        expect(exp!.body).toContain('Hypothesis refuted: no interference observed.');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/experiments.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/experiments.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';

export interface Experiment {
    id: string;
    title: string;
    hypothesis: string;
    status: string;
}

export interface Measurement {
    timestamp: string;
    key: string;
    value: number;
    unit?: string;
}

export interface ExperimentFile {
    metadata: Record<string, any>;
    body: string;
    dir: string;
}

let experimentsBaseDir = path.resolve(process.cwd(), 'experiments');

export function setExperimentsDir(dir: string) {
    experimentsBaseDir = dir;
}

export function getExperimentsDir(): string {
    return experimentsBaseDir;
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function findExperimentDir(id: string): string | null {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) return null;
    const match = fs.readdirSync(base).find(d => d.startsWith(`${id}-`) || d === id);
    return match ? path.join(base, match) : null;
}

export async function createExperiment(title: string, hypothesis: string): Promise<Experiment> {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

    const id = nextId(base, 'EXP-');
    const slug = slugify(title);
    const dir = path.join(base, `${id}-${slug}`);
    fs.mkdirSync(dir, { recursive: true });

    const metadata = {
        id,
        title,
        hypothesis,
        status: 'active',
        inputs: [],
        observations: [],
        safety: [],
    };
    const body = `# Protocol: ${title}\n\n...\n`;
    fs.writeFileSync(path.join(dir, 'protocol.md'), stringifyFrontmatter(metadata, body));

    return { id, title, hypothesis, status: 'active' };
}

export async function listExperiments(): Promise<Experiment[]> {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) return [];
    const dirs = fs.readdirSync(base).filter(d => /^EXP-\d+/.test(d)).sort();
    const results: Experiment[] = [];
    for (const d of dirs) {
        const file = path.join(base, d, 'protocol.md');
        if (!fs.existsSync(file)) continue;
        const { metadata } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
        results.push({
            id: metadata.id,
            title: metadata.title,
            hypothesis: metadata.hypothesis ?? '',
            status: metadata.status ?? 'active',
        });
    }
    return results;
}

export async function getExperiment(id: string): Promise<ExperimentFile | null> {
    const dir = findExperimentDir(id);
    if (!dir) return null;
    const file = path.join(dir, 'protocol.md');
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, dir };
}

export async function appendMeasurement(
    id: string,
    key: string,
    value: number,
    unit?: string,
): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const line: Measurement = { timestamp: new Date().toISOString(), key, value };
    if (unit !== undefined) line.unit = unit;
    fs.appendFileSync(path.join(dir, 'measurements.jsonl'), JSON.stringify(line) + '\n');
}

export async function readMeasurements(id: string): Promise<Measurement[]> {
    const dir = findExperimentDir(id);
    if (!dir) return [];
    const file = path.join(dir, 'measurements.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
}

export async function appendObservation(id: string, text: string): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const file = path.join(dir, 'protocol.md');
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    let newBody: string;
    if (body.includes('## Observations')) {
        newBody = body.replace(/## Observations\n/, `## Observations\n- ${text}\n`);
    } else {
        newBody = body.trimEnd() + `\n\n## Observations\n- ${text}\n`;
    }
    fs.writeFileSync(file, stringifyFrontmatter(metadata, newBody));
}

export async function concludeExperiment(id: string, outcome: string): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const file = path.join(dir, 'protocol.md');
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    metadata.status = 'concluded';
    const newBody = body.trimEnd() + `\n\n## Outcome\n${outcome}\n`;
    fs.writeFileSync(file, stringifyFrontmatter(metadata, newBody));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/experiments.test.ts`
Expected: PASS — 8/8.

- [ ] **Step 5: Delete old protocols.ts and its test**

```bash
rm src/lib/protocols.ts tests/lib/protocols.test.ts
```

At this point the codebase will NOT compile because `consultant.ts`, `journal.ts`, `bridge.ts`, and the CLI still import from `protocols`. That's expected — those modules all get rewritten in later tasks. Don't run `npm test` here; run `npx vitest run tests/lib/experiments.test.ts` to confirm our test still passes in isolation.

Expected: PASS — 8/8.

- [ ] **Step 6: Commit**

```bash
git add src/lib/experiments.ts tests/lib/experiments.test.ts
git rm src/lib/protocols.ts tests/lib/protocols.test.ts
git commit -m "feat: filesystem-only experiments module with measurements"
```

---

## Task 5: Rewrite tasks.ts (filesystem only)

**Goal:** Replace the DB-backed task module with a filesystem-only one.

**Files:**
- Modify: `src/lib/tasks.ts`
- Modify: `tests/lib/tasks.test.ts`

- [ ] **Step 1: Rewrite the test**

Overwrite `tests/lib/tasks.test.ts` with:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTask, listTasks, getTask, completeTask, setTasksDir } from '../../src/lib/tasks';

describe('tasks', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-tasks-'));
        setTasksDir(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a task with markdown file and frontmatter', async () => {
        const task = await createTask('Buy a laser', 'high', 'EXP-001');
        expect(task.id).toBe('TSK-001');
        expect(task.title).toBe('Buy a laser');
        expect(task.priority).toBe('high');
        expect(task.linked_exp).toBe('EXP-001');
        const filePath = path.join(tmpDir, 'TSK-001.md');
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('id: TSK-001');
        expect(content).toContain('priority: high');
        expect(content).toContain('linked_exp: EXP-001');
    });

    it('increments task IDs from filesystem', async () => {
        await createTask('First', 'low');
        const second = await createTask('Second', 'low');
        expect(second.id).toBe('TSK-002');
    });

    it('listTasks defaults to non-done tasks', async () => {
        await createTask('Active', 'low');
        const done = await createTask('Done', 'low');
        await completeTask(done.id);
        const pending = await listTasks();
        expect(pending.map(t => t.id)).toEqual(['TSK-001']);
    });

    it('listTasks({ all: true }) returns every task', async () => {
        await createTask('A', 'low');
        const b = await createTask('B', 'low');
        await completeTask(b.id);
        const all = await listTasks({ all: true });
        expect(all).toHaveLength(2);
    });

    it('getTask returns the full record or null', async () => {
        await createTask('Findable', 'low');
        const t = await getTask('TSK-001');
        expect(t).not.toBeNull();
        expect(t!.metadata.title).toBe('Findable');
        expect(await getTask('TSK-999')).toBeNull();
    });

    it('completeTask flips status in the file', async () => {
        await createTask('To complete', 'low');
        await completeTask('TSK-001');
        const t = await getTask('TSK-001');
        expect(t!.metadata.status).toBe('done');
    });

    it('completeTask throws when the task is missing', async () => {
        await expect(completeTask('TSK-404')).rejects.toThrow('Task TSK-404 not found');
    });
});
```

- [ ] **Step 2: Run test to verify failures**

Run: `npx vitest run tests/lib/tasks.test.ts`
Expected: FAIL — either missing exports or old DB-based behavior.

- [ ] **Step 3: Rewrite the implementation**

Overwrite `src/lib/tasks.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';

export interface Task {
    id: string;
    title: string;
    priority: string;
    status: string;
    linked_exp?: string;
}

export interface TaskFile {
    metadata: Record<string, any>;
    body: string;
    path: string;
}

let tasksBaseDir = path.resolve(process.cwd(), 'tasks');

export function setTasksDir(dir: string) {
    tasksBaseDir = dir;
}

export function getTasksDir(): string {
    return tasksBaseDir;
}

function taskPath(id: string): string {
    return path.join(getTasksDir(), `${id}.md`);
}

export async function createTask(
    title: string,
    priority: string,
    linked_exp?: string,
): Promise<Task> {
    const base = getTasksDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const id = nextId(base, 'TSK-');
    const metadata: Record<string, any> = {
        id,
        title,
        priority,
        status: 'backlog',
    };
    if (linked_exp) metadata.linked_exp = linked_exp;
    const body = `# Task: ${title}\n\n...\n`;
    fs.writeFileSync(taskPath(id), stringifyFrontmatter(metadata, body));
    return { id, title, priority, status: 'backlog', linked_exp };
}

export interface ListOptions {
    all?: boolean;
}

export async function listTasks(options: ListOptions = {}): Promise<Task[]> {
    const base = getTasksDir();
    if (!fs.existsSync(base)) return [];
    const files = fs.readdirSync(base).filter(f => /^TSK-\d+\.md$/.test(f)).sort();
    const tasks: Task[] = [];
    for (const f of files) {
        const { metadata } = parseFrontmatter(fs.readFileSync(path.join(base, f), 'utf-8'));
        if (!options.all && metadata.status === 'done') continue;
        tasks.push({
            id: metadata.id,
            title: metadata.title,
            priority: metadata.priority,
            status: metadata.status,
            linked_exp: metadata.linked_exp,
        });
    }
    return tasks;
}

export async function getTask(id: string): Promise<TaskFile | null> {
    const file = taskPath(id);
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, path: file };
}

export async function completeTask(id: string): Promise<void> {
    const file = taskPath(id);
    if (!fs.existsSync(file)) throw new Error(`Task ${id} not found`);
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    metadata.status = 'done';
    fs.writeFileSync(file, stringifyFrontmatter(metadata, body));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/tasks.test.ts`
Expected: PASS — 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks.ts tests/lib/tasks.test.ts
git commit -m "refactor(tasks): filesystem-only storage, remove DB dependency"
```

---

## Task 6: New insights.ts

**Goal:** Add first-class insights support. Currently insights are just markdown files that the CLI lists by filename — give them a proper module.

**Files:**
- Create: `src/lib/insights.ts`
- Create: `tests/lib/insights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/insights.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    createInsight,
    listInsights,
    getInsight,
    setInsightsDir,
} from '../../src/lib/insights';

describe('insights', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-ins-'));
        setInsightsDir(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates an insight with frontmatter and placeholder body', async () => {
        const ins = await createInsight('A new idea', ['theory']);
        expect(ins.id).toBe('INS-001');
        expect(ins.title).toBe('A new idea');
        expect(ins.tags).toEqual(['theory']);
        const file = path.join(tmpDir, 'INS-001.md');
        expect(fs.existsSync(file)).toBe(true);
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).toContain('id: INS-001');
        expect(content).toContain('title: A new idea');
        expect(content).toContain('# Insight: A new idea');
    });

    it('increments IDs', async () => {
        await createInsight('One');
        const two = await createInsight('Two');
        expect(two.id).toBe('INS-002');
    });

    it('listInsights returns every insight, sorted by ID', async () => {
        await createInsight('A');
        await createInsight('B');
        const all = await listInsights();
        expect(all.map(i => i.id)).toEqual(['INS-001', 'INS-002']);
    });

    it('getInsight returns record or null', async () => {
        await createInsight('Findable');
        const ins = await getInsight('INS-001');
        expect(ins).not.toBeNull();
        expect(ins!.metadata.title).toBe('Findable');
        expect(await getInsight('INS-999')).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/insights.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/insights.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';

export interface Insight {
    id: string;
    title: string;
    date: string;
    tags: string[];
}

export interface InsightFile {
    metadata: Record<string, any>;
    body: string;
    path: string;
}

let insightsBaseDir = path.resolve(process.cwd(), 'insights');

export function setInsightsDir(dir: string) {
    insightsBaseDir = dir;
}

export function getInsightsDir(): string {
    return insightsBaseDir;
}

function insightPath(id: string): string {
    return path.join(getInsightsDir(), `${id}.md`);
}

export async function createInsight(title: string, tags: string[] = []): Promise<Insight> {
    const base = getInsightsDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const id = nextId(base, 'INS-');
    const date = new Date().toISOString().slice(0, 10);
    const metadata = { id, title, date, tags };
    const body = `# Insight: ${title}\n\n...\n`;
    fs.writeFileSync(insightPath(id), stringifyFrontmatter(metadata, body));
    return { id, title, date, tags };
}

export async function listInsights(): Promise<Insight[]> {
    const base = getInsightsDir();
    if (!fs.existsSync(base)) return [];
    const files = fs.readdirSync(base).filter(f => /^INS-\d+\.md$/.test(f)).sort();
    const out: Insight[] = [];
    for (const f of files) {
        const { metadata } = parseFrontmatter(fs.readFileSync(path.join(base, f), 'utf-8'));
        out.push({
            id: metadata.id,
            title: metadata.title,
            date: metadata.date ?? '',
            tags: metadata.tags ?? [],
        });
    }
    return out;
}

export async function getInsight(id: string): Promise<InsightFile | null> {
    const file = insightPath(id);
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, path: file };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/insights.test.ts`
Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insights.ts tests/lib/insights.test.ts
git commit -m "feat: add filesystem-backed insights module"
```

---

## Task 7: Rewrite reasoning.ts (filesystem only, preserve Mermaid branch-outcome nodes)

**Goal:** Replace `strategy.ts` with a filesystem-only reasoning module. LOG nodes live as `reasoning/LOG-NNN.md` files with frontmatter encoding `hypothesis, evidence_score, certainty, parent_id, branch_a, branch_b` and an optional markdown body for analysis. The Mermaid generator preserves the intermediate `LOG-NNN_A` / `LOG-NNN_B` branch-outcome nodes since those represent experimental outcomes.

**Files:**
- Create: `src/lib/reasoning.ts`
- Create: `tests/lib/reasoning.test.ts`
- Delete (after tests pass): `src/lib/strategy.ts`, `tests/lib/strategy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/reasoning.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    createReasoningNode,
    getReasoningNode,
    listReasoningNodes,
    generateStrategyMap,
    linkExperimentToNode,
    setReasoningDir,
} from '../../src/lib/reasoning';
import { createExperiment, setExperimentsDir, getExperiment } from '../../src/lib/experiments';

describe('reasoning', () => {
    let tmpDir: string;
    let reasoningDir: string;
    let experimentsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-reasoning-'));
        reasoningDir = path.join(tmpDir, 'reasoning');
        experimentsDir = path.join(tmpDir, 'experiments');
        setReasoningDir(reasoningDir);
        setExperimentsDir(experimentsDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a reasoning node file', async () => {
        const node = await createReasoningNode({
            id: 'LOG-001',
            hypothesis: 'Root hypothesis',
            branch_a: 'Branch A outcome',
            branch_b: 'Branch B outcome',
        });
        expect(node.id).toBe('LOG-001');
        const file = path.join(reasoningDir, 'LOG-001.md');
        expect(fs.existsSync(file)).toBe(true);
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).toContain('id: LOG-001');
        expect(content).toContain('hypothesis: Root hypothesis');
        expect(content).toContain('# Reasoning: Root hypothesis');
    });

    it('getReasoningNode returns node or null', async () => {
        await createReasoningNode({ id: 'LOG-001', hypothesis: 'H' });
        const node = await getReasoningNode('LOG-001');
        expect(node).not.toBeNull();
        expect(node!.metadata.hypothesis).toBe('H');
        expect(await getReasoningNode('LOG-999')).toBeNull();
    });

    it('listReasoningNodes returns every node sorted by ID', async () => {
        await createReasoningNode({ id: 'LOG-002', hypothesis: 'Second' });
        await createReasoningNode({ id: 'LOG-001', hypothesis: 'First' });
        const all = await listReasoningNodes();
        expect(all.map(n => n.id)).toEqual(['LOG-001', 'LOG-002']);
    });

    it('generateStrategyMap produces Mermaid with intermediate branch nodes', async () => {
        await createReasoningNode({
            id: 'LOG-001',
            hypothesis: 'Root Hypothesis',
            branch_a: 'Branch A leads to LOG-002',
            branch_b: 'Branch B leads to LOG-003',
        });
        await createReasoningNode({ id: 'LOG-002', hypothesis: 'Branch A Follow-up', parent_id: 'LOG-001' });
        await createReasoningNode({ id: 'LOG-003', hypothesis: 'Branch B Follow-up', parent_id: 'LOG-001' });

        const map = await generateStrategyMap();
        expect(map).toContain('graph TD;');
        expect(map).toContain('LOG-001["Root Hypothesis"];');
        expect(map).toContain('LOG-001_A["Branch A leads to LOG-002"];');
        expect(map).toContain('LOG-001 --> LOG-001_A;');
        expect(map).toContain('LOG-001_A --> LOG-002;');
        expect(map).toContain('LOG-001_B["Branch B leads to LOG-003"];');
        expect(map).toContain('LOG-001 --> LOG-001_B;');
        expect(map).toContain('LOG-001_B --> LOG-003;');
    });

    it('linkExperimentToNode updates experiment frontmatter', async () => {
        await createExperiment('Exp', 'H');
        await createReasoningNode({ id: 'LOG-001', hypothesis: 'Root' });
        await linkExperimentToNode('EXP-001', 'LOG-001');
        const exp = await getExperiment('EXP-001');
        expect(exp!.metadata.linked_node).toBe('LOG-001');
    });

    it('linkExperimentToNode throws if experiment missing', async () => {
        await createReasoningNode({ id: 'LOG-001', hypothesis: 'Root' });
        await expect(linkExperimentToNode('EXP-404', 'LOG-001')).rejects.toThrow('Experiment EXP-404 not found');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/reasoning.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/reasoning.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { getExperiment, getExperimentsDir } from './experiments';

export interface ReasoningNodeInit {
    id: string;
    hypothesis: string;
    parent_id?: string;
    branch_a?: string;
    branch_b?: string;
    evidence_score?: number;
    certainty?: number;
}

export interface ReasoningNode {
    id: string;
    hypothesis: string;
    evidence_score: number;
    certainty: number;
    parent_id?: string;
    branch_a?: string;
    branch_b?: string;
}

export interface ReasoningNodeFile {
    metadata: Record<string, any>;
    body: string;
    path: string;
}

let reasoningBaseDir = path.resolve(process.cwd(), 'reasoning');

export function setReasoningDir(dir: string) {
    reasoningBaseDir = dir;
}

export function getReasoningDir(): string {
    return reasoningBaseDir;
}

function nodePath(id: string): string {
    return path.join(getReasoningDir(), `${id}.md`);
}

export async function createReasoningNode(init: ReasoningNodeInit): Promise<ReasoningNode> {
    const base = getReasoningDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const metadata: Record<string, any> = {
        id: init.id,
        hypothesis: init.hypothesis,
        evidence_score: init.evidence_score ?? 0.0,
        certainty: init.certainty ?? 0.0,
    };
    if (init.parent_id) metadata.parent_id = init.parent_id;
    if (init.branch_a) metadata.branch_a = init.branch_a;
    if (init.branch_b) metadata.branch_b = init.branch_b;
    const body = `# Reasoning: ${init.hypothesis}\n\n...\n`;
    fs.writeFileSync(nodePath(init.id), stringifyFrontmatter(metadata, body));
    return {
        id: init.id,
        hypothesis: init.hypothesis,
        evidence_score: metadata.evidence_score,
        certainty: metadata.certainty,
        parent_id: init.parent_id,
        branch_a: init.branch_a,
        branch_b: init.branch_b,
    };
}

export async function getReasoningNode(id: string): Promise<ReasoningNodeFile | null> {
    const file = nodePath(id);
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, path: file };
}

export async function listReasoningNodes(): Promise<ReasoningNode[]> {
    const base = getReasoningDir();
    if (!fs.existsSync(base)) return [];
    const files = fs.readdirSync(base).filter(f => /^LOG-\d+\.md$/.test(f)).sort();
    const nodes: ReasoningNode[] = [];
    for (const f of files) {
        const { metadata } = parseFrontmatter(fs.readFileSync(path.join(base, f), 'utf-8'));
        nodes.push({
            id: metadata.id,
            hypothesis: metadata.hypothesis,
            evidence_score: metadata.evidence_score ?? 0.0,
            certainty: metadata.certainty ?? 0.0,
            parent_id: metadata.parent_id,
            branch_a: metadata.branch_a,
            branch_b: metadata.branch_b,
        });
    }
    return nodes;
}

export async function generateStrategyMap(): Promise<string> {
    const nodes = await listReasoningNodes();
    let map = 'graph TD;\n';
    for (const node of nodes) {
        map += `    ${node.id}["${node.hypothesis}"];\n`;
        if (node.branch_a) {
            const branchAId = `${node.id}_A`;
            map += `    ${branchAId}["${node.branch_a}"];\n`;
            map += `    ${node.id} --> ${branchAId};\n`;
            const child = nodes.find(n => n.parent_id === node.id && node.branch_a!.includes(n.id));
            if (child) {
                map += `    ${branchAId} --> ${child.id};\n`;
            }
        }
        if (node.branch_b) {
            const branchBId = `${node.id}_B`;
            map += `    ${branchBId}["${node.branch_b}"];\n`;
            map += `    ${node.id} --> ${branchBId};\n`;
            const child = nodes.find(n => n.parent_id === node.id && node.branch_b!.includes(n.id));
            if (child) {
                map += `    ${branchBId} --> ${child.id};\n`;
            }
        }
    }
    return map;
}

export async function linkExperimentToNode(expId: string, nodeId: string): Promise<void> {
    const exp = await getExperiment(expId);
    if (!exp) throw new Error(`Experiment ${expId} not found`);
    const protocolPath = path.join(exp.dir, 'protocol.md');
    const raw = fs.readFileSync(protocolPath, 'utf-8');
    const { metadata, body } = parseFrontmatter(raw);
    metadata.linked_node = nodeId;
    fs.writeFileSync(protocolPath, stringifyFrontmatter(metadata, body));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/reasoning.test.ts`
Expected: PASS — 6/6.

- [ ] **Step 5: Delete old strategy module**

```bash
rm src/lib/strategy.ts tests/lib/strategy.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/reasoning.ts tests/lib/reasoning.test.ts
git rm src/lib/strategy.ts tests/lib/strategy.test.ts
git commit -m "refactor(reasoning): filesystem storage for LOG nodes, preserve branch-outcome Mermaid"
```

---

## Task 8: Data Migration Script — DB to Filesystem

**Goal:** Read the existing `data/alchemist.db` once and serialize everything it contains that *isn't already on the filesystem* into markdown files. In practice this means writing `reasoning/LOG-001.md` from the `reasoning` table. Experiments and tasks are already on disk.

**Files:**
- Create: `scripts/migrate-db-to-fs.ts`

- [ ] **Step 1: Create the migration script**

Create `scripts/migrate-db-to-fs.ts`:

```typescript
#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { createReasoningNode } from '../src/lib/reasoning';

const DB_PATH = path.resolve(process.cwd(), 'data/alchemist.db');

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.log(`No DB at ${DB_PATH}; nothing to migrate.`);
        return;
    }
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

    const nodes: any[] = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM reasoning', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    for (const node of nodes) {
        const file = path.resolve(process.cwd(), `reasoning/${node.id}.md`);
        if (fs.existsSync(file)) {
            console.log(`Skipping ${node.id}: already exists on filesystem.`);
            continue;
        }
        await createReasoningNode({
            id: node.id,
            hypothesis: node.hypothesis,
            evidence_score: node.evidence_score ?? 0.0,
            certainty: node.certainty ?? 0.0,
            parent_id: node.parent_id ?? undefined,
            branch_a: node.branch_a ?? undefined,
            branch_b: node.branch_b ?? undefined,
        });
        console.log(`Wrote reasoning/${node.id}.md`);
    }

    db.close();
    console.log(`Migration complete: ${nodes.length} reasoning node(s) considered.`);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx scripts/migrate-db-to-fs.ts`
Expected output (approximate):
```
Wrote reasoning/LOG-001.md
Migration complete: 1 reasoning node(s) considered.
```

- [ ] **Step 3: Verify the output**

Run: `cat reasoning/LOG-001.md`
Expected: frontmatter with `id: LOG-001`, `hypothesis: Does a silicone oil droplet...`, `branch_a: Deterministic Walking (LOG-002: Diffraction)`, `branch_b: Chaotic Bouncing/Merging (LOG-003: Calibration)`, `evidence_score: 0`, `certainty: 0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-db-to-fs.ts reasoning/
git commit -m "chore: migrate existing reasoning nodes from DB to filesystem"
```

---

## Task 9: Full-Text Search

**Goal:** A `search` function that returns all markdown files whose content matches a query, with one-line-per-match context. Uses `grep -r` shelled out as a child process (no new dependency; `grep` is universal).

**Files:**
- Create: `src/lib/search.ts`
- Create: `tests/lib/search.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/search.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { search } from '../../src/lib/search';

describe('search', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-search-'));
        fs.mkdirSync(path.join(tmpDir, 'experiments/EXP-001-test'), { recursive: true });
        fs.mkdirSync(path.join(tmpDir, 'tasks'), { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'experiments/EXP-001-test/protocol.md'), 'Hello droplet world.\n');
        fs.writeFileSync(path.join(tmpDir, 'tasks/TSK-001.md'), 'Buy droplet sensor.\n');
        fs.writeFileSync(path.join(tmpDir, 'tasks/TSK-002.md'), 'No match here.\n');
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('finds matches across subdirectories', async () => {
        const results = await search('droplet', { roots: [tmpDir] });
        expect(results.length).toBe(2);
        expect(results.some(r => r.file.endsWith('protocol.md'))).toBe(true);
        expect(results.some(r => r.file.endsWith('TSK-001.md'))).toBe(true);
    });

    it('returns empty array when nothing matches', async () => {
        const results = await search('nonexistent-term-xyz', { roots: [tmpDir] });
        expect(results).toEqual([]);
    });

    it('each result has file and line content', async () => {
        const results = await search('droplet', { roots: [tmpDir] });
        for (const r of results) {
            expect(typeof r.file).toBe('string');
            expect(typeof r.line).toBe('string');
            expect(r.line).toContain('droplet');
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/search.ts`:

```typescript
import { spawnSync } from 'child_process';
import * as path from 'path';

export interface SearchHit {
    file: string;
    line: string;
}

export interface SearchOptions {
    roots?: string[];
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const roots = options.roots ?? [
        path.resolve(process.cwd(), 'experiments'),
        path.resolve(process.cwd(), 'tasks'),
        path.resolve(process.cwd(), 'insights'),
        path.resolve(process.cwd(), 'reasoning'),
    ];
    const existing = roots.filter(r => {
        try { return require('fs').existsSync(r); } catch { return false; }
    });
    if (existing.length === 0) return [];

    const result = spawnSync('grep', ['-r', '-n', '-F', query, ...existing], {
        encoding: 'utf-8',
    });
    // grep exits 1 on "no match"; treat as empty, not an error
    if (result.status !== 0 && result.status !== 1) {
        throw new Error(`grep failed: ${result.stderr}`);
    }
    const hits: SearchHit[] = [];
    for (const rawLine of (result.stdout || '').split('\n')) {
        if (!rawLine.trim()) continue;
        // format: path:lineno:content
        const firstColon = rawLine.indexOf(':');
        if (firstColon === -1) continue;
        const secondColon = rawLine.indexOf(':', firstColon + 1);
        if (secondColon === -1) continue;
        const file = rawLine.slice(0, firstColon);
        const line = rawLine.slice(secondColon + 1);
        hits.push({ file, line });
    }
    return hits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/search.test.ts`
Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search.ts tests/lib/search.test.ts
git commit -m "feat: add grep-based full-text search across markdown"
```

---

## Task 10: Rewrite the CLI

**Goal:** Replace `src/cli/index.ts` with a cleaner, filesystem-backed command surface plus a global `--json` flag. Also rewrite `journal.ts` here because both depend on the new lib modules and the old lib types are gone.

The final commands (order by frequency of use):
- `list <type>` — type = `experiments | tasks | insights | nodes`
- `show <id>` — auto-routes by prefix
- `search <query>`
- `plan <title> [--hypothesis <text>]`
- `task <title> [--priority <level>] [--linked-exp <id>]`
- `insight <title> [--tag <tag>...]`
- `hypothesize <id> <hypothesis> [--parent <id>] [--branch-a <text>] [--branch-b <text>]`
- `measure <expId> <key>=<value> [unit]`
- `note <expId> <text>`
- `complete <id>`
- `conclude <expId> <outcome>`
- `link <expId> <nodeId>`
- `map`
- `publish`

Global option: `--json` for structured output on every command.

**Files:**
- Rewrite: `src/cli/index.ts`
- Rewrite: `src/lib/journal.ts`
- Modify: `package.json` (add `tsx` devDependency for CLI integration tests)
- Rewrite: `tests/cli/plan.test.ts` → delete and replace with `tests/cli/cli.test.ts`
- Delete: `tests/cli/consult.test.ts` (covered by new CLI tests and by experiments.test.ts's `getExperiment`)

- [ ] **Step 1: Add tsx as a devDependency**

The CLI integration test spawns `npx tsx src/cli/index.ts` so it runs against TypeScript source without a build step. Add tsx to `package.json` `devDependencies`:

```json
"tsx": "^4.0.0"
```

Run: `npm install`
Expected: tsx installed.

- [ ] **Step 2: Delete old CLI tests (they exercise removed modules)**

```bash
rm tests/cli/plan.test.ts tests/cli/consult.test.ts
```

- [ ] **Step 3: Write the new CLI test**

Create `tests/cli/cli.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

const CLI = path.resolve(__dirname, '../../src/cli/index.ts');

function runCli(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('npx', ['tsx', CLI, ...args], { cwd, encoding: 'utf-8' });
    return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 0 };
}

describe('alchemy CLI', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-cli-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('plan + list experiments --json', () => {
        const plan = runCli(['plan', 'Pilot wave', '--hypothesis', 'Walks in 50-80Hz'], tmpDir);
        expect(plan.status).toBe(0);
        const list = runCli(['--json', 'list', 'experiments'], tmpDir);
        expect(list.status).toBe(0);
        const data = JSON.parse(list.stdout);
        expect(Array.isArray(data)).toBe(true);
        expect(data[0].id).toBe('EXP-001');
        expect(data[0].title).toBe('Pilot wave');
    });

    it('task + complete + list tasks --json filters done', () => {
        runCli(['task', 'First'], tmpDir);
        runCli(['task', 'Second'], tmpDir);
        runCli(['complete', 'TSK-001'], tmpDir);
        const list = runCli(['--json', 'list', 'tasks'], tmpDir);
        const data = JSON.parse(list.stdout);
        expect(data.map((t: any) => t.id)).toEqual(['TSK-002']);
    });

    it('show <id> routes by prefix and emits JSON', () => {
        runCli(['plan', 'Show me', '--hypothesis', 'h'], tmpDir);
        const show = runCli(['--json', 'show', 'EXP-001'], tmpDir);
        expect(show.status).toBe(0);
        const data = JSON.parse(show.stdout);
        expect(data.metadata.id).toBe('EXP-001');
        expect(typeof data.body).toBe('string');
    });

    it('measure appends a JSONL line', () => {
        runCli(['plan', 'M', '--hypothesis', 'h'], tmpDir);
        const m = runCli(['measure', 'EXP-001', 'temp=22.5', 'C'], tmpDir);
        expect(m.status).toBe(0);
        const files = fs.readdirSync(path.join(tmpDir, 'experiments'));
        const expDir = files[0];
        const jsonl = fs.readFileSync(path.join(tmpDir, 'experiments', expDir, 'measurements.jsonl'), 'utf-8');
        const parsed = JSON.parse(jsonl.trim());
        expect(parsed.key).toBe('temp');
        expect(parsed.value).toBe(22.5);
        expect(parsed.unit).toBe('C');
    });

    it('note appends an observation and shows up in show body', () => {
        runCli(['plan', 'Noteable', '--hypothesis', 'h'], tmpDir);
        runCli(['note', 'EXP-001', 'The droplet walked.'], tmpDir);
        const show = runCli(['--json', 'show', 'EXP-001'], tmpDir);
        const data = JSON.parse(show.stdout);
        expect(data.body).toContain('## Observations');
        expect(data.body).toContain('- The droplet walked.');
    });

    it('hypothesize creates a LOG node; map emits Mermaid graph', () => {
        runCli(['hypothesize', 'LOG-001', 'Root', '--branch-a', 'Branch A', '--branch-b', 'Branch B'], tmpDir);
        const map = runCli(['map'], tmpDir);
        expect(map.status).toBe(0);
        const strategy = fs.readFileSync(path.join(tmpDir, 'STRATEGY.md'), 'utf-8');
        expect(strategy).toContain('graph TD;');
        expect(strategy).toContain('LOG-001["Root"];');
        expect(strategy).toContain('LOG-001_A["Branch A"];');
    });

    it('search returns structured hits with --json', () => {
        runCli(['plan', 'Search me', '--hypothesis', 'Unique-keyword-XYZ'], tmpDir);
        const res = runCli(['--json', 'search', 'Unique-keyword-XYZ'], tmpDir);
        expect(res.status).toBe(0);
        const data = JSON.parse(res.stdout);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].line).toContain('Unique-keyword-XYZ');
    });

    it('unknown id prefix on show exits nonzero', () => {
        const r = runCli(['show', 'ZZZ-001'], tmpDir);
        expect(r.status).not.toBe(0);
    });
});
```

- [ ] **Step 4: Rewrite journal.ts to read from filesystem**

Overwrite `src/lib/journal.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { listExperiments } from './experiments';
import { listTasks } from './tasks';
import { generateStrategyMap } from './reasoning';

export async function generateJournal(): Promise<string> {
    const experiments = (await listExperiments()).filter(e => e.status === 'active');
    const tasks = await listTasks();
    const strategyMap = await generateStrategyMap();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab Journal - Alchemist</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        pre { background-color: #f8f8f8; border: 1px solid #ddd; padding: 10px; overflow-x: auto; }
        .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .high { background-color: #ffebee; color: #c62828; }
        .medium { background-color: #fff3e0; color: #ef6c00; }
        .low { background-color: #e8f5e9; color: #2e7d32; }
    </style>
</head>
<body>
    <h1>Lab Journal</h1>
    <p>Last updated: ${new Date().toLocaleString()}</p>

    <h2>Active Experiments</h2>
    <table>
        <thead>
            <tr><th>ID</th><th>Title</th><th>Hypothesis</th></tr>
        </thead>
        <tbody>
            ${experiments.map(exp => `
                <tr>
                    <td>${exp.id}</td>
                    <td>${exp.title}</td>
                    <td>${exp.hypothesis || 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Pending Tasks</h2>
    <table>
        <thead>
            <tr><th>ID</th><th>Title</th><th>Priority</th></tr>
        </thead>
        <tbody>
            ${tasks.map(task => `
                <tr>
                    <td>${task.id}</td>
                    <td>${task.title}</td>
                    <td><span class="tag ${task.priority}">${task.priority}</span></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Strategic Map</h2>
    <pre><code>${strategyMap}</code></pre>

</body>
</html>`;

    const siteDir = path.resolve(process.cwd(), 'site');
    if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir, { recursive: true });
    fs.writeFileSync(path.join(siteDir, 'index.html'), html);
    return html;
}
```

- [ ] **Step 5: Rewrite CLI**

Overwrite `src/cli/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import {
    createExperiment,
    listExperiments,
    getExperiment,
    appendMeasurement,
    appendObservation,
    concludeExperiment,
} from '../lib/experiments';
import {
    createTask,
    listTasks,
    getTask,
    completeTask,
} from '../lib/tasks';
import {
    createInsight,
    listInsights,
    getInsight,
} from '../lib/insights';
import {
    createReasoningNode,
    listReasoningNodes,
    getReasoningNode,
    generateStrategyMap,
    linkExperimentToNode,
} from '../lib/reasoning';
import { search } from '../lib/search';
import { generateJournal } from '../lib/journal';

const program = new Command();

program
    .name('alchemy')
    .description('Lab Notebook Protocol for Scientific Discovery')
    .version('0.2.0')
    .option('--json', 'Emit structured JSON on stdout');

function isJson(): boolean {
    return !!program.opts().json;
}

function out(human: string, structured: unknown) {
    if (isJson()) {
        console.log(JSON.stringify(structured, null, 2));
    } else {
        console.log(human);
    }
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

program
    .command('plan')
    .description('Create an experiment')
    .argument('<title>')
    .option('--hypothesis <text>', 'Hypothesis', 'N/A')
    .action(async (title, options) => {
        const exp = await createExperiment(title, options.hypothesis);
        out(`Created ${exp.id}: ${exp.title}`, exp);
    });

program
    .command('task')
    .description('Create a task')
    .argument('<title>')
    .option('--priority <level>', 'Priority', 'medium')
    .option('--linked-exp <id>', 'Linked experiment ID')
    .action(async (title, options) => {
        const task = await createTask(title, options.priority, options.linkedExp);
        out(`Created ${task.id}: ${task.title}`, task);
    });

program
    .command('insight')
    .description('Create an insight')
    .argument('<title>')
    .option('--tag <tag...>', 'Tags', [])
    .action(async (title, options) => {
        const ins = await createInsight(title, options.tag);
        out(`Created ${ins.id}: ${ins.title}`, ins);
    });

program
    .command('hypothesize')
    .description('Create a reasoning node')
    .argument('<id>')
    .argument('<hypothesis>')
    .option('--parent <id>', 'Parent node ID')
    .option('--branch-a <text>', 'Branch A outcome label')
    .option('--branch-b <text>', 'Branch B outcome label')
    .action(async (id, hypothesis, options) => {
        const node = await createReasoningNode({
            id,
            hypothesis,
            parent_id: options.parent,
            branch_a: options.branchA,
            branch_b: options.branchB,
        });
        out(`Created ${node.id}: ${node.hypothesis}`, node);
    });

program
    .command('list')
    .description('List records of a type')
    .argument('<type>', 'experiments | tasks | insights | nodes')
    .action(async (type) => {
        switch (type) {
            case 'experiments': {
                const data = await listExperiments();
                out(data.map(e => `${e.id} [${e.status}] ${e.title}`).join('\n') || 'No experiments.', data);
                return;
            }
            case 'tasks': {
                const data = await listTasks();
                out(data.map(t => `${t.id} (${t.priority}) ${t.title}`).join('\n') || 'No pending tasks.', data);
                return;
            }
            case 'insights': {
                const data = await listInsights();
                out(data.map(i => `${i.id} (${i.date}) ${i.title}`).join('\n') || 'No insights.', data);
                return;
            }
            case 'nodes': {
                const data = await listReasoningNodes();
                out(data.map(n => `${n.id} ${n.hypothesis}`).join('\n') || 'No reasoning nodes.', data);
                return;
            }
            default:
                fail(`Unknown type: ${type}. Use experiments | tasks | insights | nodes.`);
        }
    });

program
    .command('show')
    .description('Show a record by ID')
    .argument('<id>')
    .action(async (id) => {
        let record: { metadata: Record<string, any>; body: string } | null = null;
        if (id.startsWith('EXP-')) record = await getExperiment(id);
        else if (id.startsWith('TSK-')) record = await getTask(id);
        else if (id.startsWith('INS-')) record = await getInsight(id);
        else if (id.startsWith('LOG-')) record = await getReasoningNode(id);
        else fail(`Unknown ID prefix: ${id}`);

        if (!record) fail(`Not found: ${id}`);

        const human = `# ${record!.metadata.id}: ${record!.metadata.title ?? record!.metadata.hypothesis ?? ''}\n\n${record!.body}`;
        out(human, record);
    });

program
    .command('measure')
    .description('Append a measurement to an experiment')
    .argument('<expId>')
    .argument('<kv>', 'key=value')
    .argument('[unit]')
    .action(async (expId, kv, unit) => {
        const [key, rawValue] = kv.split('=');
        if (!key || rawValue === undefined) fail(`Expected key=value, got: ${kv}`);
        const value = parseFloat(rawValue);
        if (Number.isNaN(value)) fail(`Value is not a number: ${rawValue}`);
        await appendMeasurement(expId, key, value, unit);
        out(`Recorded ${key}=${value}${unit ? ' ' + unit : ''} for ${expId}`, { expId, key, value, unit });
    });

program
    .command('note')
    .description('Append an observation to an experiment')
    .argument('<expId>')
    .argument('<text>')
    .action(async (expId, text) => {
        await appendObservation(expId, text);
        out(`Noted observation on ${expId}`, { expId, text });
    });

program
    .command('complete')
    .description('Mark a task complete')
    .argument('<id>')
    .action(async (id) => {
        await completeTask(id);
        out(`Completed ${id}`, { id, status: 'done' });
    });

program
    .command('conclude')
    .description('Conclude an experiment')
    .argument('<expId>')
    .argument('<outcome>')
    .action(async (expId, outcome) => {
        await concludeExperiment(expId, outcome);
        out(`Concluded ${expId}`, { expId, status: 'concluded', outcome });
    });

program
    .command('link')
    .description('Link an experiment to a reasoning node')
    .argument('<expId>')
    .argument('<nodeId>')
    .action(async (expId, nodeId) => {
        await linkExperimentToNode(expId, nodeId);
        out(`Linked ${expId} → ${nodeId}`, { expId, nodeId });
    });

program
    .command('search')
    .description('Full-text search across the lab notebook')
    .argument('<query>')
    .action(async (query) => {
        const hits = await search(query);
        const human = hits.map(h => `${h.file}: ${h.line}`).join('\n') || 'No matches.';
        out(human, hits);
    });

program
    .command('map')
    .description('Write STRATEGY.md from reasoning nodes')
    .action(async () => {
        const map = await generateStrategyMap();
        fs.writeFileSync('STRATEGY.md', `# Strategy Map\n\n\`\`\`mermaid\n${map}\n\`\`\`\n`);
        out('Updated STRATEGY.md', { path: 'STRATEGY.md' });
    });

program
    .command('publish')
    .description('Generate the HTML lab journal')
    .action(async () => {
        await generateJournal();
        out('Wrote site/index.html', { path: 'site/index.html' });
    });

async function main() {
    try {
        await program.parseAsync(process.argv);
    } catch (err: any) {
        fail(err.message || String(err));
    }
}

main();
```

- [ ] **Step 6: Run the new CLI tests**

Run: `npx vitest run tests/cli/cli.test.ts`
Expected: PASS — 8/8.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: All passing EXCEPT `tests/lib/bridge.test.ts` and `tests/db/init.test.ts` — those still exist and reference dead code. They will be removed in Task 11.

If any test other than those two fails, stop and fix before committing.

- [ ] **Step 8: Commit**

```bash
git add src/cli/index.ts src/lib/journal.ts tests/cli/cli.test.ts package.json package-lock.json
git rm tests/cli/plan.test.ts tests/cli/consult.test.ts
git commit -m "feat(cli): new command surface, global --json, filesystem journal"
```

---

## Task 11: Delete the DB Layer and Dead Modules

**Goal:** Remove `src/db/`, `src/lib/bridge.ts`, `src/lib/consultant.ts`, their tests, and the `sqlite3` / `@types/sqlite3` package.json entries. After this task the repo has no DB code and the full test suite is green.

**Files:**
- Delete: `src/db/` (all files)
- Delete: `src/lib/bridge.ts`
- Delete: `src/lib/consultant.ts`
- Delete: `tests/db/` (all files)
- Delete: `tests/lib/bridge.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete DB layer and stale modules**

```bash
rm -r src/db
rm src/lib/bridge.ts src/lib/consultant.ts
rm -r tests/db
rm tests/lib/bridge.test.ts
```

- [ ] **Step 2: Remove sqlite3 from package.json**

Edit `package.json`. Remove:
- `"sqlite3": "^5.1.0"` from `dependencies`
- `"@types/sqlite3": "^3.1.0"` from `devDependencies`

Final `dependencies`:
```json
"dependencies": {
    "commander": "^11.0.0",
    "zod": "^3.22.0",
    "yaml": "^2.3.0"
}
```

Final `devDependencies`:
```json
"devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^0.34.0",
    "@types/node": "^20.0.0"
}
```

But **keep** sqlite3 installed locally for running the one-shot migration script from Task 8. Since Task 8 already ran and committed the result, we don't need sqlite3 anymore. The migration script will fail to run after this task — that's acceptable because it's a one-shot.

Actually, to be safe: also delete the now-broken `scripts/migrate-db-to-fs.ts`.

```bash
rm scripts/migrate-db-to-fs.ts
rmdir scripts 2>/dev/null || true
```

(`rmdir` only removes if the directory is empty — so it's safe.)

- [ ] **Step 3: Reinstall to clear node_modules of sqlite3**

Run: `rm -rf node_modules package-lock.json && npm install`

Expected: clean install, no sqlite3 present.

- [ ] **Step 4: Delete DB and bridge.json data files**

```bash
rm -f data/alchemist.db data/bridge.json
rmdir data 2>/dev/null || true
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: ALL passing. Count should be: 5 (frontmatter) + 5 (ids) + 8 (experiments) + 7 (tasks) + 4 (insights) + 6 (reasoning) + 3 (search) + 8 (cli) = 46 passing, across 8 test files.

- [ ] **Step 6: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: drop SQLite layer and bridge.json; filesystem is now sole source of truth"
```

---

## Task 12: Update AGENTS.md and GEMINI.md

**Goal:** Reflect the new command surface and storage model in the human-readable agent docs. Keep the spirit (PI/Hands partnership, Rule 6 etc.) but replace outdated CLI references.

**Files:**
- Modify: `AGENTS.md`
- Modify: `GEMINI.md`

- [ ] **Step 1: Read current AGENTS.md and GEMINI.md**

Run: `cat AGENTS.md GEMINI.md | head -200`
Identify sections that describe storage (DB, bridge.json) or CLI commands — these are the ones to rewrite.

- [ ] **Step 2: Update AGENTS.md**

Replace any section describing "the DB" or "bridge.json" with a section titled **State & Storage** that says:

```markdown
## State & Storage

The lab notebook lives entirely on the filesystem. There is no database.

- `experiments/EXP-NNN-slug/protocol.md` — experiment spec (frontmatter + body).
- `experiments/EXP-NNN-slug/measurements.jsonl` — append-only measurements.
- `tasks/TSK-NNN.md` — one task per file.
- `insights/INS-NNN.md` — one insight per file.
- `reasoning/LOG-NNN.md` — one reasoning node per file.
- `STRATEGY.md` — auto-generated Mermaid map of the reasoning tree (regenerate with `alchemy map`).
- `site/index.html` — auto-generated HTML lab journal (regenerate with `alchemy publish`).

Everything is versioned in git. A fresh clone has the full lab state.
```

Replace any CLI command listing with:

```markdown
## CLI Surface

All commands accept a global `--json` flag (placed **before** the subcommand, e.g. `alchemy --json list experiments`) for machine-readable output.

**Create:**
- `alchemy plan <title> --hypothesis <text>` — new experiment
- `alchemy task <title> [--priority <level>] [--linked-exp <id>]` — new task
- `alchemy insight <title> [--tag <tag>...]` — new insight
- `alchemy hypothesize <id> <hypothesis> [--parent <id>] [--branch-a <text>] [--branch-b <text>]` — new reasoning node

**Read:**
- `alchemy list <experiments|tasks|insights|nodes>`
- `alchemy show <id>` — autoroutes by `EXP-` / `TSK-` / `INS-` / `LOG-` prefix
- `alchemy search <query>` — full-text across all markdown

**Update:**
- `alchemy measure <expId> <key>=<value> [unit]` — append datapoint
- `alchemy note <expId> <text>` — append observation
- `alchemy complete <id>` — mark task done
- `alchemy conclude <expId> <outcome>` — close experiment
- `alchemy link <expId> <nodeId>` — link experiment to reasoning node

**Generate:**
- `alchemy map` — write `STRATEGY.md`
- `alchemy publish` — write `site/index.html`
```

Keep everything else in AGENTS.md (PI/Hands partnership, ETHICS.md reference, etc.) unchanged.

- [ ] **Step 3: Update GEMINI.md with the same sections**

If GEMINI.md mirrors AGENTS.md content, make the same substitutions. If it already delegates to AGENTS.md, no changes needed.

- [ ] **Step 4: Verify no other docs mention sqlite/db/bridge.json**

Run: `grep -r -i -l 'sqlite\|alchemist.db\|bridge.json' --include='*.md' .`
Expected: no matches (or only matches in `docs/superpowers/plans/` — this plan itself).

If a match appears in a doc file, update it to describe the filesystem model instead.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md GEMINI.md
git commit -m "docs: update CLI surface and storage model in agent docs"
```

---

## Task 13: Final Smoke Test

**Goal:** End-to-end verify the new CLI behaves correctly against a clean repo state.

This task has no code changes. It exists to catch integration issues and confirm the system is shippable. No commit.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors, `dist/` populated.

- [ ] **Step 3: Smoke test — list existing records**

Run: `make run ARGS='list experiments'`
Expected: `EXP-001 [active] Pilot-Wave Silicon Droplet`.

Run: `make run ARGS='--json list nodes'`
Expected: JSON array with LOG-001.

Run: `make run ARGS='list tasks'`
Expected: TSK-001 and TSK-002 listed.

- [ ] **Step 4: Smoke test — create a throwaway insight, then delete it**

Run: `make run ARGS='insight "Smoke test insight" --tag smoke'`
Verify: `insights/INS-002.md` exists with frontmatter.

Clean up: `rm insights/INS-002.md`

- [ ] **Step 5: Smoke test — regenerate the HTML journal and strategy map**

Run: `make run ARGS='publish'`
Run: `make run ARGS='map'`
Verify: `site/index.html` and `STRATEGY.md` are regenerated and readable.

- [ ] **Step 6: Report**

Report to the user: all tests green, build clean, CLI smoke-tested against the real repo, ready to merge.

---

## Post-Plan Checklist (for the reviewing engineer)

After all tasks complete, before merging:
- [ ] 46 tests passing across 8 test files
- [ ] `npx tsc --noEmit` clean
- [ ] No references to `sqlite3`, `bridge.json`, or `alchemist.db` in any source file (check with `grep -r`)
- [ ] `data/` directory removed
- [ ] `src/db/` removed
- [ ] `experiments/` tracked by git
- [ ] `reasoning/LOG-001.md` present and matches pre-migration DB content
- [ ] AGENTS.md and GEMINI.md describe the filesystem model
- [ ] All commits follow conventional-commits style
