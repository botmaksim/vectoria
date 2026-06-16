<script lang="ts">
    import { camera, expressions } from '../../state/store';
    import type { CompiledEquation, Camera } from '../../core/types';

    export let close: () => void;
    let exportMode: 'python' | 'tikz' = 'python';

    $: code = generateCode($expressions, $camera, exportMode);

    function generateCode(eqs: CompiledEquation[], cam: Camera, mode: string) {
        if (mode === 'python') {
            let py = `import numpy as np\nimport matplotlib.pyplot as plt\n\n`;
            py += `fig, ax = plt.subplots()\n`;
            py += `ax.set_xlim([${(cam.x - cam.zoom).toFixed(2)}, ${(cam.x + cam.zoom).toFixed(2)}])\n`;
            py += `ax.set_ylim([${(cam.y - cam.zoom).toFixed(2)}, ${(cam.y + cam.zoom).toFixed(2)}])\n`;
            
            for (let eq of eqs) {
                if (eq.text) {
                    py += `# Equation: ${eq.text}\n`;
                }
            }
            py += `plt.grid(True)\nplt.show()\n`;
            return py;
        } else {
            let tz = `\\begin{tikzpicture}\n`;
            tz += `\\draw[step=1cm,gray,very thin] (${(cam.x - cam.zoom).toFixed(2)},${(cam.y - cam.zoom).toFixed(2)}) grid (${(cam.x + cam.zoom).toFixed(2)},${(cam.y + cam.zoom).toFixed(2)});\n`;
            tz += `\\draw[thick,->] (${(cam.x - cam.zoom).toFixed(2)},0) -- (${(cam.x + cam.zoom).toFixed(2)},0) node[right] {$x$};\n`;
            tz += `\\draw[thick,->] (0,${(cam.y - cam.zoom).toFixed(2)}) -- (0,${(cam.y + cam.zoom).toFixed(2)}) node[above] {$y$};\n`;
            
            for (let eq of eqs) {
                if (eq.text) {
                    tz += `% ${eq.text}\n`;
                }
            }
            tz += `\\end{tikzpicture}\n`;
            return tz;
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click|self={close}>
    <div class="modal-content">
        <h2>Export Code</h2>
        
        <div class="tabs">
            <button class:active={exportMode === 'python'} on:click={() => exportMode = 'python'}>Python (Matplotlib)</button>
            <button class:active={exportMode === 'tikz'} on:click={() => exportMode = 'tikz'}>LaTeX (TikZ)</button>
        </div>

        <textarea readonly value={code}></textarea>

        <div class="actions">
            <button class="primary" on:click={() => { navigator.clipboard.writeText(code); }}>Copy to Clipboard</button>
            <button on:click={close}>Close</button>
        </div>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    .modal-content {
        background: var(--bg-surface);
        color: var(--text-primary);
        padding: 24px;
        border-radius: 12px;
        width: 600px;
        max-width: 90vw;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    .tabs {
        display: flex;
        gap: 8px;
    }
    .tabs button {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
    }
    .tabs button.active {
        background: color-mix(in srgb, var(--accent-color) 20%, transparent);
        color: var(--accent-color);
        border-color: var(--accent-color);
    }
    textarea {
        width: 100%;
        height: 300px;
        background: var(--bg-surface-hover);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 12px;
        font-family: var(--font-mono, monospace);
        resize: none;
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    .actions button {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
    }
    .actions button.primary {
        background: var(--accent-color);
        color: white;
        border: none;
    }
</style>
