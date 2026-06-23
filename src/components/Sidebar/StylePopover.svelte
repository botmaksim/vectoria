<script lang="ts">
    /**
     * @file StylePopover.svelte
     * @brief UI component for configuring visual styles of mathematical expressions.
     * @details Provides a floating popover to adjust color, line width, line style, and point shapes. Updates are dispatched to the central store.
     */

    import { expressions } from '../../state/store';
    import type { Expression } from '../../core/types';
    import { Logger } from '../../utils/logger';
    import { onMount } from 'svelte';

    export let expression: Expression;
    export let onClose: () => void;
    /** Optional anchor element for fixed positioning */
    export let anchor: HTMLElement | null = null;

    let popoverEl: HTMLDivElement;
    let top = 0;
    let left = 0;

    onMount(() => {
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            top = rect.bottom + 8;
            left = rect.left;
            // Clamp horizontally so it doesn't overflow viewport
            const popoverWidth = 240;
            const viewportWidth = window.innerWidth;
            if (left + popoverWidth > viewportWidth - 8) {
                left = viewportWidth - popoverWidth - 8;
            }
        }
    });

    /**
     * @brief Handles color picker input events.
     * @param e DOM Event from color input.
     */
    function updateColor(e: Event) {
        const input = e.target as HTMLInputElement;
        Logger.debug('StylePopover', `Updating color to ${input.value} for expression ${expression.id}`);
        expressions.updateStyle(expression.id, { color: input.value });
    }

    /**
     * @brief Handles line width slider input events.
     * @param e DOM Event from range input.
     * @param e:Event
     */
    function updateLineWidth(e: Event) {
        const input = e.target as HTMLInputElement;
        const val = parseFloat(input.value);
        Logger.debug('StylePopover', `Updating line width to ${val} for expression ${expression.id}`);
        expressions.updateStyle(expression.id, { lineWidth: val });
    }

    /**
     * @brief Updates the stroke pattern for line rendering.
     * @param style The selected stroke pattern.
     * @param style:
     */
    function updateLineStyle(style: 'solid' | 'dashed' | 'dotted') {
        Logger.debug('StylePopover', `Updating line style to ${style} for expression ${expression.id}`);
        expressions.updateStyle(expression.id, { lineStyle: style });
    }

    /**
     * @brief Updates the geometric shape used for point rendering.
     * @param style The selected point shape.
     * @param style:
     */
    function updatePointStyle(style: 'circle' | 'cross' | 'diamond') {
        Logger.debug('StylePopover', `Updating point style to ${style} for expression ${expression.id}`);
        expressions.updateStyle(expression.id, { pointStyle: style });
    }

    $: lineWidth = expression.lineWidth ?? 2;
    $: lineStyle = expression.lineStyle ?? 'solid';
    $: pointStyle = expression.pointStyle ?? 'circle';
</script>

<div role="presentation" class="popover-overlay" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()}></div>
<div class="style-popover" bind:this={popoverEl} style={anchor ? `top:${top}px; left:${left}px;` : ''}>
    <div class="popover-header">
        <h4>Style Settings</h4>
    </div>
    
    <div class="setting-row">
        <label for="colorPicker">Color</label>
        <input type="color" id="colorPicker" value={expression.color} on:input={updateColor} />
    </div>

    <div class="setting-row">
        <label for="lineWidth">Line Width ({lineWidth}px)</label>
        <input type="range" id="lineWidth" min="1" max="10" step="0.5" value={lineWidth} on:input={updateLineWidth} />
    </div>

    <div class="setting-row">
        <span class="setting-label">Line Style</span>
        <div class="btn-group">
            <button class:active={lineStyle === 'solid'} on:click={() => updateLineStyle('solid')} aria-label="Solid line style">➖</button>
            <button class:active={lineStyle === 'dashed'} on:click={() => updateLineStyle('dashed')} aria-label="Dashed line style">╍</button>
            <button class:active={lineStyle === 'dotted'} on:click={() => updateLineStyle('dotted')} aria-label="Dotted line style">⋯</button>
        </div>
    </div>

    {#if expression.type === 'table' || expression.text.includes('Point') || expression.text.includes('(')}
    <div class="setting-row">
        <span class="setting-label">Point Style</span>
        <div class="btn-group">
            <button class:active={pointStyle === 'circle'} on:click={() => updatePointStyle('circle')} aria-label="Circle point style">●</button>
            <button class:active={pointStyle === 'cross'} on:click={() => updatePointStyle('cross')} aria-label="Cross point style">⨯</button>
            <button class:active={pointStyle === 'diamond'} on:click={() => updatePointStyle('diamond')} aria-label="Diamond point style">◆</button>
        </div>
    </div>
    {/if}
</div>

<style>
    .popover-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 99;
    }
    .style-popover {
        position: fixed;
        background: var(--bg-surface);
        backdrop-filter: var(--backdrop-blur);
        -webkit-backdrop-filter: var(--backdrop-blur);
        border: 1px solid var(--border-color);
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        border-radius: 12px;
        padding: 16px;
        width: 240px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    .popover-header h4 {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .setting-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .setting-row label, .setting-label {
        font-size: 0.85rem;
        color: var(--text-primary);
    }
    input[type="range"] {
        width: 100%;
        cursor: pointer;
    }
    input[type="color"] {
        width: 100%;
        height: 32px;
        padding: 0;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        cursor: pointer;
    }
    .btn-group {
        display: flex;
        background: var(--bg-canvas);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
    }
    .btn-group button {
        flex: 1;
        background: transparent;
        border: none;
        padding: 6px 0;
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.2s;
        border-right: 1px solid var(--border-color);
    }
    .btn-group button:last-child {
        border-right: none;
    }
    .btn-group button:hover {
        background: var(--bg-surface);
    }
    .btn-group button.active {
        background: var(--accent-color);
        color: white;
    }
</style>
