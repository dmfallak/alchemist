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
