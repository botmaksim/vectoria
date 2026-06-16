<script lang="ts">
    /**
     * @file Slider.svelte
     * @brief UI component for manipulating scalar variable values.
     * @details Renders an HTML range input bound to a specific mathematical parameter in the global slider store.
     */

    import { sliders } from '../../state/store';
    import { Logger } from '../../utils/logger';
    
    export let name: string;
    
    $: slider = $sliders[name];

    /**
     * @brief Handles range input events and updates the scalar value in the store.
     * @param e DOM Event from the range input.
     */
    function handleChange(e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        Logger.debug('Slider', `Variable '${name}' updated to ${val}`);
        sliders.updateValue(name, val);
    }

    function togglePlay() {
        sliders.togglePlay(name);
    }
</script>

<div class="slider-row">
    <div class="slider-info">
        <div class="left-group">
            <button class="play-btn" on:click={togglePlay} title="Play/Pause Animation">
                {#if slider.isPlaying}
                    ⏸
                {:else}
                    ▶
                {/if}
            </button>
            <span class="name">{name}</span>
        </div>
        <span class="value">{slider.value.toFixed(1)}</span>
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
    .left-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .play-btn {
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
    .play-btn:hover {
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
</style>
