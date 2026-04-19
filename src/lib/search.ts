import { spawnSync } from 'child_process';
import * as path from 'path';

export interface SearchHit {
    file: string;
    line: string;
}

export interface SearchOptions {
    roots?: string[];
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const roots = options.roots ?? [
        path.resolve(process.cwd(), 'experiments'),
        path.resolve(process.cwd(), 'tasks'),
        path.resolve(process.cwd(), 'insights'),
        path.resolve(process.cwd(), 'reasoning'),
    ];
    const existing = roots.filter(r => {
        try { return require('fs').existsSync(r); } catch { return false; }
    });
    if (existing.length === 0) return [];

    const result = spawnSync('grep', ['-r', '-n', '-F', query, ...existing], {
        encoding: 'utf-8',
    });
    // grep exits 1 on "no match"; treat as empty, not an error
    if (result.status !== 0 && result.status !== 1) {
        throw new Error(`grep failed: ${result.stderr}`);
    }
    const hits: SearchHit[] = [];
    for (const rawLine of (result.stdout || '').split('\n')) {
        if (!rawLine.trim()) continue;
        // format: path:lineno:content
        const firstColon = rawLine.indexOf(':');
        if (firstColon === -1) continue;
        const secondColon = rawLine.indexOf(':', firstColon + 1);
        if (secondColon === -1) continue;
        const file = rawLine.slice(0, firstColon);
        const line = rawLine.slice(secondColon + 1);
        hits.push({ file, line });
    }
    return hits;
}
