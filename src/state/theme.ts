/**
 * @file theme.ts
 * @brief Application theme management store.
 * @details Handles toggling between light and dark modes, persisting the state to the DOM, and detecting the user's system preferences.
 */

import { writable } from 'svelte/store';
import { Logger } from '../utils/logger';

/**
 * @type Theme
 * @brief Available aesthetic themes.
 */
export type Theme = 'light' | 'dark';

/**
 * @brief Factory function creating the theme store.
 * @returns An object containing subscribe, toggle, and init methods.
 */
function createThemeStore() {
    const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme: Theme = isDark ? 'dark' : 'light';
    Logger.info('Theme', `Detected initial system theme preference: ${initialTheme}`);
    
    const { subscribe, update } = writable<Theme>(initialTheme);

    return {
        subscribe,
        /**
         * @brief Toggles the current application theme.
         */
        toggle: () => update(t => {
            const newTheme = t === 'light' ? 'dark' : 'light';
            Logger.info('Theme', `User toggled theme. Switching to: ${newTheme}`);
            if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-theme', newTheme);
            }
            return newTheme;
        }),
        /**
         * @brief Initializes the theme by applying the initial value to the DOM.
         */
        init: () => {
            Logger.debug('Theme', 'Initializing theme in DOM.');
            if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-theme', initialTheme);
            }
        }
    };
}

export const theme = createThemeStore();
