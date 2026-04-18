import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';
import { initializeDatabase } from '../../src/db/init';

describe('Database Initialization', () => {
    let db: sqlite3.Database;

    beforeEach(async () => {
        db = new sqlite3.Database(':memory:');
    });

    afterEach(async () => {
        return new Promise<void>((resolve, reject) => {
            db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    it('should create experiments and measurements tables', async () => {
        await initializeDatabase(db);

        const tables = await new Promise<string[]>((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.name));
            });
        });

        expect(tables).toContain('experiments');
        expect(tables).toContain('measurements');
    });
});
