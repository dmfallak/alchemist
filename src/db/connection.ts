import { Database } from 'sqlite3';
import { initializeDatabase } from './init';
import * as path from 'path';
import * as fs from 'fs';

let DB_PATH = path.resolve(process.cwd(), 'data', 'alchemist.db');

let dbInstance: Database | null = null;

export function setDatabasePath(newPath: string): void {
    DB_PATH = newPath;
    dbInstance = null;
}

export async function getDatabase(): Promise<Database> {
    if (dbInstance) {
        return dbInstance;
    }

    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        const db = new Database(DB_PATH, async (err) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                await initializeDatabase(db);
                dbInstance = db;
                resolve(db);
            } catch (initErr) {
                reject(initErr);
            }
        });
    });
}

export async function closeDatabase(): Promise<void> {
    if (dbInstance) {
        return new Promise((resolve, reject) => {
            dbInstance?.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    dbInstance = null;
                    resolve();
                }
            });
        });
    }
}
