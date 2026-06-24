<script lang="ts">
    /**
     * @file Sidebar.svelte
     * @brief Main sidebar layout containing math inputs, tables, sliders, and CAS.
     * @details Orchestrates the left-hand panel, handling the addition of new expressions and binding to the global stores.
     */

    import CasPanel from './CasPanel.svelte';
    import TutorialModal from '../Modals/TutorialModal.svelte';
    import ExpressionList from './ExpressionList.svelte';
    import VariableList from './VariableList.svelte';
    
    import { slide } from 'svelte/transition';
    import { Logger } from '../../utils/logger';

    let showCas = false;
    let showTutorial = false;

    let width = 340;
    let isResizing = false;

    function startResize(e: MouseEvent) {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        
        function onMouseMove(e: MouseEvent) {
            if (!isResizing) return;
            width = Math.max(250, Math.min(e.clientX, 800));
        }
        
        function onMouseUp() {
            isResizing = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    /**
     * @brief Toggles the visibility of the CAS panel.
     */
    function toggleCas() {
        showCas = !showCas;
        Logger.info('Sidebar', `CAS panel visibility toggled to: ${showCas}`);
    }
</script>

<aside class="sidebar" style="width: {width}px">
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
    <div class="resizer" on:mousedown={startResize} role="separator" aria-orientation="vertical" tabindex="0"></div>
    <div class="header">
        <h2>Vectoria</h2>
        <div class="header-actions">
            <button on:click={toggleCas} class="add-btn cas-btn" title="Computer Algebra System">
                {showCas ? 'Hide CAS' : 'Open CAS'}
            </button>
            <button on:click={() => showTutorial = true} class="add-btn cas-btn help-btn" title="Tutorial / Help">
                ❓
            </button>
        </div>
    </div>
    
    <div class="expressions">
        {#if showCas}
            <div transition:slide|local>
                <CasPanel onClose={() => showCas = false} />
            </div>
        {/if}

        {#if showTutorial}
            <TutorialModal onClose={() => showTutorial = false} />
        {/if}

        <ExpressionList />
        <VariableList />
    </div>
</aside>

<style>
    .sidebar {
        background-color: var(--bg-sidebar);
        backdrop-filter: var(--backdrop-blur);
        -webkit-backdrop-filter: var(--backdrop-blur);
        color: var(--text-primary);
        height: 100%;
        display: flex;
        flex-direction: column;
        border-right: 1px solid var(--border-color);
        box-shadow: 2px 0 16px rgba(0,0,0,0.04);
        z-index: 5;
        transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        position: relative;
    }
    .resizer {
        position: absolute;
        top: 0;
        right: -3px;
        width: 6px;
        height: 100%;
        cursor: col-resize;
        z-index: 10;
    }
    .resizer:hover {
        background-color: color-mix(in srgb, var(--accent-color) 50%, transparent);
    }
    .header {
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border-color);
    }
    h2 {
        margin: 0;
        font-size: 1.3rem;
        color: var(--text-primary);
        font-weight: 600;
        letter-spacing: -0.3px;
    }
    .add-btn {
        background: var(--accent-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        transition: opacity 0.1s, transform 0.1s;
    }
    .add-btn:hover {
        opacity: 0.9;
    }
    .add-btn:active {
        transform: scale(0.97);
    }
    .cas-btn {
        background: var(--bg-surface-hover);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
    }
    .header-actions {
        display: flex;
        gap: 8px;
    }
    .help-btn {
        padding: 8px;
        font-size: 1.1rem;
    }
    .expressions {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
    }
    
    @media (max-width: 768px) {
        .sidebar {
            width: 100% !important;
            height: 45vh !important;
            border-right: none;
            border-top: 1px solid var(--border-color);
        }
        .resizer {
            display: none;
        }
    }
</style>
