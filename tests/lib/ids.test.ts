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
