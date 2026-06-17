<script lang="ts">
    /**
     * @file EquationInput.svelte
     * @brief UI component representing a single mathematical expression input field.
     * @details Integrates the MathLive library for rich mathematical typography and parsing. Connects user input to the global expression store.
     */

    import { t } from '../../state/i18n';
    import type { Expression } from '../../core/types';
    import { expressions, sliders, selectedExpressionId } from '../../state/store';
    import { onMount } from 'svelte';
    import StylePopover from './StylePopover.svelte';
    import { Logger } from '../../utils/logger';
    import { get } from 'svelte/store';
    import { compileExpression } from '../../core/math/evaluator';
    import 'mathlive';

    export let expression: Expression;
    let mathFieldRef: any;
    let showStylePopover = false;

    let textRef: HTMLTextAreaElement;

    onMount(() => {
        if (expression.type !== 'text' && !expression.isText && mathFieldRef) {
            mathFieldRef.value = expression.latex;
            mathFieldRef.addEventListener('input', () => {
                const latex = mathFieldRef.value;
                const text = mathFieldRef.getValue('ascii-math');
                Logger.debug('EquationInput', `User modified expression ${expression.id}: ${text}`);
                expressions.updateText(expression.id, text, latex);
            });
        }
    });

    // Keep math-field value in sync with external expression updates (e.g. from state recovery or presets)
    $: if (mathFieldRef && expression && expression.latex !== undefined) {
        if (mathFieldRef.value !== expression.latex) {
            mathFieldRef.value = expression.latex;
        }
    }

    function handleTextInput(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        expressions.updateText(expression.id, val, val);
    }

    /**
     * @brief Executes an action expression (e.g. a -> a + 1).
     */
    function handlePlayAction() {
        const customFunctions: Record<string, { param: string; body: string }> = {};
        for (const expr of get(expressions)) {
            const match = expr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_])\)\s*=(.*)$/);
            if (match) {
                customFunctions[match[1]] = { param: match[2], body: match[3].trim() };
            }
        }

        const compiled = compileExpression(expression.text, customFunctions);
        if (compiled && compiled.actionExecute) {
            const activeSliders = get(sliders);
            const scope: Record<string, any> = {};
            for (const [key, s] of Object.entries(activeSliders)) scope[key] = s.value;
            const res = compiled.actionExecute(scope);
            if (res) {
                sliders.updateValue(res.target, res.value);
            }
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="equation-row" class:selected={$selectedExpressionId === expression.id} on:click={() => selectedExpressionId.set(expression.id)}>
    <div class="color-indicator-container">
        <button 
            class="color-indicator" 
            style="background-color: {expression.color}" 
            on:click={() => showStylePopover = !showStylePopover}
            aria-label="Open style settings"
        ></button>
        {#if showStylePopover}
            <StylePopover {expression} onClose={() => showStylePopover = false} />
        {/if}
    </div>
    
    {#if expression.type === 'text' || expression.isText}
        <textarea 
            bind:this={textRef} 
            class="text-input" 
            placeholder="Заметка (Markdown)..." 
            value={expression.text} 
            on:input={handleTextInput}
        ></textarea>
    {:else}
        <!-- svelte-ignore a11y-unknown-element -->
        <math-field bind:this={mathFieldRef} class="math-input" placeholder={$t('placeholder')}></math-field>
    {/if}

    {#if expression.text.includes('->')}
        <button on:click={handlePlayAction} class="icon-btn action-btn" aria-label="Execute Action" title="Выполнить действие">▶</button>
    {/if}

    <button on:click={() => expressions.toggleVisible(expression.id)} class="icon-btn" aria-label={expression.visible ? 'Hide expression' : 'Show expression'}>
        {expression.visible ? '👁' : '🚫'}
    </button>
    <button class="icon-btn delete" on:click={() => expressions.removeExpression(expression.id)} aria-label="Delete expression">✖</button>
</div>

{#if expression.regressionParams}
<div class="regression-stats">
    <div class="stat-header">Статистика</div>
    <div class="stat-row">
        <span>R² = {expression.regressionRSquared?.toFixed(4)}</span>
    </div>
    <div class="stat-header">Параметры</div>
    {#each Object.entries(expression.regressionParams) as [key, value]}
        <div class="stat-row">
            <span>{key} = {value.toFixed(4)}</span>
        </div>
    {/each}
</div>
{/if}

<style>
    .equation-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        background-color: var(--bg-surface);
        backdrop-filter: var(--backdrop-blur);
        -webkit-backdrop-filter: var(--backdrop-blur);
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        transition: border-color 0.2s, box-shadow 0.2s, background-color 0.3s ease;
    }
    .equation-row.selected {
        border-color: var(--accent-color);
        background-color: color-mix(in srgb, var(--accent-color) 6%, var(--bg-surface));
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .equation-row:focus-within {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent);
    }
    .color-indicator-container {
        position: relative;
    }
    .color-indicator {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.1);
        cursor: pointer;
        padding: 0;
        transition: transform 0.1s;
    }
    .color-indicator:hover {
        transform: scale(1.1);
    }
    .math-input {
        flex: 1;
        font-size: 1.1rem;
        background: transparent;
        color: var(--text-primary);
        border: none;
        padding: 4px;
        min-width: 0; /* flexbox fix */
        max-width: 100%;
        overflow-x: auto;
        /* mathlive styling */
        --hue: 210;
        --text-color: var(--text-primary);
        --keyboard-background: var(--bg-surface);
        --keyboard-toolbar-text: var(--text-primary);
        --smart-fence-color: var(--text-secondary);
    }
    .math-input:focus {
        outline: none;
    }
    .text-input {
        flex: 1;
        font-size: 1rem;
        background: transparent;
        color: var(--text-primary);
        border: none;
        padding: 4px;
        min-width: 0;
        max-width: 100%;
        resize: none;
        height: auto;
        min-height: 24px;
        font-family: inherit;
        line-height: 1.4;
    }
    .text-input:focus {
        outline: none;
    }
    .icon-btn {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.2s;
    }
    .icon-btn:hover {
        background: var(--bg-canvas);
        color: var(--text-primary);
    }
    .delete:hover {
        color: var(--danger-color);
        background: color-mix(in srgb, var(--danger-color) 10%, transparent);
    }
    .action-btn {
        color: var(--success-color, #10b981);
    }
    .action-btn:hover {
        color: #059669;
        background: color-mix(in srgb, #10b981 10%, transparent);
    }
    .regression-stats {
        margin-left: 36px;
        margin-top: -8px;
        margin-bottom: 12px;
        padding: 8px 12px;
        background: var(--bg-surface-hover);
        border-radius: 8px;
        font-family: 'Computer Modern', serif;
        font-size: 0.95rem;
        color: var(--text-secondary);
        border: 1px solid var(--border-light);
    }
    .stat-header {
        font-weight: 600;
        font-size: 0.85rem;
        margin-top: 4px;
        margin-bottom: 2px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .stat-row {
        margin-left: 8px;
        margin-bottom: 2px;
    }
</style>
