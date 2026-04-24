import * as fs from 'fs';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { nextId } from './ids';
import { appendObservation } from './experiments';

export interface Task {
    id: string;
    title: string;
    priority: string;
    status: string;
    linked_exp?: string;
}

export interface TaskFile {
    metadata: Record<string, any>;
    body: string;
    path: string;
}

let tasksBaseDir = path.resolve(process.cwd(), 'tasks');

export function setTasksDir(dir: string) {
    tasksBaseDir = dir;
}

export function getTasksDir(): string {
    return tasksBaseDir;
}

function taskPath(id: string): string {
    return path.join(getTasksDir(), `${id}.md`);
}

export async function createTask(
    title: string,
    priority: string,
    linked_exp?: string,
): Promise<Task> {
    const base = getTasksDir();
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
    const id = nextId(base, 'TSK-');
    const metadata: Record<string, any> = {
        id,
        title,
        priority,
        status: 'backlog',
    };
    if (linked_exp) metadata.linked_exp = linked_exp;
    const body = `# Task: ${title}\n\n...\n`;
    fs.writeFileSync(taskPath(id), stringifyFrontmatter(metadata, body));
    return { id, title, priority, status: 'backlog', linked_exp };
}

export interface ListOptions {
    all?: boolean;
}

export async function listTasks(options: ListOptions = {}): Promise<Task[]> {
    const base = getTasksDir();
    if (!fs.existsSync(base)) return [];
    const files = fs.readdirSync(base).filter(f => /^TSK-\d+\.md$/.test(f)).sort();
    const tasks: Task[] = [];
    for (const f of files) {
        const { metadata } = parseFrontmatter(fs.readFileSync(path.join(base, f), 'utf-8'));
        if (!options.all && metadata.status === 'done') continue;
        tasks.push({
            id: metadata.id,
            title: metadata.title,
            priority: metadata.priority,
            status: metadata.status,
            linked_exp: metadata.linked_exp,
        });
    }
    return tasks;
}

export async function getTask(id: string): Promise<TaskFile | null> {
    const file = taskPath(id);
    if (!fs.existsSync(file)) return null;
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    return { metadata, body, path: file };
}

export async function editTask(
    id: string,
    fields: { title?: string; priority?: string },
): Promise<void> {
    const file = taskPath(id);
    if (!fs.existsSync(file)) throw new Error(`Task ${id} not found`);
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    if (fields.title !== undefined) metadata.title = fields.title;
    if (fields.priority !== undefined) metadata.priority = fields.priority;
    fs.writeFileSync(file, stringifyFrontmatter(metadata, body));
}

export async function completeTask(id: string, result?: string): Promise<void> {
    const file = taskPath(id);
    if (!fs.existsSync(file)) throw new Error(`Task ${id} not found`);
    const { metadata, body } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    metadata.status = 'done';
    if (result !== undefined) {
        metadata.result = result;
    }
    fs.writeFileSync(file, stringifyFrontmatter(metadata, body));

    if (result !== undefined && metadata.linked_exp) {
        await appendObservation(metadata.linked_exp, `[from ${id}] ${result}`);
    }
}
