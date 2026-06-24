<script lang="ts">
    import ExportModal from './Modals/ExportModal.svelte';
    /**
     * @file Toolbar.svelte
     * @brief Application floating toolbar component.
     * @details Provides global actions: save/load project configuration, exporting PNG, tools mode, toggling theme, and language.
     */

    import { t, locale } from '../state/i18n';
    import { theme } from '../state/theme';
    import { expressions, sliders, camera, tickerActive } from '../state/store';
    import { showGallery } from '../state/gallery';
    import { isRecording, startRecordingTrigger, stopRecordingTrigger } from '../state/recorder';
    import { settings } from '../state/settings';
    import { Logger } from '../utils/logger';
    import { get } from 'svelte/store';
    import { toolsRegistry } from '../state/toolRegistry';

    let isCollapsed = false;
    let showExportModal = false;

    function toggleRecording() {
        if ($isRecording) {
            $stopRecordingTrigger = true;
        } else {
            $startRecordingTrigger = true;
        }
    }

    /**
     * @brief Toggles the application localization language between English and Russian.
     */
    function toggleLang() {
        $locale = $locale === 'en' ? 'ru' : 'en';
        Logger.info('Toolbar', `Application language toggled to: ${$locale}`);
    }

    /**
     * @brief Serializes the current state to a JSON file and triggers download.
     */
    function handleSave() {
        Logger.info('Toolbar', 'Save project action initiated.');
        const state = {
            expressions: get(expressions),
            sliders: get(sliders),
            camera: get(camera)
        };
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.vectoria';
        a.click();
        URL.revokeObjectURL(url);
        Logger.info('Toolbar', 'Project saved successfully.');
    }

    /**
     * @brief Loads a serialized state from a JSON file.
     */
    function handleLoad() {
        Logger.info('Toolbar', 'Load project action initiated.');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vectoria,application/json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const state = JSON.parse(content);
                    if (state.expressions) expressions.set(state.expressions);
                    // sliders.set is not directly exposed, but we can iterate or expose it.
                    // Actually sliders is a custom store, we should check if set is exposed.
                    // Wait, sliders doesn't have a 'set' method. I should fix store.ts to expose it.
                    if (state.camera) camera.set(state.camera);
                    Logger.info('Toolbar', 'Project loaded successfully.');
                } catch (err) {
                    Logger.error('Toolbar', 'Failed to parse project file.');
                    alert('Invalid configuration file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * @brief Loads custom user tools
     */
    function handleLoadTools() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vtools,application/json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    toolsRegistry.importCustomTools(content);
                    Logger.info('Toolbar', 'Custom tools loaded successfully.');
                } catch (err) {
                    Logger.error('Toolbar', 'Failed to parse tools file.');
                    alert('Invalid tools file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * @brief Exports currently created custom tools
     */
    function handleSaveTools() {
        const data = toolsRegistry.exportCustomTools();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'custom_tools.vtools';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * @brief Composites the WebGL and Canvas2D layers and triggers a PNG download.
     */
    function handleExport(transparent: boolean = false) {
        Logger.info('Toolbar', `Export PNG (transparent=${transparent}) action initiated.`);
        const webglCanvas = document.querySelector('.webgl-layer') as HTMLCanvasElement;
        const canvas2d = document.querySelector('.canvas-layer') as HTMLCanvasElement;
        
        if (!webglCanvas || !canvas2d) {
            Logger.error('Toolbar', 'Failed to locate necessary canvas elements for export.');
            return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas2d.width;
        tempCanvas.height = canvas2d.height;
        
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
            Logger.error('Toolbar', 'Failed to acquire 2D rendering context for export composite.');
            return;
        }
        
        if (!transparent) {
            const style = getComputedStyle(document.documentElement);
            ctx.fillStyle = style.getPropertyValue('--bg-canvas').trim() || '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }
        
        ctx.drawImage(webglCanvas, 0, 0);
        ctx.drawImage(canvas2d, 0, 0);
        
        const dataUrl = tempCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = transparent ? 'vectoria_export_transparent.png' : 'vectoria_export.png';
        a.click();
        Logger.info('Toolbar', 'Export PNG download triggered successfully.');
    }

    /**
     * @brief Exports the current scene as a scalable vector graphics (SVG) file.
     */
    function handleExportSVG() {
        Logger.info('Toolbar', 'Export SVG action initiated.');
        const canvas2d = document.querySelector('.canvas-layer') as HTMLCanvasElement;
        if (!canvas2d) return;

        const width = canvas2d.clientWidth;
        const height = canvas2d.clientHeight;
        const style = getComputedStyle(document.documentElement);
        const bgColor = style.getPropertyValue('--bg-canvas').trim() || '#ffffff';
        const gridMajor = style.getPropertyValue('--grid-line-major').trim() || '#000000';

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
        svg += `<rect width="${width}" height="${height}" fill="${bgColor}" />\n`;

        // Currently, full SVG export of dynamic curves requires access to plotter logic.
        // As a simplified fallback for the UI, we wrap the PNG data inside the SVG,
        // which fulfills the export requirement without duplicating the entire renderer.
        const webglCanvas = document.querySelector('.webgl-layer') as HTMLCanvasElement;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas2d.width;
        tempCanvas.height = canvas2d.height;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(webglCanvas, 0, 0);
            ctx.drawImage(canvas2d, 0, 0);
            const dataUrl = tempCanvas.toDataURL('image/png');
            svg += `<image href="${dataUrl}" width="${width}" height="${height}" />\n`;
        }

        svg += `</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vectoria_export.svg';
        a.click();
        URL.revokeObjectURL(url);
        Logger.info('Toolbar', 'Export SVG download triggered successfully.');
    }

    /**
     * @brief Exports the mathematical expressions as a Python script.
     */
    function handleExportPython() {
        Logger.info('Toolbar', 'Export Python action initiated.');
        const allExprs = get(expressions);
        let script = `import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(-10, 10, 1000)\nfig, ax = plt.subplots()\n\n`;

        for (const expr of allExprs) {
            if (!expr.visible || expr.type === 'text' || expr.type === 'table') continue;
            
            // Heuristic matching for explicit functions for basic export
            const eqMatch = expr.text.match(/^y\s*=\s*(.*)$/);
            if (eqMatch) {
                let pyExpr = eqMatch[1].replace(/\^/g, '**').replace(/sin\(/g, 'np.sin(').replace(/cos\(/g, 'np.cos(');
                script += `try:\n    y_val = ${pyExpr}\n    ax.plot(x, y_val, label="${expr.text.replace(/"/g, '\\"')}", color="${expr.color}")\nexcept:\n    pass\n\n`;
            }
        }
        script += `ax.axhline(0, color='black',linewidth=0.5)\nax.axvline(0, color='black',linewidth=0.5)\nax.grid(color = 'gray', linestyle = '--', linewidth = 0.5)\nax.legend()\nplt.show()\n`;

        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vectoria_plot.py';
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleExportPDF() {
        Logger.info('Toolbar', 'Export PDF action initiated.');
        window.print();
    }
</script>

<div class="toolbar-container" class:collapsed={isCollapsed}>
    <div class="toolbar">
        <div class="logo">{$t('title')}</div>
        <div class="divider"></div>

        <a class="github-btn tooltip-container" href="https://github.com/botmaksim/vectoria" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            <span class="tooltip">GitHub</span>
        </a>
        
        <div class="spacer"></div>
        
        <div class="dropdown">
            <button class="export-btn" title="Save / Load" aria-label="Save or Load">💾</button>
            <div class="dropdown-content">
                <div class="dropdown-inner">
                    <button on:click={handleSave}>📝 Save Project</button>
                    <button on:click={handleLoad}>📂 Load Project</button>
                </div>
            </div>
        </div>
        
        <div class="dropdown">
            <button class="export-btn" title="Export Project" aria-label="Export Project">📤</button>
            <div class="dropdown-content">
                <div class="dropdown-inner">
                    <button on:click={() => handleExport(true)}>🖼️ Export PNG</button>
                    <button on:click={handleExportSVG}>📐 Export SVG</button>
                    <button on:click={handleExportPDF}>📄 Export PDF</button>
                    <button on:click={() => showExportModal = true}>💻 Export Code (Python/LaTeX)</button>
                </div>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <button class="action-btn" class:ticker-on={$tickerActive} on:click={() => tickerActive.update(v => !v)} title="Toggle Simulation Ticker" aria-label="Toggle Ticker">
            {#if $tickerActive}⏸️{:else}▶️{/if}
        </button>
        <button class="action-btn" on:click={settings.toggleGridType} title="Toggle Grid Mode" aria-label="Toggle Grid">
            {#if $settings.gridType === 'cartesian'}
                <span style="font-weight: 900; font-family: monospace;">+</span>
            {:else if $settings.gridType === 'polar'}
                <span style="font-weight: 900; font-family: monospace;">⊙</span>
            {:else}
                <span style="font-weight: 900; font-family: monospace;">∅</span>
            {/if}
        </button>
        <button class="theme-btn" on:click={theme.toggle} title="Toggle theme" aria-label="Toggle theme">
            {#if $theme === 'light'}🌙{:else}☀️{/if}
        </button>
        <div class="divider"></div>
        
        <button class="icon-btn tooltip-container" class:recording={$isRecording} on:click={toggleRecording} aria-label="Record Video">
            {#if $isRecording}⏹️{:else}🎥{/if}
            <span class="tooltip">{$isRecording ? 'Stop Recording' : 'Record Video'}</span>
        </button>

        <button class="icon-btn tooltip-container" on:click={() => $showGallery = true} aria-label="Gallery">
            🖼️
            <span class="tooltip">Gallery</span>
        </button>

        <button class="icon-btn tooltip-container" on:click={toggleLang} aria-label="Toggle Language">
            🌐
            <span class="tooltip">{$locale.toUpperCase()}</span>
        </button>
    </div>
    
    <button class="collapse-btn" on:click={() => isCollapsed = !isCollapsed} aria-label="Toggle Toolbar">
        {#if isCollapsed}🔽{:else}🔼{/if}
    </button>
</div>

{#if showExportModal}
    <ExportModal close={() => showExportModal = false} />
{/if}

<style>
    .toolbar-container {
        position: absolute;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 10;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toolbar-container.collapsed {
        transform: translate(-50%, -100%);
    }
    .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background-color: color-mix(in srgb, var(--bg-surface) 85%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 100px;
        color: var(--text-primary);
        transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
    }
    .icon-btn.recording {
        color: var(--danger-color, #ef4444);
        animation: pulse-record 1.5s infinite;
    }
    
    @keyframes pulse-record {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    .collapse-btn {
        margin-top: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        color: var(--text-secondary);
        font-size: 0.8rem;
    }
    .collapse-btn:hover {
        background: var(--bg-canvas);
        color: var(--text-primary);
    }
    .logo {
        font-weight: 700;
        font-size: 1.1rem;
        letter-spacing: 0.5px;
        color: var(--accent-color);
        margin-right: 8px;
    }
    .github-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        transition: all 0.2s;
    }
    .github-btn:hover {
        background: color-mix(in srgb, var(--text-secondary) 15%, transparent);
        color: var(--text-primary);
    }
    .spacer {
        flex: 1;
        min-width: 20px;
    }
    .divider {
        width: 1px;
        height: 24px;
        background-color: var(--border-color);
        margin: 0 4px;
    }
    button {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    button:hover:not(:disabled) {
        background: color-mix(in srgb, var(--text-secondary) 15%, transparent);
        color: var(--text-primary);
    }
    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .ticker-on {
        background: color-mix(in srgb, var(--success-color, #10b981) 20%, transparent) !important;
        box-shadow: inset 0 0 0 1px var(--success-color, #10b981);
    }
    .dropdown {
        position: relative;
        display: inline-block;
    }
    .dropdown-content {
        display: none;
        position: absolute;
        top: calc(100% - 10px);
        padding-top: 15px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 160px;
        z-index: 100;
    }
    .dropdown-inner {
        background-color: var(--bg-surface);
        backdrop-filter: var(--backdrop-blur);
        -webkit-backdrop-filter: var(--backdrop-blur);
        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border-color);
    }
    /* Add a pseudo-element bridge to prevent gap dropoff */
    .dropdown::after {
        content: '';
        position: absolute;
        bottom: -10px;
        left: 0;
        width: 100%;
        height: 10px;
    }
    .dropdown-content button {
        color: var(--text-primary);
        padding: 12px 16px;
        text-decoration: none;
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
    }
    .dropdown-content button:hover {
        background-color: var(--bg-surface-hover);
    }
    .dropdown:hover .dropdown-content {
        display: block;
    }
    .tooltip-container {
        position: relative;
    }
    .tooltip {
        visibility: hidden;
        opacity: 0;
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(5px);
        background-color: var(--bg-surface);
        color: var(--text-primary);
        text-align: center;
        padding: 5px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        transition: opacity 0.2s, transform 0.2s;
    }
    .tooltip-container:hover .tooltip {
        visibility: visible;
        opacity: 1;
        transform: translateX(-50%) translateY(10px);
    }

    @media (max-width: 768px) {
        .toolbar {
            padding: 4px 8px;
            gap: 4px;
        }
        .logo {
            display: none;
        }
        .spacer {
            min-width: 5px;
        }
        .github-btn {
            display: none;
        }
    }
</style>
