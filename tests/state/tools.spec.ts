import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { activeTool } from '../../src/state/tools';

describe('Tools Store', () => {
    beforeEach(() => {
        activeTool.setMode('move');
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


});
