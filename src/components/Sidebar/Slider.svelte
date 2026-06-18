<script lang="ts">
    /**
     * @file Slider.svelte
     * @brief UI component for manipulating scalar variable values.
     */

    import { sliders } from '../../state/store';
    import { Logger } from '../../utils/logger';
    
    export let name: string;
    
    $: slider = $sliders[name];
    let expanded = false;

    function handleChange(e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        sliders.updateValue(name, val);
    }

    function togglePlay() {
        sliders.togglePlay(name);
    }
    
    function updateLimit(field: 'min' | 'max' | 'step' | 'animSpeed', e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (isNaN(val)) return;
        const s = { ...slider, [field]: val };
        sliders.updateLimits(name, s.min, s.max, s.step, s.animSpeed || 1);
    }
</script>

<div class="slider-row">
    <div class="slider-info">
        <div class="left-group">
            <button class="icon-btn play-btn" on:click={togglePlay} title="Play/Pause Animation">
                {#if slider.isPlaying}⏸{:else}▶{/if}
            </button>
            <span class="name">{name}</span>
        </div>
        <div class="right-group">
            <span class="value">{slider.value.toFixed(1)}</span>
            <button class="icon-btn settings-btn" on:click={() => expanded = !expanded} title="Settings">⚙</button>
        </div>
    </div>
    <input 
        type="range" 
        min={slider.min} 
        max={slider.max} 
        step={slider.step} 
        value={slider.value}
        on:input={handleChange}
        aria-label={`Adjust variable ${name}`}
    />
    {#if expanded}
    <div class="slider-settings">
        <label>Min <input type="number" value={slider.min} on:change={(e) => updateLimit('min', e)} /></label>
        <label>Max <input type="number" value={slider.max} on:change={(e) => updateLimit('max', e)} /></label>
        <label>Step <input type="number" value={slider.step} on:change={(e) => updateLimit('step', e)} /></label>
        <label>Speed <input type="number" value={slider.animSpeed || 1} on:change={(e) => updateLimit('animSpeed', e)} step="0.1" /></label>
    </div>
    {/if}
</div>

<style>
    .slider-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
        padding: 8px 12px;
        background-color: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        transition: border-color 0.2s, box-shadow 0.2s, background-color 0.3s ease;
    }
    .slider-row:hover {
        border-color: var(--text-secondary);
    }
    .slider-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.95rem;
    }
    .left-group, .right-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .icon-btn {
        background: transparent;
        border: none;
        color: var(--accent-color);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        transition: background-color 0.2s;
    }
    .icon-btn:hover {
        background: var(--bg-surface-hover);
    }
    .name {
        font-family: monospace;
        font-weight: bold;
        color: var(--accent-color);
        background: color-mix(in srgb, var(--accent-color) 15%, transparent);
        padding: 2px 6px;
        border-radius: 4px;
    }
    .value {
        color: var(--text-secondary);
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
    }
    input[type=range] {
        width: 100%;
        accent-color: var(--accent-color);
        cursor: ew-resize;
    }
    .slider-settings {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--border-color);
    }
    .slider-settings label {
        display: flex;
        flex-direction: column;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    .slider-settings input {
        background: var(--bg-body);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 4px;
        font-size: 0.85rem;
        color: var(--text-primary);
        margin-top: 2px;
    }
</style>
