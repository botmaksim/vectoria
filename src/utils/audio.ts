/**
 * @file audio.ts
 * @brief Audio sonification module for mathematical equations.
 * @details Translates explicit 2D mathematical functions into auditory signals (sweeps) by mapping the Y-coordinate to frequency and the X-coordinate to stereo panning over time.
 */

import { get } from 'svelte/store';
import { camera, sliders } from '../state/store';
import { compileExpression } from '../core/math/evaluator';
import { Logger } from './logger';

/** @brief Singleton AudioContext instance. */
let audioCtx: AudioContext | null = null;

const activeOscillators = new Map<string, { osc: OscillatorNode, gain: GainNode }>();

/**
 * @brief Activates or deactivates the Wavetable Synthesizer for a given parametric/explicit expression.
 * @param id Unique identifier of the expression.
 * @param exprText Mathematical expression string to evaluate.
 * @param scope Mathematical evaluation scope dictionary.
 * @return True if initialized and playing, False if halted.
 */
export function toggleOscillatorMode(id: string, exprText: string, scope: any): boolean {
    if (!audioCtx) audioCtx = new window.AudioContext();
    
    if (activeOscillators.has(id)) {
        const { osc, gain } = activeOscillators.get(id)!;
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        activeOscillators.delete(id);
        return false;
    } else {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        activeOscillators.set(id, { osc, gain });
        updateOscillatorWave(id, exprText, scope);
        
        osc.start();
        return true;
    }
}

/**
 * @brief Synthesizes a discrete FFT over a given expression computing spatial amplitude arrays into Web Audio PeriodicWaves.
 * @param id Valid oscillator stream ID globally active.
 * @param exprText Evaluated geometry string.
 * @param scope Dictionary mappings resolving unresolved variables globally for wave structural evaluation limits.
 */
export function updateOscillatorWave(id: string, exprText: string, scope: any) {
    if (!activeOscillators.has(id)) return;
    const { osc } = activeOscillators.get(id)!;
    
    const compiled = compileExpression(exprText);
    if (!compiled || compiled.type !== 'explicit' || !compiled.fnExplicit) return;
    
    const N = 512;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    
    const samples = new Float32Array(N);
    for(let i=0; i<N; i++) {
        let x = (Math.PI * 2 * i) / N;
        let y = compiled.fnExplicit(x, scope);
        if (isNaN(y) || !isFinite(y)) y = 0;
        samples[i] = y;
    }
    
    for(let k=1; k<N/2; k++) {
        let sumRe = 0;
        let sumIm = 0;
        for(let n=0; n<N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            sumRe += samples[n] * Math.cos(angle);
            sumIm += -samples[n] * Math.sin(angle);
        }
        real[k] = (2/N) * sumRe;
        imag[k] = (2/N) * -sumIm; 
    }
    
    if (audioCtx) {
        try {
            const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
            osc.setPeriodicWave(wave);
            
            const customFreq = scope.freq || scope.pitch;
            if (customFreq && customFreq > 0) {
                osc.frequency.setTargetAtTime(customFreq, audioCtx.currentTime, 0.1);
            } else {
                osc.frequency.setTargetAtTime(220, audioCtx.currentTime, 0.1);
            }
        } catch (e) {
            Logger.warn('Audio', 'Failed to update periodic wave.');
        }
    }
}

/**
 * @brief Synthesizes and plays an auditory representation of the mathematical expression.
 * @param exprText The raw mathematical expression string.
 */
export function playSonification(exprText: string): void {
    Logger.info('Audio', `Initiating sonification sequence for expression: ${exprText}`);

    if (!audioCtx) {
        Logger.debug('Audio', 'Initializing new AudioContext.');
        audioCtx = new window.AudioContext();
    }

    const compiled = compileExpression(exprText);
    if (!compiled || compiled.type !== 'explicit' || !compiled.fnExplicit) {
        Logger.warn('Audio', 'Expression is not suitable for sonification (must be an explicit function).');
        return;
    }

    const camState = get(camera);
    const mathWidth = 800 / camState.zoom;
    const mathHeight = 600 / camState.zoom;
    const minX = camState.x - mathWidth / 2;
    const maxX = camState.x + mathWidth / 2;
    const minY = camState.y - mathHeight / 2;
    const maxY = camState.y + mathHeight / 2;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';

    let panner: StereoPannerNode | undefined;
    if (audioCtx.createStereoPanner) {
        panner = audioCtx.createStereoPanner();
        osc.connect(panner);
        panner.connect(gain);
    } else {
        osc.connect(gain);
    }

    gain.connect(audioCtx.destination);

    const duration = 2; // 2 seconds sweep
    osc.start();

    const activeSliders = get(sliders);
    let scope: Record<string, number> = {};
    for (const [key, slider] of Object.entries(activeSliders)) {
        scope[key] = (slider as any).value;
    }

    const steps = 100;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const time = audioCtx.currentTime + t * duration;
        const x = minX + (maxX - minX) * t;
        
        const y = compiled.fnExplicit(x, scope);

        if (!isNaN(y)) {
            const normalizedY = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
            const freq = 200 + Math.pow(normalizedY, 1.5) * 800;
            
            osc.frequency.linearRampToValueAtTime(freq, time);
            gain.gain.linearRampToValueAtTime(0.1, time);
            
            if (panner) {
                panner.pan.linearRampToValueAtTime(-1 + 2 * t, time);
            }
        } else {
            gain.gain.linearRampToValueAtTime(0, time);
        }
    }

    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
    
    Logger.debug('Audio', 'Sonification sequence successfully queued.');
}
