import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'yaml';
import { getDatabase } from '../db/connection';

export interface Task {
    id: string;
    title: string;
    priority: string;
    status: string;
    linked_exp?: string;
    created_at?: string;
}

export async function generateTaskId(): Promise<string> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM tasks ORDER BY id DESC LIMIT 1', (err, row: any) => {
            if (err) {
                reject(err);
                return;
            }
            if (!row) {
                resolve('TSK-001');
                return;
            }
            const match = row.id.match(/TSK-(\d+)/);
            if (match) {
                const nextId = parseInt(match[1]) + 1;
                resolve(`TSK-${nextId.toString().padStart(3, '0')}`);
            } else {
                resolve('TSK-001');
            }
        });
    });
}

let tasksBaseDir = path.resolve(process.cwd(), 'tasks');

export function setTasksDir(dir: string) {
    tasksBaseDir = dir;
}

export function getTasksDir(): string {
    return tasksBaseDir;
}

export async function createTask(title: string, priority: string, linked_exp?: string): Promise<Task> {
    const id = await generateTaskId();
    const tasksDir = getTasksDir();

    if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
    }

    const task: Task = {
        id,
        title,
        priority,
        status: 'backlog',
        linked_exp: linked_exp || undefined,
    };

    const frontmatter = `---\n${stringify(task)}---\n`;
    const content = `${frontmatter}# Task: ${title}\n\n...`;

    fs.writeFileSync(path.join(tasksDir, `${id}.md`), content);

    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tasks (id, title, priority, status, linked_exp) VALUES (?, ?, ?, ?, ?)',
            [id, title, priority, 'backlog', linked_exp || null],
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(task);
            }
        );
    });
}

export async function getPendingTasks(): Promise<Task[]> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM tasks WHERE status != "done" ORDER BY created_at DESC', (err, rows: any[]) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows || []);
        });
    });
}

export async function completeTask(id: string): Promise<void> {
    const db = await getDatabase();
    
    // Update DB
    await new Promise<void>((resolve, reject) => {
        db.run('UPDATE tasks SET status = "done" WHERE id = ?', [id], function(err) {
            if (err) {
                reject(err);
                return;
            }
            if (this.changes === 0) {
                reject(new Error(`Task ${id} not found`));
                return;
            }
            resolve();
        });
    });

    // Update YAML in file
    const tasksDir = getTasksDir();
    const filePath = path.join(tasksDir, `${id}.md`);
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const match = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (match) {
            const yamlContent = match[1];
            const markdownContent = match[2];
            try {
                const metadata = parse(yamlContent);
                metadata.status = 'done';
                const newFrontmatter = `---\n${stringify(metadata)}---\n`;
                fs.writeFileSync(filePath, `${newFrontmatter}${markdownContent}`);
            } catch (e) {
                console.error('Error parsing YAML frontmatter:', e);
            }
        }
    }
}

export async function getInsights(): Promise<string[]> {
    const insightsDir = path.resolve(process.cwd(), 'insights');
    if (!fs.existsSync(insightsDir)) {
        return [];
    }
    return fs.readdirSync(insightsDir).filter(file => file.endsWith('.md'));
}
