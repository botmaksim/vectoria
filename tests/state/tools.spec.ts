import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeTool, odeSpawners } from '../../src/state/tools';

describe('Tools Store', () => {
    beforeEach(() => {
        activeTool.setMode('move');
        odeSpawners.set([]);
    });

    it('should initialize active tool to move', () => {
        expect(get(activeTool)).toBe('move');
    });

    it('should update active tool mode', () => {
        activeTool.setMode('point');
        expect(get(activeTool)).toBe('point');

        activeTool.setMode('conic');
        expect(get(activeTool)).toBe('conic');
    });

    it('should update and query odeSpawners coordinates', () => {
        expect(get(odeSpawners)).toEqual([]);

        odeSpawners.set([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
        expect(get(odeSpawners)).toEqual([
            { x: 1, y: 2 },
            { x: 3, y: 4 }
        ]);
    });
});
