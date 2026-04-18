import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { setDatabasePath, closeDatabase, getDatabase } from '../../src/db/connection';
import { updateBridge, setBridgeDir } from '../../src/lib/bridge';

const TEST_DB = path.resolve(process.cwd(), 'tests-temp-bridge.db');
const TEST_BRIDGE_DIR = path.resolve(process.cwd(), 'tests-temp-bridge');

describe('Being Bridge', () => {
    beforeEach(async () => {
        setDatabasePath(TEST_DB);
        setBridgeDir(TEST_BRIDGE_DIR);
        if (!fs.existsSync(TEST_BRIDGE_DIR)) {
            fs.mkdirSync(TEST_BRIDGE_DIR, { recursive: true });
        }
    });

    afterEach(async () => {
        await closeDatabase();
        if (fs.existsSync(TEST_DB)) {
            fs.unlinkSync(TEST_DB);
        }
        if (fs.existsSync(TEST_BRIDGE_DIR)) {
            fs.rmSync(TEST_BRIDGE_DIR, { recursive: true, force: true });
        }
    });

    it('should update bridge.json with current state', async () => {
        const db = await getDatabase();
        
        // Populate DB
        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run('INSERT INTO tasks (id, title, priority, status) VALUES (?, ?, ?, ?)', ['TSK-001', 'Test Task', 'high', 'backlog']);
                db.run('INSERT INTO experiments (id, title, hypothesis, status) VALUES (?, ?, ?, ?)', ['EXP-001', 'Test Experiment', 'Test Hypothesis', 'active']);
                db.run('INSERT INTO measurements (experiment_id, key, value, unit) VALUES (?, ?, ?, ?)', ['EXP-001', 'temp', 25.5, 'C']);
                db.run('INSERT INTO reasoning (id, hypothesis) VALUES (?, ?)', ['LOG-001', 'Bridge Hypothesis'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        await updateBridge();

        const filePath = path.join(TEST_BRIDGE_DIR, 'bridge.json');
        expect(fs.existsSync(filePath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(content.tasks.length).toBe(1);
        expect(content.tasks[0].id).toBe('TSK-001');
        expect(content.measurements.length).toBe(1);
        expect(content.measurements[0].key).toBe('temp');
        expect(content.reasoning.length).toBe(1);
        expect(content.reasoning[0].id).toBe('LOG-001');
        expect(content.last_updated).toBeDefined();
    });

    it('should only fetch the last 5 measurements', async () => {
        const db = await getDatabase();
        
        // Populate DB with 10 measurements
        await new Promise<void>((resolve, reject) => {
            db.serialize(() => {
                db.run('INSERT INTO experiments (id, title, hypothesis, status) VALUES (?, ?, ?, ?)', ['EXP-001', 'Test Experiment', 'Test Hypothesis', 'active']);
                for (let i = 0; i < 10; i++) {
                    db.run('INSERT INTO measurements (experiment_id, key, value, unit) VALUES (?, ?, ?, ?)', ['EXP-001', 'm' + i, i, 'unit']);
                }
                db.run('SELECT 1', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        await updateBridge();

        const filePath = path.join(TEST_BRIDGE_DIR, 'bridge.json');
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(content.measurements.length).toBe(5);
    });
});
