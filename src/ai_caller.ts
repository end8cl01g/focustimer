import { spawnSync } from 'child_process';
import * as path from 'path';

export interface ParsedCommand {
    task: string;
    duration: number;
    start_time: string;
    error?: string;
}

export function callAiParser(text: string): ParsedCommand {
    const scriptPath = path.join(__dirname, 'ai_parser.py');
    const result = spawnSync('uv', ['run', scriptPath, text], {
        encoding: 'utf-8',
        env: { ...process.env }
    });

    if (result.error) {
        return { task: '', duration: 0, start_time: '', error: result.error.message };
    }

    try {
        // Find the last line that looks like JSON
        const lines = result.stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        return JSON.parse(lastLine);
    } catch (e) {
        return { task: '', duration: 0, start_time: '', error: 'Failed to parse AI output: ' + result.stdout };
    }
}
