import * as fs from 'fs';
import * as path from 'path';
import { getActiveExperiments } from './protocols';
import { getPendingTasks } from './tasks';
import { generateStrategyMap } from './strategy';

export async function generateJournal(): Promise<string> {
    const activeExperiments = await getActiveExperiments();
    const pendingTasks = await getPendingTasks();
    const strategyMap = await generateStrategyMap();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lab Journal - Alchemist</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        pre { background-color: #f8f8f8; border: 1px solid #ddd; padding: 10px; overflow-x: auto; }
        .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .high { background-color: #ffebee; color: #c62828; }
        .medium { background-color: #fff3e0; color: #ef6c00; }
        .low { background-color: #e8f5e9; color: #2e7d32; }
    </style>
</head>
<body>
    <h1>Lab Journal</h1>
    <p>Last updated: ${new Date().toLocaleString()}</p>

    <h2>Active Experiments</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Hypothesis</th>
            </tr>
        </thead>
        <tbody>
            ${activeExperiments.map(exp => `
                <tr>
                    <td>${exp.id}</td>
                    <td>${exp.title}</td>
                    <td>${exp.hypothesis || 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Pending Tasks</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Priority</th>
            </tr>
        </thead>
        <tbody>
            ${pendingTasks.map(task => `
                <tr>
                    <td>${task.id}</td>
                    <td>${task.title}</td>
                    <td><span class="tag ${task.priority}">${task.priority}</span></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Strategic Map</h2>
    <pre><code>${strategyMap}</code></pre>

</body>
</html>`;

    const siteDir = path.resolve(process.cwd(), 'site');
    if (!fs.existsSync(siteDir)) {
        fs.mkdirSync(siteDir, { recursive: true });
    }

    fs.writeFileSync(path.join(siteDir, 'index.html'), html);
    return html;
}
