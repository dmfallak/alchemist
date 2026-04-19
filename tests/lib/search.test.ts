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
