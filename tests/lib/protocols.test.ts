import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getExperimentContext } from '../../src/lib/protocols';

vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

describe('getExperimentContext', () => {
    const experimentsDir = path.resolve(process.cwd(), 'experiments');

    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return null if experiments directory does not exist', async () => {
        (fs.existsSync as any).mockImplementation((p: string) => {
            if (p === experimentsDir) return false;
            return true;
        });
        const result = await getExperimentContext('EXP-001');
        expect(result).toBeNull();
    });

    it('should return null if experiment ID directory is not found', async () => {
        (fs.existsSync as any).mockImplementation((p: string) => {
            if (p === experimentsDir) return true;
            return false;
        });
        (fs.readdirSync as any).mockReturnValue(['EXP-002-other']);
        const result = await getExperimentContext('EXP-001');
        expect(result).toBeNull();
    });

    it('should parse protocol file with frontmatter', async () => {
        const id = 'EXP-001';
        const dirName = 'EXP-001-test';
        const protocolPath = path.join(experimentsDir, dirName, 'protocol.md');
        const protocolContent = `---\nid: EXP-001\ntitle: Test Experiment\n---\n# Content\nSome markdown content.`;

        (fs.existsSync as any).mockImplementation((p: string) => {
            if (p === experimentsDir) return true;
            if (p === protocolPath) return true;
            return false;
        });
        (fs.readdirSync as any).mockReturnValue([dirName]);
        (fs.readFileSync as any).mockReturnValue(protocolContent);

        const result = await getExperimentContext(id);

        expect(result).not.toBeNull();
        expect(result?.metadata).toEqual({ id: 'EXP-001', title: 'Test Experiment' });
        expect(result?.content).toContain('# Content');
        expect(result?.content).toContain('Some markdown content.');
    });

    it('should handle missing frontmatter gracefully', async () => {
        const id = 'EXP-001';
        const dirName = 'EXP-001-test';
        const protocolPath = path.join(experimentsDir, dirName, 'protocol.md');
        const protocolContent = `# Content\nNo frontmatter here.`;

        (fs.existsSync as any).mockImplementation((p: string) => {
            if (p === experimentsDir) return true;
            if (p === protocolPath) return true;
            return false;
        });
        (fs.readdirSync as any).mockReturnValue([dirName]);
        (fs.readFileSync as any).mockReturnValue(protocolContent);

        const result = await getExperimentContext(id);

        expect(result).not.toBeNull();
        expect(result?.metadata).toEqual({});
        expect(result?.content).toBe(protocolContent);
    });
});
