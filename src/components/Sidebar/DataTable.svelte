<script lang="ts">
    /**
     * @file DataTable.svelte
     * @brief UI component for tabular data entry.
     * @details Allows users to manually input discrete (x, y) coordinate pairs which are then plotted as points on the canvas. Automatically appends new empty rows as data is entered.
     */

    import type { Expression } from '../../core/types';
    import { expressions, selectedExpressionId } from '../../state/store';
    import StylePopover from './StylePopover.svelte';
    import { Logger } from '../../utils/logger';
    
    export let table: Expression;
    let showStylePopover = false;
    
    /**
     * @brief Handles updates to individual table cells.
     * @param index The row index.
     * @param col The column identifier ('x' or 'y').
     * @param value The new string value from the input field.
     */
    function updatePoint(index: number, col: 'x' | 'y', value: string) {
        const numValue = value.trim() === '' ? null : parseFloat(value);
        if (table.points) {
            Logger.debug('DataTable', `Updating point at index ${index}, column ${col} to ${numValue}`);
            const point = table.points[index];
            const newX = col === 'x' ? numValue : point.x;
            const newY = col === 'y' ? numValue : point.y;
            expressions.updateTablePoint(table.id, index, newX, newY);
        }
    }
    function addRegression(type: 'linear' | 'quadratic' | 'exponential') {
        const xArg = table.xCol;
        const yArg = table.yCol;
        if (type === 'linear') {
            expressions.addExpression(`${yArg} ~ m*${xArg} + b`);
        } else if (type === 'quadratic') {
            expressions.addExpression(`${yArg} ~ a*${xArg}^2 + b*${xArg} + c`);
        } else if (type === 'exponential') {
            expressions.addExpression(`${yArg} ~ a * exp(b*${xArg})`);
        }
    }

    function addDataGeometry(type: 'fourier' | 'voronoi' | 'delaunay') {
        const xArg = table.xCol;
        const yArg = table.yCol;
        if (type === 'fourier') {
            expressions.addExpression(`Fourier(${xArg}, ${yArg})`);
        } else if (type === 'voronoi') {
            expressions.addExpression(`Voronoi(${xArg}, ${yArg})`);
        } else if (type === 'delaunay') {
            expressions.addExpression(`Delaunay(${xArg}, ${yArg})`);
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="table-container" style="--table-color: {table.color}" class:selected={$selectedExpressionId === table.id} on:click={() => selectedExpressionId.set(table.id)}>
    <div class="table-header">
        <div class="col-header">{table.xCol}</div>
        <div class="col-header">
            <div class="color-indicator-container">
                <button class="color-dot" style="background-color: {table.color}" on:click={() => showStylePopover = !showStylePopover} aria-label="Style settings"></button>
                {#if showStylePopover}
                    <StylePopover expression={table} onClose={() => showStylePopover = false} />
                {/if}
            </div>
            {table.yCol}
        </div>
    </div>
    
    <div class="table-body">
        {#each table.points || [] as point, i}
            <div class="table-row">
                <input 
                    type="number" 
                    value={point.x === null ? '' : point.x} 
                    on:input={(e) => updatePoint(i, 'x', e.currentTarget.value)}
                    aria-label={`X coordinate for point ${i+1}`}
                />
                <input 
                    type="number" 
                    value={point.y === null ? '' : point.y} 
                    on:input={(e) => updatePoint(i, 'y', e.currentTarget.value)}
                    aria-label={`Y coordinate for point ${i+1}`}
                />
            </div>
        {/each}
    </div>
    <div class="table-footer-actions">
        <button on:click={() => addRegression('linear')}>Fit Line</button>
        <button on:click={() => addRegression('quadratic')}>Fit Quad</button>
        <button on:click={() => addRegression('exponential')}>Fit Exp</button>
    </div>
    <div class="table-footer-actions">
        <button on:click={() => addDataGeometry('fourier')}>Fourier</button>
        <button on:click={() => addDataGeometry('voronoi')}>Voronoi</button>
        <button on:click={() => addDataGeometry('delaunay')}>Delaunay</button>
    </div>
</div>

<style>
    .table-footer-actions {
        display: flex;
        gap: 4px;
        padding: 8px;
        background: var(--bg-surface-hover);
        border-top: 1px solid var(--border-light);
    }
    .table-footer-actions button {
        flex: 1;
        font-size: 11px;
        padding: 4px;
        background: transparent;
        border: 1px solid var(--border-light);
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-primary);
    }
    .table-footer-actions button:hover {
        background: var(--bg-canvas);
    }
    .table-container {
        border: 1px solid var(--border-light);
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
        background: var(--bg-surface);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .table-container.selected {
        border-color: var(--accent-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .table-header {
        display: flex;
        background: var(--bg-surface-hover);
        border-bottom: 1px solid var(--border-light);
    }
    
    .col-header {
        flex: 1;
        padding: 8px;
        text-align: center;
        font-family: 'Computer Modern', serif;
        font-size: 16px;
        font-style: italic;
        border-right: 1px solid var(--border-light);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }
    .col-header:last-child {
        border-right: none;
    }
    
    .color-indicator-container {
        position: relative;
        display: flex;
        align-items: center;
    }
    .color-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: inline-block;
        border: 2px solid rgba(0,0,0,0.1);
        cursor: pointer;
        padding: 0;
        transition: transform 0.1s;
    }
    .color-dot:hover {
        transform: scale(1.1);
    }
    
    .table-body {
        max-height: 200px;
        overflow-y: auto;
    }
    
    .table-row {
        display: flex;
        border-bottom: 1px solid var(--border-light);
    }
    .table-row:last-child {
        border-bottom: none;
    }
    
    .table-row input {
        flex: 1;
        width: 50%;
        border: none;
        padding: 8px;
        text-align: center;
        font-family: inherit;
        background: transparent;
        color: var(--text-primary);
        outline: none;
    }
    .table-row input:first-child {
        border-right: 1px solid var(--border-light);
    }
    .table-row input:focus {
        background: var(--bg-surface-hover);
    }
</style>
