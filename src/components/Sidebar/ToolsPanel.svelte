<script lang="ts">
    /**
     * @file ToolsPanel.svelte
     * @brief Right-side toolbar for geometry and canvas interaction tools.
     * @details Provides a collapsible panel for switching between point, segment, polygon, and analysis modes. Maps to toolRegistry geometries.
     */
    import { t } from '../../state/i18n';
    import { activeTool } from '../../state/tools';
    import type { ToolMode } from '../../state/tools';
    import { toolsRegistry } from '../../state/toolRegistry';
    
    let isCollapsed = false;
    let registeredTools = toolsRegistry.getGeometryTools();
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
        {#each $registeredTools as tool}
            <button class:active={$activeTool === tool.id} on:click={() => { 
                if (tool.action) tool.action(); 
                else activeTool.setMode(tool.id as ToolMode); 
            }} title={$t((tool.description || tool.label) as any)}>
                <span class="icon">{tool.icon}</span>
                <span class="label">{$t(tool.label as any) || tool.label}</span>
            </button>
        {/each}
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
    
    @media (max-width: 768px) {
        .tools-panel {
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            height: auto;
            max-height: 40vh;
            border-radius: 8px 0 0 8px;
            border: 1px solid var(--border-color);
            border-right: none;
        }
    }
</style>
