/**
 * @file tools.ts
 * @brief State management for interactive geometric tools.
 * @details Manages the currently selected interaction mode (e.g., move, point, segment).
 */

import { writable } from 'svelte/store';
import { Logger } from '../utils/logger';

export type ToolMode = 'move' | 'point' | 'segment' | 'line' | 'polygon' | 'circle' | 'perpBisector' | 'perpendicular' | 'angleBisector' | 'tangent' | 'intersect' | 'delete' | 'ode' | 'midpoint' | 'circle3pts' | 'parallel' | 'conic';

export const odeSpawners = writable<{x: number, y: number}[]>([]);

function createToolStore() {
    const { subscribe, set } = writable<ToolMode>('move');

    return {
        subscribe,
        setMode: (mode: ToolMode) => {
            Logger.info('Tools', `Active tool changed to: ${mode}`);
            set(mode);
        }
    };
}

export const activeTool = createToolStore();
