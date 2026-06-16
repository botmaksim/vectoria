<script lang="ts">
    import EquationInput from './EquationInput.svelte';
    import DataTable from './DataTable.svelte';
    import FolderComponent from './Folder.svelte';
    import { expressions, folders } from '../../state/store';
    import { slide } from 'svelte/transition';
</script>

{#each $folders as folder (folder.id)}
    <div transition:slide|local>
        <FolderComponent folder={folder}>
            {#each $expressions.filter(e => e.folderId === folder.id) as expr (expr.id)}
                <div transition:slide|local>
                    {#if expr.type === 'table'}
                        <DataTable table={expr} />
                    {:else}
                        <EquationInput expression={expr} />
                    {/if}
                </div>
            {/each}
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button class="add-btn" style="flex: 1; padding: 4px; font-size: 0.8rem;" on:click={() => expressions.addExpression('', folder.id)}>+ Expr</button>
            </div>
        </FolderComponent>
    </div>
{/each}

{#each $expressions.filter(e => !e.folderId) as expr (expr.id)}
    <div transition:slide|local>
        {#if expr.type === 'table'}
            <DataTable table={expr} />
        {:else}
            <EquationInput expression={expr} />
        {/if}
    </div>
{/each}

<div class="actions-row">
    <button class="add-btn" on:click={() => expressions.addExpression()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Expression
    </button>
    <button class="add-btn" on:click={() => expressions.addTextExpression()}>
        📝 Text
    </button>
    <button class="add-btn" on:click={() => expressions.addTable()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
        Table
    </button>
    <button class="add-btn" on:click={() => folders.addFolder()}>
        📁 Folder
    </button>
</div>

<style>
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
    .actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
    }
    .actions-row .add-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: var(--bg-surface);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
    }
    .actions-row .add-btn:hover {
        background: var(--bg-surface-hover);
    }
</style>
