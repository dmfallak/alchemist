import { getDatabase } from '../db/connection';

export interface ReasoningNode {
    id: string;
    hypothesis: string;
    evidence_score: number;
    branch_a?: string;
    branch_b?: string;
    certainty: number;
    parent_id?: string;
}

export async function createReasoningNode(
    id: string,
    hypothesis: string,
    parent_id?: string,
    branch_a?: string,
    branch_b?: string
): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO reasoning (id, hypothesis, parent_id, branch_a, branch_b) VALUES (?, ?, ?, ?, ?)',
            [id, hypothesis, parent_id || null, branch_a || null, branch_b || null],
            (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            }
        );
    });
}

export async function generateStrategyMap(): Promise<string> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM reasoning', (err, rows: any[]) => {
            if (err) {
                reject(err);
                return;
            }

            let map = 'graph TD;\n';
            rows.forEach((node: any) => {
                map += `    ${node.id}["${node.hypothesis}"];\n`;
                
                if (node.branch_a) {
                    const branchAId = `${node.id}_A`;
                    map += `    ${branchAId}["${node.branch_a}"];\n`;
                    map += `    ${node.id} --> ${branchAId};\n`;
                    
                    // Check if any node has this as its parent and belongs to this branch
                    const child = rows.find(r => r.parent_id === node.id && node.branch_a.includes(r.id));
                    if (child) {
                        map += `    ${branchAId} --> ${child.id};\n`;
                    }
                }
                
                if (node.branch_b) {
                    const branchBId = `${node.id}_B`;
                    map += `    ${branchBId}["${node.branch_b}"];\n`;
                    map += `    ${node.id} --> ${branchBId};\n`;
                    
                    // Check if any node has this as its parent and belongs to this branch
                    const child = rows.find(r => r.parent_id === node.id && node.branch_b.includes(r.id));
                    if (child) {
                        map += `    ${branchBId} --> ${child.id};\n`;
                    }
                }
            });
            resolve(map);
        });
    });
}

export async function linkExperimentToNode(expId: string, nodeId: string): Promise<void> {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE experiments SET linked_node = ? WHERE id = ?',
            [nodeId, expId],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                if (this.changes === 0) {
                    reject(new Error(`Experiment ${expId} not found`));
                    return;
                }
                resolve();
            }
        );
    });
}
