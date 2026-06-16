/**
 * @file csvParser.ts
 * @brief Parses raw CSV data into a format suitable for the Data Tables.
 */

import { Logger } from './logger';

export function parseCSV(text: string): {x: number | null, y: number | null}[] {
    Logger.info('CSVParser', 'Parsing CSV data...');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];

    const points: {x: number | null, y: number | null}[] = [];
    
    for (const line of lines) {
        const parts = line.split(/[,\t;]+/);
        if (parts.length >= 2) {
            const xVal = parseFloat(parts[0].trim());
            const yVal = parseFloat(parts[1].trim());
            
            if (!isNaN(xVal) && !isNaN(yVal)) {
                points.push({ x: xVal, y: yVal });
            }
        }
    }
    
    Logger.info('CSVParser', `Successfully parsed ${points.length} points from CSV.`);
    return points;
}
