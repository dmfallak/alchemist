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
