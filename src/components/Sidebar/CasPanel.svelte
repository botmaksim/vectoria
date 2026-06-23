<script lang="ts">
    /**
     * @file CasPanel.svelte
     * @brief Computer Algebra System UI component.
     * @details Provides a symbolic math solver interface leveraging Nerdamer. Supports simplification, expansion, differentiation, integration, and algebraic equation solving.
     */

    import { onMount } from 'svelte';
    import 'mathlive';
    // @ts-ignore
    import nerdamer from 'nerdamer';
    import 'nerdamer/Algebra.js';
    import 'nerdamer/Calculus.js';
    import 'nerdamer/Solve.js';
    import { Logger } from '../../utils/logger';
    import { expressions, sliders } from '../../state/store';
    import { get } from 'svelte/store';
    import { parse } from 'mathjs';
    import { substituteCustomFunctions, transformImplicitMultiplication } from '../../core/math/transformers';

    export let onClose: () => void;

    let inputMathField: any;
    let textInput = '';
    let resultLatex = '';
    let stepsLatex: string[] = [];
    let errorMessage = '';

    let mode: 'simplify' | 'solve' | 'derivative' | 'integrate' | 'expand' = 'simplify';

    onMount(() => {
        if (inputMathField) {
            inputMathField.addEventListener('input', () => {
                textInput = inputMathField.getValue('ascii-math');
                compute();
            });
        }
    });

    /**
     * @brief Changes the current CAS operation mode and recomputes the result.
     * @param m The selected operation mode.
     * @param m:string
     */
    function setMode(m: typeof mode) {
        Logger.info('CasPanel', `Operation mode switched to: ${m}`);
        mode = m;
        compute();
    }

    /**
     * @brief Evaluates the current input expression using Nerdamer based on the selected mode.
     */
    function compute() {
        if (!textInput.trim()) {
            resultLatex = '';
            stepsLatex = [];
            errorMessage = '';
            return;
        }

        try {
            let res = '';
            
            // Gather custom functions & custom names
            const customFunctions: Record<string, { param: string; body: string }> = {};
            const customNames = new Set<string>();
            const currentExprs = get(expressions);
            for (const expr of currentExprs) {
                const match = expr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_])\s*\)\s*=(.*)$/);
                if (match) {
                    customFunctions[match[1]] = { param: match[2], body: match[3].trim() };
                    customNames.add(match[1]);
                }
            }
            for (const expr of currentExprs) {
                const assignMatch = expr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
                if (assignMatch && !["y", "x", "r", "f(x)"].includes(assignMatch[1].trim())) {
                    customNames.add(assignMatch[1].trim());
                }
            }

            // Parse textInput to AST and substitute custom functions & implicit multiplication
            let node = parse(textInput);
            node = substituteCustomFunctions(node, customFunctions);
            node = transformImplicitMultiplication(node, customNames);

            // Substitute slider values as numeric constants
            const currentSliders = get(sliders);
            node = node.transform((n: any) => {
                if (n.isSymbolNode && currentSliders[n.name] !== undefined) {
                    const ConstantNode = parse('0').constructor as any;
                    return new ConstantNode(currentSliders[n.name].value);
                }
                return n;
            });

            let expression = node.toString();
            Logger.debug('CasPanel', `Computing ${mode} for preprocessed CAS expr: ${expression}`);
            
            stepsLatex = [];

            if (mode === 'simplify') {
                res = nerdamer(expression).toTeX();
            } else if (mode === 'expand') {
                res = nerdamer(`expand(${expression})`).toTeX();
            } else if (mode === 'derivative') {
                res = nerdamer(`diff(${expression}, x)`).toTeX();
            } else if (mode === 'integrate') {
                res = nerdamer(`integrate(${expression}, x)`).toTeX();
            } else if (mode === 'solve') {
                let eq = expression;
                if (!eq.includes('=')) {
                    eq = eq + '=0';
                }
                
                stepsLatex.push(`\\text{1. Original Equation: } ${nerdamer(eq).toTeX()}`);
                
                let expanded = nerdamer(`expand(${eq})`).toTeX();
                if (expanded !== nerdamer(eq).toTeX()) {
                    stepsLatex.push(`\\text{2. Expand: } ${expanded}`);
                }

                res = nerdamer(`solve(${eq}, x)`).toTeX();
                stepsLatex.push(`\\text{3. Solve for x: } x \\in \\{ ${res.replace(/\[|\]/g, '')} \\}`);
            }

            resultLatex = res;
            errorMessage = '';
            Logger.debug('CasPanel', 'Computation successful.');
        } catch (e: any) {
            Logger.warn('CasPanel', `Computation failed: ${e.message}`);
            errorMessage = e.message || 'Invalid syntax';
            resultLatex = '';
            stepsLatex = [];
        }
    }
</script>

<div class="cas-panel">
    <div class="cas-header">
        <h3>Computer Algebra System</h3>
        <button class="close-btn" on:click={onClose} aria-label="Close CAS Panel">✖</button>
    </div>

    <div class="mode-selector">
        <button class:active={mode === 'simplify'} on:click={() => setMode('simplify')} aria-label="Mode: Simplify">Simplify</button>
        <button class:active={mode === 'expand'} on:click={() => setMode('expand')} aria-label="Mode: Expand">Expand</button>
        <button class:active={mode === 'solve'} on:click={() => setMode('solve')} aria-label="Mode: Solve for x">Solve(x)</button>
        <button class:active={mode === 'derivative'} on:click={() => setMode('derivative')} aria-label="Mode: Derivative with respect to x">d/dx</button>
        <button class:active={mode === 'integrate'} on:click={() => setMode('integrate')} aria-label="Mode: Integrate with respect to x">∫ dx</button>
    </div>

    <div class="input-area">
        <!-- svelte-ignore a11y-unknown-element -->
        <math-field bind:this={inputMathField} class="math-input" placeholder="Type expression..."></math-field>
    </div>

    <div class="result-area" aria-live="polite">
        {#if errorMessage}
            <div class="error">{errorMessage}</div>
        {:else if resultLatex}
            <div class="result-label">Result:</div>
            
            {#if stepsLatex.length > 0}
                <div class="steps-container">
                    {#each stepsLatex as step}
                        <!-- svelte-ignore a11y-unknown-element -->
                        <math-field readonly class="math-step" value={step}></math-field>
                    {/each}
                </div>
            {/if}

            <!-- svelte-ignore a11y-unknown-element -->
            <math-field readonly class="math-result" value={resultLatex}></math-field>
        {:else}
            <div class="placeholder">Enter a mathematical expression above to see the result.</div>
        {/if}
    </div>
</div>

<style>
    .cas-panel {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .cas-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .cas-header h3 {
        margin: 0;
        font-size: 1rem;
        color: var(--accent-color);
        font-weight: 600;
    }
    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
    }
    .close-btn:hover {
        background: var(--border-color);
        color: var(--text-primary);
    }
    .mode-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        background: var(--bg-canvas);
        padding: 4px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }
    .mode-selector button {
        flex: 1 1 auto;
        background: transparent;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--text-secondary);
        transition: all 0.2s;
    }
    .mode-selector button:hover {
        background: var(--bg-surface);
        color: var(--text-primary);
    }
    .mode-selector button.active {
        background: var(--accent-color);
        color: white;
    }
    .math-input {
        width: 100%;
        font-size: 1.2rem;
        padding: 8px;
        background: var(--bg-canvas);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-primary);
        --keyboard-background: var(--bg-surface);
        --keyboard-toolbar-text: var(--text-primary);
    }
    .result-area {
        min-height: 60px;
        background: var(--bg-canvas);
        border: 1px dashed var(--border-color);
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
    .math-result {
        font-size: 1.4rem;
        background: transparent;
        border: none;
        color: var(--text-primary);
        pointer-events: none; /* readonly visual */
    }
    .steps-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px dashed var(--border-color);
    }
    .math-step {
        font-size: 1rem;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        pointer-events: none;
    }
    .result-label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        align-self: flex-start;
        margin-bottom: 8px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .error {
        color: #ef4444;
        font-size: 0.9rem;
    }
    .placeholder {
        color: var(--text-secondary);
        font-size: 0.9rem;
        text-align: center;
    }
</style>
