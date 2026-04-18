import { getExperimentContext } from './protocols';

export async function generateBriefing(id: string): Promise<string> {
    const context = await getExperimentContext(id);
    if (!context) {
        throw new Error(`Experiment with ID ${id} not found.`);
    }

    const { metadata, content } = context;
    const title = metadata.title || 'Unknown Title';
    const hypothesis = metadata.hypothesis || 'N/A';

    // Extract Procedure from content if it exists
    let procedure = 'No procedure defined.';
    const procedureMatch = content.match(/## Procedure\n([\s\S]*?)(?=\n##|$)/);
    if (procedureMatch) {
        procedure = procedureMatch[1].trim();
    } else {
        // Fallback to the whole content if no specific Procedure section is found
        // but exclude the main title
        procedure = content.replace(/# Protocol: .*\n/, '').trim();
    }

    const scientificContext = `This experiment aims to investigate the hypothesis: "${hypothesis}". Scientific briefing is pending further data analysis.`;

    return `
# Scientific Briefing: ${title} (${id})

## Hypothesis
${hypothesis}

## Scientific Context
${scientificContext}

## Procedure
${procedure}
`.trim();
}
