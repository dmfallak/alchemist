import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { setDatabasePath, closeDatabase } from '../../src/db/connection';
import { createTask, getPendingTasks, completeTask, setTasksDir } from '../../src/lib/tasks';

const TEST_DB = ':memory:';
const TEST_TASKS_DIR = path.resolve(process.cwd(), 'tests-temp-tasks');

describe('Task Engine', () => {
    beforeEach(async () => {
        setDatabasePath(TEST_DB);
        setTasksDir(TEST_TASKS_DIR);
        if (!fs.existsSync(TEST_TASKS_DIR)) {
            fs.mkdirSync(TEST_TASKS_DIR, { recursive: true });
        }
    });

    afterEach(async () => {
        await closeDatabase();
        if (fs.existsSync(TEST_TASKS_DIR)) {
            fs.rmSync(TEST_TASKS_DIR, { recursive: true, force: true });
        }
    });

    it('should create a task and its markdown file', async () => {
        const task = await createTask('Test Task', 'high', 'EXP-001');
        expect(task.id).toBe('TSK-001');
        expect(task.title).toBe('Test Task');
        expect(task.priority).toBe('high');
        expect(task.linked_exp).toBe('EXP-001');

        const filePath = path.join(TEST_TASKS_DIR, 'TSK-001.md');
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('title: Test Task');
        expect(content).toContain('priority: high');
        expect(content).toContain('linked_exp: EXP-001');
    });

    it('should list pending tasks', async () => {
        await createTask('Task 1', 'low');
        await createTask('Task 2', 'medium');
        const tasks = await getPendingTasks();
        expect(tasks.length).toBe(2);
        const titles = tasks.map(t => t.title);
        expect(titles).toContain('Task 1');
        expect(titles).toContain('Task 2');
    });

    it('should complete a task and update its status', async () => {
        const task = await createTask('To be completed', 'low');
        await completeTask(task.id);

        const pending = await getPendingTasks();
        expect(pending.find(t => t.id === task.id)).toBeUndefined();

        const filePath = path.join(TEST_TASKS_DIR, `${task.id}.md`);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('status: done');
    });
});
