import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';

export interface Experiment {
    id: string;
    title: string;
    hypothesis: string;
    status: string;
}

export interface Measurement {
    timestamp: string;
    key: string;
    value: number;
    unit?: string;
}

export interface ExperimentFile {
    metadata: Record<string, any>;
    body: string;
    dir: string;
}

let experimentsBaseDir = path.resolve(process.cwd(), 'experiments');

export function setExperimentsDir(dir: string) {
    experimentsBaseDir = dir;
}

export function getExperimentsDir(): string {
    return experimentsBaseDir;
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function findExperimentDir(id: string): string | null {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) return null;
    const match = fs.readdirSync(base).find(d => d.startsWith(`${id}-`) || d === id);
    return match ? path.join(base, match) : null;
}

export async function createExperiment(title: string, hypothesis: string): Promise<Experiment> {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

    const id = nextId(base, 'EXP-');
    const slug = slugify(title);
    const dir = path.join(base, `${id}-${slug}`);
    fs.mkdirSync(dir, { recursive: true });

    const metadata = {
        id,
        title,
        hypothesis,
        status: 'active',
        inputs: [],
        observations: [],
        safety: [],
    };
    const body = `# Protocol: ${title}\n\n...\n`;
    fs.writeFileSync(path.join(dir, 'protocol.md'), stringifyFrontmatter(metadata, body));

    return { id, title, hypothesis, status: 'active' };
}

export async function listExperiments(): Promise<Experiment[]> {
    const base = getExperimentsDir();
    if (!fs.existsSync(base)) return [];
    const dirs = fs.readdirSync(base).filter(d => /^EXP-\d+/.test(d)).sort();
    const results: Experiment[] = [];
    for (const d of dirs) {
        const file = path.join(base, d, 'protocol.md');
        if (!fs.existsSync(file)) continue;
        const { metadata } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
        results.push({
            id: metadata.id,
            title: metadata.title,
            hypothesis: metadata.hypothesis ?? '',
            status: metadata.status ?? 'active',
        });
    }
    return results;
}

export async function getExperiment(id: string): Promise<ExperimentFile | null> {
    const dir = findExperimentDir(id);
    if (!dir) return null;
    const file = path.join(dir, 'protocol.md');
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, dir };
}

export async function appendMeasurement(
    id: string,
    key: string,
    value: number,
    unit?: string,
): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const line: Measurement = { timestamp: new Date().toISOString(), key, value };
    if (unit !== undefined) line.unit = unit;
    fs.appendFileSync(path.join(dir, 'measurements.jsonl'), JSON.stringify(line) + '\n');
}

export async function readMeasurements(id: string): Promise<Measurement[]> {
    const dir = findExperimentDir(id);
    if (!dir) return [];
    const file = path.join(dir, 'measurements.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line));
}

export async function appendObservation(id: string, text: string): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const file = path.join(dir, 'protocol.md');
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    let newBody: string;
    if (body.includes('## Observations')) {
        newBody = body.replace(/## Observations\n/, `## Observations\n- ${text}\n`);
    } else {
        newBody = body.trimEnd() + `\n\n## Observations\n- ${text}\n`;
    }
    fs.writeFileSync(file, stringifyFrontmatter(metadata, newBody));
}

export async function editExperiment(
    id: string,
    fields: { title?: string; hypothesis?: string },
): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const file = path.join(dir, 'protocol.md');
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    if (fields.title !== undefined) metadata.title = fields.title;
    if (fields.hypothesis !== undefined) metadata.hypothesis = fields.hypothesis;
    fs.writeFileSync(file, stringifyFrontmatter(metadata, body));
}

export async function concludeExperiment(id: string, outcome: string): Promise<void> {
    const dir = findExperimentDir(id);
    if (!dir) throw new Error(`Experiment ${id} not found`);
    const file = path.join(dir, 'protocol.md');
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    metadata.status = 'concluded';
    const newBody = body.trimEnd() + `\n\n## Outcome\n${outcome}\n`;
    fs.writeFileSync(file, stringifyFrontmatter(metadata, newBody));
}
