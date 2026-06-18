<script lang="ts">
    import { camera, expressions } from '../../state/store';
    import { generateCode } from '../../core/math/exportCompiler';

    export let close: () => void;
    let exportMode: 'python' | 'tikz' = 'python';
    let copied = false;
    
    let hideAxes = false;
    let transparentBg = false;

    $: code = generateCode($expressions, $camera, exportMode, { hideAxes, transparentBg });

    function copyToClipboard() {
        navigator.clipboard.writeText(code);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-overlay" on:click|self={close}>
    <div class="modal-content">
        <h2>Export Code</h2>
        
        <div class="controls-row">
            <div class="dropdown-wrapper">
                <label for="export-format">Format:</label>
                <select id="export-format" bind:value={exportMode}>
                    <option value="python">Python (Matplotlib)</option>
                    <option value="tikz">LaTeX (TikZ)</option>
                </select>
            </div>
            
            <div class="checkbox-group">
                <label class="checkbox-label">
                    <input type="checkbox" bind:checked={hideAxes} />
                    <span class="custom-checkbox"></span>
                    Hide Axes
                </label>
                <label class="checkbox-label">
                    <input type="checkbox" bind:checked={transparentBg} />
                    <span class="custom-checkbox"></span>
                    Transparent Background
                </label>
            </div>
        </div>

        <textarea readonly value={code}></textarea>

        <div class="actions">
            <button class="primary" on:click={copyToClipboard}>
                {copied ? 'Copied! ✓' : 'Copy to Clipboard'}
            </button>
            <button on:click={close}>Close</button>
        </div>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }
    .modal-content {
        background: var(--bg-surface);
        color: var(--text-primary);
        padding: 28px;
        border-radius: 16px;
        width: 720px;
        max-width: 90vw;
        display: flex;
        flex-direction: column;
        gap: 20px;
        border: 1px solid var(--border-color);
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.3);
    }
    h2 {
        margin: 0;
        font-weight: 700;
        font-size: 1.5rem;
    }
    .controls-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        flex-wrap: wrap;
        gap: 16px;
    }
    .dropdown-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .dropdown-wrapper label {
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 0.95rem;
    }
    select {
        appearance: none;
        background-color: var(--bg-surface-hover);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 10px 36px 10px 16px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        outline: none;
        transition: all 0.2s;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='gray' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
    }
    select:hover, select:focus {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent);
    }
    .checkbox-group {
        display: flex;
        gap: 20px;
    }
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 0.95rem;
        color: var(--text-primary);
        user-select: none;
    }
    .checkbox-label input {
        display: none;
    }
    .custom-checkbox {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        border: 2px solid var(--border-color);
        display: inline-block;
        position: relative;
        transition: all 0.2s;
    }
    .checkbox-label input:checked + .custom-checkbox {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
    }
    .checkbox-label input:checked + .custom-checkbox::after {
        content: '';
        position: absolute;
        left: 4px;
        top: 1px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }
    textarea {
        width: 100%;
        height: 360px;
        background: var(--bg-surface-hover);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 16px;
        font-family: var(--font-mono, monospace);
        font-size: 0.9rem;
        line-height: 1.45;
        resize: none;
        outline: none;
        transition: border-color 0.2s;
    }
    textarea:focus {
        border-color: var(--accent-color);
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    .actions button {
        padding: 10px 20px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-primary);
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s ease;
    }
    .actions button.primary {
        background: var(--accent-color);
        color: white;
        border: none;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    }
    .actions button.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }
    .actions button:hover:not(.primary) {
        background: var(--bg-surface-hover);
    }
</style>
