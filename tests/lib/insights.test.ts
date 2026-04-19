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
