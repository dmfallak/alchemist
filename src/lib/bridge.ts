import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../db/connection';

let bridgeBaseDir = path.resolve(process.cwd(), 'data');

export function setBridgeDir(dir: string) {
    bridgeBaseDir = dir;
}

export function getBridgeDir(): string {
    return bridgeBaseDir;
}

export async function updateBridge(): Promise<void> {
    const db = await getDatabase();
    
    const measurements = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM measurements ORDER BY recorded_at DESC LIMIT 5', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    const tasks = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM tasks WHERE status != "done" ORDER BY created_at DESC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    const reasoning = await new Promise<any[]>((resolve, reject) => {
        db.all('SELECT * FROM reasoning', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    const bridgeData = {
        last_updated: new Date().toISOString(),
        measurements,
        tasks,
        reasoning
    };

    const dataDir = getBridgeDir();
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(dataDir, 'bridge.json'),
        JSON.stringify(bridgeData, null, 2)
    );
}
