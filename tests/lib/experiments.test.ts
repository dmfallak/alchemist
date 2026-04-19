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
