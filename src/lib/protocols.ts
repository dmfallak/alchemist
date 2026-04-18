import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { getDatabase } from '../db/connection';

export interface Experiment {
    id: string;
    title: string;
    hypothesis: string;
    status: string;
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
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export async function generateExperimentId(): Promise<string> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM experiments ORDER BY id DESC LIMIT 1', (err, row: any) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve('EXP-001');
                return;
            }
            const match = row.id.match(/EXP-(\d+)/);
            if (match) {
                const nextId = parseInt(match[1]) + 1;
                resolve(`EXP-${nextId.toString().padStart(3, '0')}`);
            } else {
                resolve('EXP-001');
            }
        });
    });
}

export async function createExperiment(title: string, hypothesis: string): Promise<Experiment> {
    const id = await generateExperimentId();
    const slug = slugify(title);
    const dirName = `${id}-${slug}`;
    const experimentsDir = path.resolve(process.cwd(), 'experiments');
    const experimentDir = path.join(experimentsDir, dirName);

    if (!fs.existsSync(experimentsDir)) {
        fs.mkdirSync(experimentsDir, { recursive: true });
    }
    fs.mkdirSync(experimentDir, { recursive: true });

    const protocol: any = {
        id,
        title,
        hypothesis,
        status: 'active',
        inputs: [],
        observations: [],
        safety: []
    };

    const frontmatter = `---\n${stringify(protocol)}---\n`;
    const content = `${frontmatter}# Protocol: ${title}\n\n...`;

    fs.writeFileSync(path.join(experimentDir, 'protocol.md'), content);

    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO experiments (id, title, hypothesis, status) VALUES (?, ?, ?, ?)',
            [id, title, hypothesis, 'active'],
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({
                    id,
                    title,
                    hypothesis,
                    status: 'active'
                });
            }
        );
    });
}

export async function getExperimentContext(id: string): Promise<{ metadata: any, content: string } | null> {
    const experimentsDir = path.resolve(process.cwd(), 'experiments');
    if (!fs.existsSync(experimentsDir)) {
        return null;
    }
    const directories = fs.readdirSync(experimentsDir);
    const experimentDirName = directories.find(dir => dir.startsWith(id));
    if (!experimentDirName) {
        return null;
    }
    const protocolPath = path.join(experimentsDir, experimentDirName, 'protocol.md');
    if (!fs.existsSync(protocolPath)) {
        return null;
    }
    const fileContent = fs.readFileSync(protocolPath, 'utf-8');
    const match = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        return { metadata: {}, content: fileContent };
    }
    const yamlContent = match[1];
    const markdownContent = match[2];
    try {
        const metadata = parse(yamlContent);
        return { metadata, content: markdownContent };
    } catch (e) {
        console.error('Error parsing YAML frontmatter:', e);
        return { metadata: {}, content: markdownContent };
    }
}
