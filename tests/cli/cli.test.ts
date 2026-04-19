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
