import { writable } from 'svelte/store';

export const isRecording = writable(false);
export const recordingReady = writable(false);
export const startRecordingTrigger = writable(false);
export const stopRecordingTrigger = writable(false);
