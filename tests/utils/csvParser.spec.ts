import { describe, it, expect } from 'vitest';
import { parseCSV } from '../../src/utils/csvParser';

describe('CSV Parser Utility', () => {
    it('should parse simple comma-separated pairs', () => {
        const text = '1.0, 2.0\n3,4\n5.5,6.5';
        const parsed = parseCSV(text);
        expect(parsed).toEqual([
            { x: 1.0, y: 2.0 },
            { x: 3, y: 4 },
            { x: 5.5, y: 6.5 }
        ]);
    });

    it('should parse tab-separated and semicolon-separated values', () => {
        const tabText = '1\t10\n2\t20';
        expect(parseCSV(tabText)).toEqual([
            { x: 1, y: 10 },
            { x: 2, y: 20 }
        ]);

        const semiText = '1.5;15.5\n2.5;25.5';
        expect(parseCSV(semiText)).toEqual([
            { x: 1.5, y: 15.5 },
            { x: 2.5, y: 25.5 }
        ]);
    });

    it('should filter out headers and invalid rows gracefully', () => {
        const text = 'x,y\n1,10\ninvalid,row\n2,20\n3,';
        expect(parseCSV(text)).toEqual([
            { x: 1, y: 10 },
            { x: 2, y: 20 }
        ]);
    });

    it('should return empty array for empty or blank input', () => {
        expect(parseCSV('')).toEqual([]);
        expect(parseCSV('   \n  \n ')).toEqual([]);
    });
});
