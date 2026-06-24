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
    
    <div class="tools-grid" class:hidden={isCollapsed}>
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
        transition: opacity 0.2s;
    }
    .tools-grid.hidden {
        opacity: 0;
        pointer-events: none;
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
        .tools-panel, .tools-panel.collapsed {
            position: absolute !important;
            bottom: 45vh !important;
            left: 0 !important;
            width: 100% !important;
            height: 60px !important;
            max-height: none !important;
            flex-direction: row !important;
            border-radius: 0 !important;
            border-left: none !important;
            border-right: none !important;
            border-top: 1px solid var(--border-color) !important;
            border-bottom: 1px solid var(--border-color) !important;
            transform: none !important;
            box-shadow: 0 -4px 10px rgba(0,0,0,0.05) !important;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            z-index: 50 !important;
        }
        
        :global([data-theme="dark"]) .tools-panel, :global([data-theme="dark"]) .tools-panel.collapsed {
            background: rgba(31, 41, 55, 0.95) !important;
        }

        .tools-panel .panel-header {
            display: none !important;
        }

        .tools-panel .tools-grid, .tools-panel.collapsed .tools-grid {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            width: 100% !important;
            height: 100% !important;
            padding: 10px 12px !important;
            gap: 12px !important;
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            align-items: center !important;
            box-sizing: border-box !important;
        }
        
        .tools-panel .tools-grid::-webkit-scrollbar {
            display: none !important;
        }

        .tools-panel .tools-grid button, .tools-panel.collapsed .tools-grid button {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            width: max-content !important;
            min-width: max-content !important;
            height: 40px !important;
            padding: 0 16px !important;
            justify-content: center !important;
            border-radius: 20px !important;
            background-color: var(--bg-surface-hover) !important;
            flex: 0 0 auto !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
            border: 1px solid transparent !important;
            white-space: nowrap !important;
        }
        
        .tools-panel .tools-grid button.active, .tools-panel.collapsed .tools-grid button.active {
            box-shadow: 0 2px 8px color-mix(in srgb, var(--accent-color) 40%, transparent) !important;
            border-color: var(--accent-color) !important;
            background-color: color-mix(in srgb, var(--accent-color) 15%, transparent) !important;
        }

        .tools-panel .tools-grid button .label, .tools-panel.collapsed .tools-grid button .label {
            display: inline-block !important;
            font-size: 0.95rem !important;
            font-weight: 500 !important;
            margin-left: 8px !important;
            white-space: nowrap !important;
        }
        
        .tools-panel .tools-grid button .icon, .tools-panel.collapsed .tools-grid button .icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: auto !important;
            height: auto !important;
            margin-right: 0 !important;
            font-size: 1.2rem !important;
        }
    }
</style>
