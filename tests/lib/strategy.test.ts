import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setDatabasePath, closeDatabase, getDatabase } from '../../src/db/connection';
import { createReasoningNode, generateStrategyMap, linkExperimentToNode } from '../../src/lib/strategy';

const TEST_DB = ':memory:';

describe('Strategy Engine', () => {
    beforeEach(async () => {
        setDatabasePath(TEST_DB);
    });

    afterEach(async () => {
        await closeDatabase();
    });

    it('should create a reasoning node', async () => {
        await createReasoningNode('LOG-001', 'Test Hypothesis');
        const db = await getDatabase();
        const node: any = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM reasoning WHERE id = ?', ['LOG-001'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        expect(node).toBeDefined();
        expect(node.id).toBe('LOG-001');
        expect(node.hypothesis).toBe('Test Hypothesis');
    });

    it('should generate a strategy map in Mermaid format', async () => {
        await createReasoningNode('LOG-001', 'Root Hypothesis', undefined, 'LOG-002', 'LOG-003');
        await createReasoningNode('LOG-002', 'Branch A');
        await createReasoningNode('LOG-003', 'Branch B');

        const map = await generateStrategyMap();
        expect(map).toContain('graph TD;');
        expect(map).toContain('LOG-001["Root Hypothesis"];');
        expect(map).toContain('LOG-001 --> LOG-002;');
        expect(map).toContain('LOG-001 --> LOG-003;');
        expect(map).toContain('LOG-002["Branch A"];');
        expect(map).toContain('LOG-003["Branch B"];');
    });

    it('should link an experiment to a node', async () => {
        const db = await getDatabase();
        // Insert a dummy experiment first
        await new Promise<void>((resolve, reject) => {
            db.run('INSERT INTO experiments (id, title) VALUES (?, ?)', ['EXP-001', 'Test Exp'], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        await createReasoningNode('LOG-001', 'Test Hypothesis');
        await linkExperimentToNode('EXP-001', 'LOG-001');

        const exp: any = await new Promise((resolve, reject) => {
            db.get('SELECT linked_node FROM experiments WHERE id = ?', ['EXP-001'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        expect(exp.linked_node).toBe('LOG-001');
    });

    it('should throw error when linking non-existent experiment', async () => {
        await createReasoningNode('LOG-001', 'Test Hypothesis');
        await expect(linkExperimentToNode('NON-EXISTENT', 'LOG-001')).rejects.toThrow('Experiment NON-EXISTENT not found');
    });
});
