<script lang="ts">
    /**
     * @file ToolsPanel.svelte
     * @brief Right-side toolbar for geometry and canvas interaction tools.
     * @details Provides a collapsible panel for switching between point, segment, polygon, and analysis modes.
     */
    import { t } from '../../state/i18n';
    import { activeTool } from '../../state/tools';
    
    let isCollapsed = false;
</script>

<div class="tools-panel" class:collapsed={isCollapsed}>
    <div class="panel-header">
        <span class="title">{$t('tools') || 'Tools'}</span>
        <button class="toggle-btn" on:click={() => isCollapsed = !isCollapsed}>
            {#if isCollapsed}◀{:else}▶{/if}
        </button>
    </div>
    
    {#if !isCollapsed}
    <div class="tools-grid">
        <button class:active={$activeTool === 'move'} on:click={() => activeTool.setMode('move')} title="Move (Pan/Zoom)"><span class="icon">👆</span><span class="label">Move</span></button>
        <button class:active={$activeTool === 'point'} on:click={() => activeTool.setMode('point')} title="Point"><span class="icon">📍</span><span class="label">Point</span></button>
        <button class:active={$activeTool === 'intersect'} on:click={() => activeTool.setMode('intersect')} title="Intersection"><span class="icon">✖</span><span class="label">Intersect</span></button>
        <button class:active={$activeTool === 'segment'} on:click={() => activeTool.setMode('segment')} title="Segment"><span class="icon">📏</span><span class="label">Segment</span></button>
        <button class:active={$activeTool === 'line'} on:click={() => activeTool.setMode('line')} title="Line"><span class="icon">➖</span><span class="label">Line</span></button>
        <button class:active={$activeTool === 'polygon'} on:click={() => activeTool.setMode('polygon')} title="Polygon"><span class="icon">🔺</span><span class="label">Polygon</span></button>
        <button class:active={$activeTool === 'circle'} on:click={() => activeTool.setMode('circle')} title="Circle"><span class="icon">⭕</span><span class="label">Circle</span></button>
        <button class:active={$activeTool === 'circle3pts'} on:click={() => activeTool.setMode('circle3pts')} title="Circle (3 Points)"><span class="icon">⨀</span><span class="label">Circle(3pt)</span></button>
        <button class:active={$activeTool === 'midpoint'} on:click={() => activeTool.setMode('midpoint')} title="Midpoint"><span class="icon">⨁</span><span class="label">Midpoint</span></button>
        <button class:active={$activeTool === 'perpBisector'} on:click={() => activeTool.setMode('perpBisector')} title="Perpendicular Bisector"><span class="icon">⟂</span><span class="label">Perp. Bisect</span></button>
        <button class:active={$activeTool === 'perpendicular'} on:click={() => activeTool.setMode('perpendicular')} title="Perpendicular Line (Click Point, then Line)"><span class="icon">⊾</span><span class="label">Perpendicular</span></button>
        <button class:active={$activeTool === 'angleBisector'} on:click={() => activeTool.setMode('angleBisector')} title="Angle Bisector (Click 3 pts or 2 lines)"><span class="icon">⦜</span><span class="label">Ang. Bisect</span></button>
        <button class:active={$activeTool === 'tangent'} on:click={() => activeTool.setMode('tangent')} title="Tangent"><span class="icon">↗</span><span class="label">Tangent</span></button>
        <button class:active={$activeTool === 'ode'} on:click={() => activeTool.setMode('ode')} title="ODE Phase Spawner"><span class="icon">🪢</span><span class="label">ODE</span></button>
        <button class:active={$activeTool === 'delete'} on:click={() => activeTool.setMode('delete')} title="Delete Element"><span class="icon">🗑️</span><span class="label">Delete</span></button>
    </div>
    {/if}
</div>

<style>
    .tools-panel {
        display: flex;
        flex-direction: column;
        width: 140px;
        background-color: var(--bg-surface);
        border-left: 1px solid var(--border-color);
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        z-index: 10;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.05);
    }
    .tools-panel.collapsed {
        width: 40px;
    }
    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid var(--border-color);
    }
    .title {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-secondary);
        white-space: nowrap;
        opacity: 1;
        transition: opacity 0.2s;
    }
    .collapsed .title {
        opacity: 0;
        display: none;
    }
    .toggle-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        flex-shrink: 0;
    }
    .toggle-btn:hover {
        background-color: var(--bg-surface-hover);
        color: var(--text-primary);
    }
    .tools-grid {
        display: flex;
        flex-direction: column;
        padding: 8px;
        gap: 8px;
        align-items: flex-start;
        overflow-y: auto;
    }
    .tools-grid button {
        width: 100%;
        height: 36px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-primary);
        font-size: 0.9rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        transition: all 0.2s;
        padding: 0 8px;
        gap: 8px;
        white-space: nowrap;
        overflow: hidden;
    }
    .collapsed .tools-grid button {
        padding: 0;
        justify-content: center;
        width: 24px;
        height: 24px;
        font-size: 1.1rem;
    }
    .collapsed .tools-grid button .label {
        display: none;
    }
    .tools-grid button .icon {
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
    }
    .tools-grid button:hover {
        background-color: var(--bg-surface-hover);
        border-color: var(--border-color);
    }
    .tools-grid button.active {
        background-color: color-mix(in srgb, var(--accent-color) 20%, transparent);
        border-color: var(--accent-color);
        color: var(--accent-color);
    }
</style>
