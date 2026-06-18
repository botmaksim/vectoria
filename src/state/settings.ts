import { writable } from 'svelte/store';
import { Logger } from '../utils/logger';

export type GridType = 'cartesian' | 'polar' | 'none';

export interface SettingsState {
    theme: string;
    gridType: GridType;
}

function createSettingsStore() {
    const { subscribe, set, update } = writable<SettingsState>({
        theme: 'light',
        gridType: 'cartesian'
    });

    return {
        subscribe,
        toggleGridType: () => {
            update(state => {
                const types: ('cartesian' | 'polar' | 'none')[] = ['cartesian', 'polar', 'none'];
                const nextType = types[(types.indexOf(state.gridType) + 1) % types.length];
                Logger.debug('SettingsStore', `Toggled Grid Type: ${nextType}`);
                return { ...state, gridType: nextType };
            });
        },
        setGrid: (gridType: GridType) => {
            Logger.info('Settings', `Set grid type to: ${gridType}`);
            update(state => ({ ...state, gridType }));
        },
        set
    };
}

export const settings = createSettingsStore();
