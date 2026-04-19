#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { createReasoningNode } from '../src/lib/reasoning';

const DB_PATH = path.resolve(process.cwd(), 'data/alchemist.db');

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.log(`No DB at ${DB_PATH}; nothing to migrate.`);
        return;
    }
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);

    const nodes: any[] = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM reasoning', (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    for (const node of nodes) {
        const file = path.resolve(process.cwd(), `reasoning/${node.id}.md`);
        if (fs.existsSync(file)) {
            console.log(`Skipping ${node.id}: already exists on filesystem.`);
            continue;
        }
        await createReasoningNode({
            id: node.id,
            hypothesis: node.hypothesis,
            evidence_score: node.evidence_score ?? 0.0,
            certainty: node.certainty ?? 0.0,
            parent_id: node.parent_id ?? undefined,
            branch_a: node.branch_a ?? undefined,
            branch_b: node.branch_b ?? undefined,
        });
        console.log(`Wrote reasoning/${node.id}.md`);
    }

    db.close();
    console.log(`Migration complete: ${nodes.length} reasoning node(s) considered.`);
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
