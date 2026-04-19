import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTask, listTasks, getTask, completeTask, setTasksDir } from '../../src/lib/tasks';

describe('tasks', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-tasks-'));
        setTasksDir(tmpDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a task with markdown file and frontmatter', async () => {
        const task = await createTask('Buy a laser', 'high', 'EXP-001');
        expect(task.id).toBe('TSK-001');
        expect(task.title).toBe('Buy a laser');
        expect(task.priority).toBe('high');
        expect(task.linked_exp).toBe('EXP-001');
        const filePath = path.join(tmpDir, 'TSK-001.md');
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('id: TSK-001');
        expect(content).toContain('priority: high');
        expect(content).toContain('linked_exp: EXP-001');
    });

    it('increments task IDs from filesystem', async () => {
        await createTask('First', 'low');
        const second = await createTask('Second', 'low');
        expect(second.id).toBe('TSK-002');
    });

    it('listTasks defaults to non-done tasks', async () => {
        await createTask('Active', 'low');
        const done = await createTask('Done', 'low');
        await completeTask(done.id);
        const pending = await listTasks();
        expect(pending.map(t => t.id)).toEqual(['TSK-001']);
    });

    it('listTasks({ all: true }) returns every task', async () => {
        await createTask('A', 'low');
        const b = await createTask('B', 'low');
        await completeTask(b.id);
        const all = await listTasks({ all: true });
        expect(all).toHaveLength(2);
    });

    it('getTask returns the full record or null', async () => {
        await createTask('Findable', 'low');
        const t = await getTask('TSK-001');
        expect(t).not.toBeNull();
        expect(t!.metadata.title).toBe('Findable');
        expect(await getTask('TSK-999')).toBeNull();
    });

    it('completeTask flips status in the file', async () => {
        await createTask('To complete', 'low');
        await completeTask('TSK-001');
        const t = await getTask('TSK-001');
        expect(t!.metadata.status).toBe('done');
    });

    it('completeTask throws when the task is missing', async () => {
        await expect(completeTask('TSK-404')).rejects.toThrow('Task TSK-404 not found');
    });
});
