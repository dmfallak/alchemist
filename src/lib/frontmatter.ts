import { parse, stringify } from 'yaml';

export interface ParsedFile {
    metadata: Record<string, any>;
    body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function parseFrontmatter(content: string): ParsedFile {
    const match = content.match(FRONTMATTER_RE);
    if (!match) {
        return { metadata: {}, body: content };
    }
    try {
        const metadata = parse(match[1]) || {};
        return { metadata, body: match[2] };
    } catch {
        return { metadata: {}, body: match[2] };
    }
}

export function stringifyFrontmatter(metadata: Record<string, any>, body: string): string {
    const yaml = stringify(metadata);
    return `---\n${yaml}---\n${body}`;
}
