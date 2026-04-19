#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import {
    createExperiment,
    listExperiments,
    getExperiment,
    appendMeasurement,
    appendObservation,
    concludeExperiment,
    setExperimentsDir,
} from '../lib/experiments';
import {
    createTask,
    listTasks,
    getTask,
    completeTask,
    setTasksDir,
} from '../lib/tasks';
import {
    createInsight,
    listInsights,
    getInsight,
    setInsightsDir,
} from '../lib/insights';
import {
    createReasoningNode,
    listReasoningNodes,
    getReasoningNode,
    generateStrategyMap,
    linkExperimentToNode,
    setReasoningDir,
} from '../lib/reasoning';
import { search } from '../lib/search';
import { generateJournal } from '../lib/journal';

// Resolve all data directories relative to cwd at runtime
const cwd = process.cwd();
setExperimentsDir(path.resolve(cwd, 'experiments'));
setTasksDir(path.resolve(cwd, 'tasks'));
setInsightsDir(path.resolve(cwd, 'insights'));
setReasoningDir(path.resolve(cwd, 'reasoning'));

const program = new Command();

program
    .name('alchemy')
    .description('Lab Notebook Protocol for Scientific Discovery')
    .version('0.2.0')
    .option('--json', 'Emit structured JSON on stdout');

function isJson(): boolean {
    return !!program.opts().json;
}

function out(human: string, structured: unknown) {
    if (isJson()) {
        console.log(JSON.stringify(structured, null, 2));
    } else {
        console.log(human);
    }
}

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

program
    .command('plan')
    .description('Create an experiment')
    .argument('<title>')
    .option('--hypothesis <text>', 'Hypothesis', 'N/A')
    .action(async (title, options) => {
        const exp = await createExperiment(title, options.hypothesis);
        out(`Created ${exp.id}: ${exp.title}`, exp);
    });

program
    .command('task')
    .description('Create a task')
    .argument('<title>')
    .option('--priority <level>', 'Priority', 'medium')
    .option('--linked-exp <id>', 'Linked experiment ID')
    .action(async (title, options) => {
        const task = await createTask(title, options.priority, options.linkedExp);
        out(`Created ${task.id}: ${task.title}`, task);
    });

program
    .command('insight')
    .description('Create an insight')
    .argument('<title>')
    .option('--tag <tag...>', 'Tags', [])
    .action(async (title, options) => {
        const ins = await createInsight(title, options.tag);
        out(`Created ${ins.id}: ${ins.title}`, ins);
    });

program
    .command('hypothesize')
    .description('Create a reasoning node')
    .argument('<id>')
    .argument('<hypothesis>')
    .option('--parent <id>', 'Parent node ID')
    .option('--branch-a <text>', 'Branch A outcome label')
    .option('--branch-b <text>', 'Branch B outcome label')
    .action(async (id, hypothesis, options) => {
        const node = await createReasoningNode({
            id,
            hypothesis,
            parent_id: options.parent,
            branch_a: options.branchA,
            branch_b: options.branchB,
        });
        out(`Created ${node.id}: ${node.hypothesis}`, node);
    });

program
    .command('list')
    .description('List records of a type')
    .argument('<type>', 'experiments | tasks | insights | nodes')
    .action(async (type) => {
        switch (type) {
            case 'experiments': {
                const data = await listExperiments();
                out(data.map(e => `${e.id} [${e.status}] ${e.title}`).join('\n') || 'No experiments.', data);
                return;
            }
            case 'tasks': {
                const data = await listTasks();
                out(data.map(t => `${t.id} (${t.priority}) ${t.title}`).join('\n') || 'No pending tasks.', data);
                return;
            }
            case 'insights': {
                const data = await listInsights();
                out(data.map(i => `${i.id} (${i.date}) ${i.title}`).join('\n') || 'No insights.', data);
                return;
            }
            case 'nodes': {
                const data = await listReasoningNodes();
                out(data.map(n => `${n.id} ${n.hypothesis}`).join('\n') || 'No reasoning nodes.', data);
                return;
            }
            default:
                fail(`Unknown type: ${type}. Use experiments | tasks | insights | nodes.`);
        }
    });

program
    .command('show')
    .description('Show a record by ID')
    .argument('<id>')
    .action(async (id) => {
        let record: { metadata: Record<string, any>; body: string } | null = null;
        if (id.startsWith('EXP-')) record = await getExperiment(id);
        else if (id.startsWith('TSK-')) record = await getTask(id);
        else if (id.startsWith('INS-')) record = await getInsight(id);
        else if (id.startsWith('LOG-')) record = await getReasoningNode(id);
        else fail(`Unknown ID prefix: ${id}`);

        if (!record) fail(`Not found: ${id}`);

        const human = `# ${record!.metadata.id}: ${record!.metadata.title ?? record!.metadata.hypothesis ?? ''}\n\n${record!.body}`;
        out(human, record);
    });

program
    .command('measure')
    .description('Append a measurement to an experiment')
    .argument('<expId>')
    .argument('<kv>', 'key=value')
    .argument('[unit]')
    .action(async (expId, kv, unit) => {
        const [key, rawValue] = kv.split('=');
        if (!key || rawValue === undefined) fail(`Expected key=value, got: ${kv}`);
        const value = parseFloat(rawValue);
        if (Number.isNaN(value)) fail(`Value is not a number: ${rawValue}`);
        await appendMeasurement(expId, key, value, unit);
        out(`Recorded ${key}=${value}${unit ? ' ' + unit : ''} for ${expId}`, { expId, key, value, unit });
    });

program
    .command('note')
    .description('Append an observation to an experiment')
    .argument('<expId>')
    .argument('<text>')
    .action(async (expId, text) => {
        await appendObservation(expId, text);
        out(`Noted observation on ${expId}`, { expId, text });
    });

program
    .command('complete')
    .description('Mark a task complete')
    .argument('<id>')
    .action(async (id) => {
        await completeTask(id);
        out(`Completed ${id}`, { id, status: 'done' });
    });

program
    .command('conclude')
    .description('Conclude an experiment')
    .argument('<expId>')
    .argument('<outcome>')
    .action(async (expId, outcome) => {
        await concludeExperiment(expId, outcome);
        out(`Concluded ${expId}`, { expId, status: 'concluded', outcome });
    });

program
    .command('link')
    .description('Link an experiment to a reasoning node')
    .argument('<expId>')
    .argument('<nodeId>')
    .action(async (expId, nodeId) => {
        await linkExperimentToNode(expId, nodeId);
        out(`Linked ${expId} → ${nodeId}`, { expId, nodeId });
    });

program
    .command('search')
    .description('Full-text search across the lab notebook')
    .argument('<query>')
    .action(async (query) => {
        const hits = await search(query);
        const human = hits.map(h => `${h.file}: ${h.line}`).join('\n') || 'No matches.';
        out(human, hits);
    });

program
    .command('map')
    .description('Write STRATEGY.md from reasoning nodes')
    .action(async () => {
        const map = await generateStrategyMap();
        fs.writeFileSync(path.resolve(cwd, 'STRATEGY.md'), `# Strategy Map\n\n\`\`\`mermaid\n${map}\n\`\`\`\n`);
        out('Updated STRATEGY.md', { path: 'STRATEGY.md' });
    });

program
    .command('publish')
    .description('Generate the HTML lab journal')
    .action(async () => {
        await generateJournal();
        out('Wrote site/index.html', { path: 'site/index.html' });
    });

async function main() {
    try {
        await program.parseAsync(process.argv);
    } catch (err: any) {
        fail(err.message || String(err));
    }
}

main();
