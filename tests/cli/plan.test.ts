import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createExperiment, slugify } from '../../src/lib/protocols';
import { getDatabase, setDatabasePath, closeDatabase } from '../../src/db/connection';

describe('alchemy plan command logic', () => {
    const TEST_DB_PATH = path.resolve(__dirname, 'test-alchemist.db');
    const TEST_EXP_DIR = path.resolve(process.cwd(), 'experiments');

    beforeEach(async () => {
        setDatabasePath(TEST_DB_PATH);
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        if (fs.existsSync(TEST_EXP_DIR)) {
            fs.rmSync(TEST_EXP_DIR, { recursive: true, force: true });
        }
    });

    afterEach(async () => {
        await closeDatabase();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        if (fs.existsSync(TEST_EXP_DIR)) {
            fs.rmSync(TEST_EXP_DIR, { recursive: true, force: true });
        }
    });

    it('should create an experiment and register it in the database', async () => {
        const title = 'Test Experiment';
        const hypothesis = 'This should work';
        const experiment = await createExperiment(title, hypothesis);

        expect(experiment.id).toBe('EXP-001');
        expect(experiment.title).toBe(title);
        expect(experiment.hypothesis).toBe(hypothesis);

        // Check directory existence
        const slug = slugify(title);
        const experimentDir = path.join(TEST_EXP_DIR, `${experiment.id}-${slug}`);
        expect(fs.existsSync(experimentDir)).toBe(true);

        // Check protocol.md existence
        const protocolPath = path.join(experimentDir, 'protocol.md');
        expect(fs.existsSync(protocolPath)).toBe(true);

        // Check protocol.md content
        const content = fs.readFileSync(protocolPath, 'utf-8');
        expect(content).toContain(`id: ${experiment.id}`);
        expect(content).toContain(`title: ${title}`);
        expect(content).toContain(`hypothesis: ${hypothesis}`);

        // Check database
        const db = await getDatabase();
        const row: any = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM experiments WHERE id = ?', [experiment.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        expect(row).toBeDefined();
        expect(row.id).toBe(experiment.id);
        expect(row.title).toBe(title);
        expect(row.hypothesis).toBe(hypothesis);
        expect(row.status).toBe('active');
    });

    it('should increment experiment ID for subsequent experiments', async () => {
        await createExperiment('First', 'Hypothesis 1');
        const secondExp = await createExperiment('Second', 'Hypothesis 2');

        expect(secondExp.id).toBe('EXP-002');
        
        const db = await getDatabase();
        const count: any = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM experiments', (err, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        expect(count).toBe(2);
    });
});
