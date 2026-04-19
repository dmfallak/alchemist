import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';

export interface Insight {
    id: string;
    title: string;
    date: string;
    tags: string[];
}

export interface InsightFile {
    metadata: Record<string, any>;
    body: string;
    path: string;
}

let insightsBaseDir = path.resolve(process.cwd(), 'insights');

export function setInsightsDir(dir: string) {
    insightsBaseDir = dir;
}

export function getInsightsDir(): string {
    return insightsBaseDir;
}

function insightPath(id: string): string {
    return path.join(getInsightsDir(), `${id}.md`);
}

export async function createInsight(title: string, tags: string[] = []): Promise<Insight> {
    const base = getInsightsDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const id = nextId(base, 'INS-');
    const date = new Date().toISOString().slice(0, 10);
    const metadata = { id, title, date, tags };
    const body = `# Insight: ${title}\n\n...\n`;
    fs.writeFileSync(insightPath(id), stringifyFrontmatter(metadata, body));
    return { id, title, date, tags };
}

export async function listInsights(): Promise<Insight[]> {
    const base = getInsightsDir();
    if (!fs.existsSync(base)) return [];
    const files = fs.readdirSync(base).filter(f => /^INS-\d+\.md$/.test(f)).sort();
    const out: Insight[] = [];
    for (const f of files) {
        const { metadata } = parseFrontmatter(fs.readFileSync(path.join(base, f), 'utf-8'));
        out.push({
            id: metadata.id,
            title: metadata.title,
            date: metadata.date ?? '',
            tags: metadata.tags ?? [],
        });
    }
    return out;
}

export async function getInsight(id: string): Promise<InsightFile | null> {
    const file = insightPath(id);
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, path: file };
}
