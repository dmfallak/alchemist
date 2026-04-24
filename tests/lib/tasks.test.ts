import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTask, listTasks, getTask, completeTask, editTask, setTasksDir } from '../../src/lib/tasks';
import { createExperiment, getExperiment, setExperimentsDir } from '../../src/lib/experiments';

describe('tasks', () => {
    let tmpDir: string;
    let expDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-tasks-'));
        expDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alchemist-tasks-exp-'));
        setTasksDir(tmpDir);
        setExperimentsDir(expDir);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        fs.rmSync(expDir, { recursive: true, force: true });
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

    it('completeTask records a result in the task frontmatter', async () => {
        await createTask('Ask user for fridge temp', 'low');
        await completeTask('TSK-001', '38 degF');
        const t = await getTask('TSK-001');
        expect(t!.metadata.status).toBe('done');
        expect(t!.metadata.result).toBe('38 degF');
    });

    it('completeTask with a result promotes it to an observation on the linked experiment', async () => {
        const exp = await createExperiment('Fridge calibration', 'H');
        await createTask('Ask user for fridge temp', 'low', exp.id);
        await completeTask('TSK-001', '38 degF');
        const e = await getExperiment(exp.id);
        expect(e!.body).toContain('## Observations');
        expect(e!.body).toContain('[from TSK-001] 38 degF');
    });

    it('editTask updates title in frontmatter', async () => {
        await createTask('Old Title', 'low');
        await editTask('TSK-001', { title: 'New Title' });
        const t = await getTask('TSK-001');
        expect(t!.metadata.title).toBe('New Title');
        expect(t!.metadata.priority).toBe('low');
    });

    it('editTask updates priority in frontmatter', async () => {
        await createTask('My Task', 'low');
        await editTask('TSK-001', { priority: 'high' });
        const t = await getTask('TSK-001');
        expect(t!.metadata.priority).toBe('high');
        expect(t!.metadata.title).toBe('My Task');
    });

    it('editTask throws when task not found', async () => {
        await expect(editTask('TSK-999', { title: 'X' })).rejects.toThrow('Task TSK-999 not found');
    });

    it('completeTask without a result does not promote or record', async () => {
        const exp = await createExperiment('Fridge calibration', 'H');
        await createTask('Ask user for fridge temp', 'low', exp.id);
        await completeTask('TSK-001');
        const t = await getTask('TSK-001');
        expect(t!.metadata.result).toBeUndefined();
        const e = await getExperiment(exp.id);
        expect(e!.body).not.toContain('## Observations');
    });
});
