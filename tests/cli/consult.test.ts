import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createExperiment } from '../../src/lib/protocols';
import { generateBriefing } from '../../src/lib/consultant';
import { setDatabasePath, closeDatabase } from '../../src/db/connection';

describe('alchemy consult command logic', () => {
    const TEST_DB_PATH = path.resolve(__dirname, 'test-consult.db');
    const TEST_EXP_DIR = path.resolve(process.cwd(), 'experiments');

    beforeEach(async () => {
        setDatabasePath(TEST_DB_PATH);
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        if (fs.existsSync(TEST_EXP_DIR)) {
            fs.rmSync(TEST_EXP_DIR, { recursive: true, force: true });
        }
    });

    afterEach(async () => {
        await closeDatabase();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        if (fs.existsSync(TEST_EXP_DIR)) {
            fs.rmSync(TEST_EXP_DIR, { recursive: true, force: true });
        }
    });

    it('should generate a briefing for an existing experiment', async () => {
        const title = 'Consult Test';
        const hypothesis = 'Checking the briefing generation';
        const experiment = await createExperiment(title, hypothesis);

        const briefing = await generateBriefing(experiment.id);

        expect(briefing).toContain(`# Scientific Briefing: ${title} (${experiment.id})`);
        expect(briefing).toContain('## Hypothesis');
        expect(briefing).toContain(hypothesis);
        expect(briefing).toContain('## Scientific Context');
        expect(briefing).toContain('## Procedure');
    });

    it('should throw an error if experiment does not exist', async () => {
        await expect(generateBriefing('EXP-NONEXISTENT')).rejects.toThrow('Experiment with ID EXP-NONEXISTENT not found.');
    });

    it('should extract procedure if ## Procedure section exists', async () => {
        const title = 'Procedure Test';
        const hypothesis = 'Testing procedure extraction';
        const experiment = await createExperiment(title, hypothesis);

        // Manually modify protocol.md to include a Procedure section
        const experimentsDir = path.resolve(process.cwd(), 'experiments');
        const directories = fs.readdirSync(experimentsDir);
        const experimentDirName = directories.find(dir => dir.startsWith(experiment.id))!;
        const protocolPath = path.join(experimentsDir, experimentDirName, 'protocol.md');
        
        const content = fs.readFileSync(protocolPath, 'utf-8');
        const updatedContent = content + '\n\n## Procedure\nStep 1: Do something.\nStep 2: Do something else.';
        fs.writeFileSync(protocolPath, updatedContent);

        const briefing = await generateBriefing(experiment.id);
        expect(briefing).toContain('Step 1: Do something.');
        expect(briefing).toContain('Step 2: Do something else.');
    });
});
