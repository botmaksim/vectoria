<script lang="ts">
    /**
     * @file App.svelte
     * @brief Main application entry point and root layout.
     * @details Mounts the Sidebar, GraphCanvas, and Toolbar. Handles URL routing for loading shared graph states upon application startup.
     */

    import { onMount } from 'svelte';
    import Sidebar from './components/Sidebar/Sidebar.svelte';
    import GraphCanvas from './components/Canvas/GraphCanvas.svelte';
    import Toolbar from './components/Toolbar.svelte';
    import ToolsPanel from './components/Sidebar/ToolsPanel.svelte';
    import GalleryModal from './components/Modals/GalleryModal.svelte';
    import { theme } from './state/theme';
    import { showGallery } from './state/gallery';
    import './app.css';

    import { Logger } from './utils/logger';

    onMount(async () => {
        Logger.info('App', 'Application mounting sequence initiated.');
        theme.init();

        if (!localStorage.getItem('vectoria_hasSeenGallery')) {
            showGallery.set(true);
            localStorage.setItem('vectoria_hasSeenGallery', 'true');
        }
    });

    import { parseCSV } from './utils/csvParser';
    import { expressions } from './state/store';

    let isDragging = false;

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer?.types.includes('Files')) {
            isDragging = true;
        }
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = false;
    }

    async function handleDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = false;
        
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.csv') || file.type === 'text/csv') {
                const text = await file.text();
                const points = parseCSV(text);
                if (points.length > 0) {
                    expressions.addTableWithData(points);
                }
            }
        }
    }
</script>

<main on:dragover={handleDragOver} on:dragleave={handleDragLeave} on:drop={handleDrop}>
    <Sidebar />
    <GraphCanvas />
    <ToolsPanel />
    <Toolbar />
    <GalleryModal />
    
    {#if isDragging}
    <div class="drag-overlay">
        <h2>Drop CSV File Here 📊</h2>
    </div>
    {/if}
</main>

<style>
    main {
        display: flex;
        flex-direction: row;
        height: 100vh;
        width: 100vw;
        overflow: hidden;
        position: relative;
    }
    
    .drag-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(var(--bg-canvas), 0.8);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 4px dashed var(--accent-color);
        pointer-events: none;
    }
    
    .drag-overlay h2 {
        font-size: 2.5rem;
        color: var(--text-primary);
        pointer-events: none;
    }
</style>
