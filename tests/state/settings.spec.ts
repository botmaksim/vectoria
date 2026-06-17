import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { settings } from '../../src/state/settings';

describe('Settings Store', () => {
    beforeEach(() => {
        settings.set({
            gridType: 'cartesian',
            domainColoring: false
        });
    });

    it('should initialize settings correctly', () => {
        const state = get(settings);
        expect(state.gridType).toBe('cartesian');
        expect(state.domainColoring).toBe(false);
    });

    it('should toggle grid between cartesian and polar', () => {
        settings.toggleGrid();
        expect(get(settings).gridType).toBe('polar');

        settings.toggleGrid();
        expect(get(settings).gridType).toBe('cartesian');
    });

    it('should set grid explicitly', () => {
        settings.setGrid('polar');
        expect(get(settings).gridType).toBe('polar');

        settings.setGrid('cartesian');
        expect(get(settings).gridType).toBe('cartesian');
    });

    it('should toggle domain coloring state', () => {
        settings.toggleDomainColoring();
        expect(get(settings).domainColoring).toBe(true);

        settings.toggleDomainColoring();
        expect(get(settings).domainColoring).toBe(false);
    });
});
