#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import { createExperiment, slugify } from '../lib/protocols';
import { generateBriefing } from '../lib/consultant';
import { getPendingTasks, completeTask, getInsights, createTask } from '../lib/tasks';
import { generateStrategyMap, linkExperimentToNode, createReasoningNode } from '../lib/strategy';
import { closeDatabase } from '../db/connection';

const program = new Command();

program
    .name('alchemy')
    .description('Lab Notebook Protocol for Scientific Discovery')
    .version('0.1.0');

program
    .command('plan')
    .description('Generate an experiment protocol and register it in the database')
    .argument('<title>', 'The title of the experiment')
    .option('--hypothesis <text>', 'The hypothesis of the experiment', 'N/A')
    .action(async (title, options) => {
        try {
            const experiment = await createExperiment(title, options.hypothesis);
            const slug = slugify(title);
            console.log(`Successfully planned experiment: ${experiment.id}`);
            console.log(`Directory: experiments/${experiment.id}-${slug}`);
        } catch (error: any) {
            console.error(`Error planning experiment: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('consult')
    .description('Provide a deep scientific briefing for an experiment')
    .argument('<id>', 'The ID of the experiment')
    .action(async (id) => {
        try {
            const briefing = await generateBriefing(id);
            console.log(briefing);
        } catch (error: any) {
            console.error(`Error generating briefing: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('task')
    .description('Create a new task')
    .argument('<title>', 'The title of the task')
    .option('--priority <level>', 'The priority of the task', 'medium')
    .option('--linked-exp <id>', 'The ID of the linked experiment')
    .action(async (title, options) => {
        try {
            const task = await createTask(title, options.priority, options.linkedExp);
            console.log(`Successfully created task: ${task.id}`);
            console.log(`File: tasks/${task.id}.md`);
        } catch (error: any) {
            console.error(`Error creating task: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('next')
    .description('List pending tasks')
    .action(async () => {
        try {
            const tasks = await getPendingTasks();
            if (tasks.length === 0) {
                console.log('No pending tasks.');
                return;
            }
            console.log('Pending Tasks:');
            tasks.forEach(task => {
                const linked = task.linked_exp ? ` [Exp: ${task.linked_exp}]` : '';
                console.log(`- ${task.id}: ${task.title} (${task.priority})${linked}`);
            });
        } catch (error: any) {
            console.error(`Error listing tasks: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('complete')
    .description('Complete a task')
    .argument('<id>', 'The ID of the task')
    .action(async (id) => {
        try {
            await completeTask(id);
            console.log(`Task ${id} marked as complete.`);
        } catch (error: any) {
            console.error(`Error completing task: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('news')
    .description('List recent insights')
    .action(async () => {
        try {
            const insights = await getInsights();
            if (insights.length === 0) {
                console.log('No recent insights.');
                return;
            }
            console.log('Recent Insights:');
            insights.forEach(file => {
                console.log(`- ${file}`);
            });
        } catch (error: any) {
            console.error(`Error listing insights: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('map')
    .description('Write the Mermaid map to STRATEGY.md')
    .action(async () => {
        try {
            const map = await generateStrategyMap();
            fs.writeFileSync('STRATEGY.md', `# Strategy Map\n\n\`\`\`mermaid\n${map}\n\`\`\`\n`);
            console.log('Successfully updated STRATEGY.md');
        } catch (error: any) {
            console.error(`Error generating map: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('link')
    .description('Link an experiment to a reasoning node')
    .argument('<expId>', 'The ID of the experiment')
    .argument('<nodeId>', 'The ID of the reasoning node')
    .action(async (expId, nodeId) => {
        try {
            await linkExperimentToNode(expId, nodeId);
            console.log(`Successfully linked experiment ${expId} to node ${nodeId}`);
        } catch (error: any) {
            console.error(`Error linking experiment: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program
    .command('formalize')
    .description('Parse a brainstorm file into a node (Placeholder)')
    .argument('<brainstorm_path>', 'The path to the brainstorm file')
    .action(async (brainstormPath) => {
        try {
            console.log(`Formalizing brainstorm from ${brainstormPath}...`);
            // Placeholder: For now, just create a dummy node based on the filename
            const id = `LOG-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            const hypothesis = `Hypothesis from ${brainstormPath}`;
            await createReasoningNode(id, hypothesis);
            console.log(`Successfully formalized node: ${id}`);
        } catch (error: any) {
            console.error(`Error formalizing brainstorm: ${error.message}`);
            process.exit(1);
        } finally {
            await closeDatabase();
        }
    });

program.parseAsync(process.argv);
