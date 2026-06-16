import { writable } from 'svelte/store';
import { Logger } from '../utils/logger';

export type GridType = 'cartesian' | 'polar';

export interface SettingsState {
    gridType: GridType;
    domainColoring: boolean;
}

function createSettingsStore() {
    const { subscribe, set, update } = writable<SettingsState>({
        gridType: 'cartesian',
        domainColoring: false
    });

    return {
        subscribe,
        toggleGrid: () => {
            update(state => {
                const newGrid = state.gridType === 'cartesian' ? 'polar' : 'cartesian';
                Logger.info('Settings', `Toggled grid type to: ${newGrid}`);
                return { ...state, gridType: newGrid };
            });
        },
        setGrid: (gridType: GridType) => {
            Logger.info('Settings', `Set grid type to: ${gridType}`);
            update(state => ({ ...state, gridType }));
        },
        toggleDomainColoring: () => {
            update(state => {
                const newMode = !state.domainColoring;
                Logger.info('Settings', `Toggled Domain Coloring to: ${newMode}`);
                return { ...state, domainColoring: newMode };
            });
        },
        set
    };
}

export const settings = createSettingsStore();
