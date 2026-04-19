import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { getExperiment } from './experiments';

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
