/**
 * @file store.ts
 * @brief Centralized Svelte state management for the application.
 * @details Defines stores for mathematical expressions, parametric sliders, and the viewport camera.
 */

import { writable } from 'svelte/store';
import type { Expression, CameraState, Folder } from '../core/types';
import { Logger } from '../utils/logger';

/**
 * @brief Factory function creating the expression store.
 * @returns An object containing subscribe, set, and mutation methods.
 */
function createExpressionsStore() {
    Logger.debug('Store', 'Initializing expressions store.');
    let initial: Expression[] = [
        { id: '1', type: 'math', text: 'a * sin(b * x + t)', latex: 'a \\cdot \\sin(b \\cdot x + t)', color: '#3b82f6', visible: true }
    ];
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('vectoria_expressions');
        if (saved) {
            try {
                initial = JSON.parse(saved);
            } catch (e) {}
        }
    }
    const { subscribe, set, update } = writable<Expression[]>(initial);

    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let colorIndex = 1;

    return {
        subscribe,
        /**
         * @brief Adds a new empty mathematical expression.
         * @param text Optional text to initialize the expression.
         */
        addExpression: (text: string = '', folderId?: string) => {
            Logger.info('Store', 'Adding new mathematical expression.');
            update(exprs => {
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                return [...exprs, { id: crypto.randomUUID(), type: 'math', text, latex: text, color, visible: true, folderId }];
            });
        },
        /**
         * @brief Adds a new text expression.
         */
        addTextExpression: (text: string = '', folderId?: string) => {
            Logger.info('Store', 'Adding new text expression.');
            update(exprs => {
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                return [...exprs, { id: crypto.randomUUID(), type: 'text', text, latex: '', color, visible: true, folderId }];
            });
        },
        /**
         * @brief Adds a new data table expression.
         */
        addTable: (folderId?: string) => {
            Logger.info('Store', 'Adding new data table expression.');
            update(exprs => {
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                const tableCount = exprs.filter(e => e.type === 'table').length + 1;
                const newTable: Expression = {
                    id: crypto.randomUUID(),
                    type: 'table',
                    text: '', latex: '', color, visible: true,
                    folderId,
                    xCol: `x${tableCount}`,
                    yCol: `y${tableCount}`,
                    points: [{x: null, y: null}, {x: null, y: null}]
                };
                return [...exprs, newTable];
            });
        },
        /**
         * @brief Adds a new data table pre-filled with data (e.g. from CSV).
         */
        addTableWithData: (points: {x: number | null, y: number | null}[]) => {
            Logger.info('Store', 'Adding new data table expression with imported data.');
            update(exprs => {
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                const tableCount = exprs.filter(e => e.type === 'table').length + 1;
                const newTable: Expression = {
                    id: crypto.randomUUID(),
                    type: 'table',
                    text: '', latex: '', color, visible: true,
                    xCol: `x${tableCount}`,
                    yCol: `y${tableCount}`,
                    points: [...points, {x: null, y: null}]
                };
                return [...exprs, newTable];
            });
        },
        /**
         * @brief Updates the raw text and LaTeX rendering of an expression.
         * @param id The expression identifier.
         * @param text Raw math string.
         * @param latex Rendered LaTeX string.
         */
        updateText: (id: string, text: string, latex: string) => {
            update(exprs => exprs.map(e => e.id === id ? { ...e, text, latex } : e));
        },
        /**
         * @brief Updates a coordinate point in a data table.
         * @param id The table identifier.
         * @param index Row index.
         * @param x X coordinate.
         * @param y Y coordinate.
         */
        updateTablePoint: (id: string, index: number, x: number | null, y: number | null) => {
            update(exprs => exprs.map(e => {
                if (e.id === id && e.type === 'table' && e.points) {
                    const newPoints = [...e.points];
                    newPoints[index] = { x, y };
                    if (index === newPoints.length - 1 && (x !== null || y !== null)) {
                        newPoints.push({ x: null, y: null });
                    }
                    return { ...e, points: newPoints };
                }
                return e;
            }));
        },
        /**
         * @brief Toggles the rendering visibility of an expression.
         * @param id The expression identifier.
         */
        toggleVisible: (id: string) => update(exprs => {
            Logger.info('Store', `Toggling visibility for expression ID: ${id}`);
            return exprs.map(e => e.id === id ? { ...e, visible: !e.visible } : e);
        }),
        /**
         * @brief Deletes an expression from the store.
         * @param id The expression identifier.
         */
        removeExpression: (id: string) => update(exprs => {
            Logger.info('Store', `Removing expression ID: ${id}`);
            return exprs.filter(e => e.id !== id);
        }),
        /**
         * @brief Merges visual styling properties into an expression.
         * @param id The expression identifier.
         * @param styleProps Partial expression object containing style fields.
         */
        updateStyle: (id: string, styleProps: Partial<Expression>) => update(exprs => {
            Logger.debug('Store', `Updating styles for expression ID: ${id}`);
            return exprs.map(e => e.id === id ? { ...e, ...styleProps } : e);
        }),
        /**
         * @brief Merges regression parameters into an expression.
         */
        updateRegressionParams: (id: string, params: Record<string, number>, rSquared: number) => update(exprs => {
            return exprs.map(e => {
                if (e.id !== id) return e;
                // Only update if changed to prevent infinite loops!
                const prev = e.regressionParams || {};
                let changed = false;
                if (Object.keys(params).length !== Object.keys(prev).length) changed = true;
                else {
                    for (const k in params) {
                        if (Math.abs(params[k] - prev[k]) > 1e-4) changed = true;
                    }
                }
                if (Math.abs((e.regressionRSquared || 0) - rSquared) > 1e-4) changed = true;
                if (changed) return { ...e, regressionParams: params, regressionRSquared: rSquared };
                return e;
            });
        }),
        set
    };
}

/**
 * @interface Slider
 * @brief Represents a tunable parameter in the mathematical environment.
 */
export interface Slider {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
    isPlaying?: boolean;
    animSpeed?: number;
    animDir?: 1 | -1;
}

/**
 * @brief Factory function creating the sliders store.
 * @returns An object containing subscribe and mutation methods.
 */
function createSlidersStore() {
    Logger.debug('Store', 'Initializing sliders store.');
    let initial: Record<string, Slider> = {
        'a': { name: 'a', value: 2, min: -10, max: 10, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 },
        'b': { name: 'b', value: 1, min: -10, max: 10, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
    };
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('vectoria_sliders');
        if (saved) {
            try {
                initial = JSON.parse(saved);
            } catch (e) {}
        }
    }
    const { subscribe, update, set } = writable<Record<string, Slider>>(initial);

    return {
        subscribe,
        set,
        /**
         * @brief Synchronizes sliders with active variables.
         * @param names Array of required variable names.
         */
        syncVars: (names: string[]) => update(current => {
            let changed = false;
            const next: Record<string, Slider> = {};
            const nameSet = new Set(names);
            
            // Keep existing sliders that are still needed
            for (const key in current) {
                if (nameSet.has(key)) {
                    next[key] = current[key];
                } else {
                    Logger.info('Store', `Removing unused slider for variable: ${key}`);
                    changed = true;
                }
            }
            // Add new sliders
            for (const name of names) {
                if (!next[name]) {
                    Logger.info('Store', `Dynamically creating slider for variable: ${name}`);
                    next[name] = { name, value: 1, min: -10, max: 10, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 };
                    changed = true;
                }
            }
            return changed ? next : current;
        }),
        /**
         * @brief Updates the scalar value of a specific slider.
         * @param name The slider variable name.
         * @param value The new value.
         */
        updateValue: (name: string, value: number) => update(current => {
            if (current[name]) {
                return { ...current, [name]: { ...current[name], value } };
            }
            return current;
        }),
        /**
         * @brief Toggles animation state for a slider.
         */
        togglePlay: (name: string) => update(current => {
            if (current[name]) {
                return { ...current, [name]: { ...current[name], isPlaying: !current[name].isPlaying } };
            }
            return current;
        }),
        /**
         * @brief Updates animation step logic for active sliders.
         */
        tickAnimations: (deltaTime: number) => update(current => {
            let changed = false;
            const next = { ...current };
            for (const key in next) {
                const s = next[key];
                if (s.isPlaying) {
                    const range = s.max - s.min;
                    const delta = (range * 0.2 * (s.animSpeed || 1) * deltaTime) * (s.animDir || 1);
                    let newVal = s.value + delta;
                    let newDir = s.animDir || 1;
                    if (newVal > s.max) {
                        newVal = s.max - (newVal - s.max);
                        newDir = -1;
                    } else if (newVal < s.min) {
                        newVal = s.min + (s.min - newVal);
                        newDir = 1;
                    }
                    next[key] = { ...s, value: newVal, animDir: newDir as 1|-1 };
                    changed = true;
                }
            }
            return changed ? next : current;
        })
    };
}

/**
 * @brief Factory function creating the folders store.
 * @returns An object containing subscribe, set, and mutation methods for folders.
 */
function createFoldersStore() {
    Logger.debug('Store', 'Initializing folders store.');
    let initial: Folder[] = [];
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('vectoria_folders');
        if (saved) {
            try {
                initial = JSON.parse(saved);
            } catch (e) {}
        }
    }
    const { subscribe, set, update } = writable<Folder[]>(initial);

    const colors = ['#64748b', '#78716c', '#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
    let colorIndex = 0;

    return {
        subscribe,
        addFolder: (title: string = 'New Folder') => {
            Logger.info('Store', `Adding new folder: ${title}`);
            update(folders => {
                const color = colors[colorIndex % colors.length];
                colorIndex++;
                return [...folders, { id: crypto.randomUUID(), title, collapsed: false, color }];
            });
        },
        removeFolder: (id: string) => update(folders => {
            Logger.info('Store', `Removing folder ID: ${id}`);
            return folders.filter(f => f.id !== id);
        }),
        toggleCollapse: (id: string) => update(folders => {
            return folders.map(f => f.id === id ? { ...f, collapsed: !f.collapsed } : f);
        }),
        updateTitle: (id: string, title: string) => update(folders => {
            return folders.map(f => f.id === id ? { ...f, title } : f);
        }),
        set
    };
}

export const expressions = createExpressionsStore();
export const sliders = createSlidersStore();
export const folders = createFoldersStore();
export const selectedExpressionId = writable<string | null>(null);
let initialCamera = { x: 0, y: 0, zoom: 50 };
if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vectoria_camera');
    if (saved) {
        try {
            initialCamera = JSON.parse(saved);
        } catch (e) {}
    }
}
export const camera = writable<CameraState>(initialCamera);
export const tickerActive = writable<boolean>(false);

// Debounced Auto-saving logic
function debounce(fn: (...args: any[]) => void, delay: number) {
    let timer: any;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

const saveState = debounce(() => {
    try {
        let currentExprs: any[] = [];
        expressions.subscribe(val => currentExprs = val)();
        localStorage.setItem('vectoria_expressions', JSON.stringify(currentExprs));

        let currentSliders: any = {};
        sliders.subscribe(val => currentSliders = val)();
        localStorage.setItem('vectoria_sliders', JSON.stringify(currentSliders));

        let currentCamera: any = {};
        camera.subscribe(val => currentCamera = val)();
        localStorage.setItem('vectoria_camera', JSON.stringify(currentCamera));

        let currentFolders: any[] = [];
        folders.subscribe(val => currentFolders = val)();
        localStorage.setItem('vectoria_folders', JSON.stringify(currentFolders));
        
        Logger.debug('Store', 'Workspace auto-saved to localStorage.');
    } catch (e: any) {
        Logger.error('Store', `Auto-save failed: ${e.message}`);
    }
}, 500);

if (typeof window !== 'undefined') {
    expressions.subscribe(() => saveState());
    sliders.subscribe(() => saveState());
    camera.subscribe(() => saveState());
    folders.subscribe(() => saveState());
}
