import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { theme } from '../../src/state/theme';

describe('Theme Store', () => {
    beforeEach(() => {
        // Reset document data-theme before each test
        if (typeof document !== 'undefined') {
            document.documentElement.removeAttribute('data-theme');
        }
    });

    it('should initialize theme state', () => {
        const currentTheme = get(theme);
        expect(['light', 'dark']).toContain(currentTheme);
    });

    it('should apply theme to document root on init()', () => {
        theme.init();
        const appliedTheme = document.documentElement.getAttribute('data-theme');
        expect(appliedTheme).toBe(get(theme));
    });

    it('should toggle theme and update DOM attributes accordingly', () => {
        const initial = get(theme);
        const expectedNext = initial === 'light' ? 'dark' : 'light';

        theme.toggle();
        expect(get(theme)).toBe(expectedNext);
        expect(document.documentElement.getAttribute('data-theme')).toBe(expectedNext);

        theme.toggle();
        expect(get(theme)).toBe(initial);
        expect(document.documentElement.getAttribute('data-theme')).toBe(initial);
    });
});
