#!/usr/bin/env node
import { Command } from 'commander';
import { createExperiment, slugify } from '../lib/protocols';
import { generateBriefing } from '../lib/consultant';
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

program.parseAsync(process.argv);
