import { writable } from 'svelte/store';

export interface TimeState {
    t: number;
    isPlaying: boolean;
    speed: number;
    isLooping: boolean;
    maxT: number;
}

export const timeState = writable<TimeState>({
    t: 0,
    isPlaying: true,
    speed: 1.0,
    isLooping: false,
    maxT: 10
});
