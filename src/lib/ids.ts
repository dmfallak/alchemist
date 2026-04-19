import * as fs from 'fs';

export function nextId(dir: string, prefix: string): string {
    if (!fs.existsSync(dir)) {
        return `${prefix}001`;
    }
    const entries = fs.readdirSync(dir);
    const re = new RegExp(`^${prefix}(\\d+)`);
    let max = 0;
    for (const entry of entries) {
        const match = entry.match(re);
        if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
        }
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
