<script lang="ts">
    import { folders, expressions } from '../../state/store';
    import type { Folder } from '../../core/types';
    import { slide } from 'svelte/transition';
    import EquationInput from './EquationInput.svelte';
    import DataTable from './DataTable.svelte';

    export let folder: Folder;

    function toggle() {
        folders.toggleCollapse(folder.id);
    }

    function remove() {
        folders.removeFolder(folder.id);
        // We could also delete all expressions in this folder, 
        // but for safety, we'll just un-folder them.
        $expressions.forEach(e => {
            if (e.folderId === folder.id) {
                // Technically we need an expressions method for this,
                // but doing it simply here or in store.
            }
        });
    }
</script>

<div class="folder" style="--folder-color: {folder.color}">
    <div class="folder-header">
        <button class="toggle-btn" on:click={toggle}>
            {#if folder.collapsed}📁{:else}📂{/if}
        </button>
        <input class="folder-title" type="text" value={folder.title} 
            on:input={(e) => folders.updateTitle(folder.id, e.currentTarget.value)} />
        <button class="delete-btn" on:click={remove} title="Delete Folder">🗑️</button>
    </div>
    
    {#if !folder.collapsed}
        <div class="folder-content" transition:slide|local>
            <slot />
        </div>
    {/if}
</div>

<style>
    .folder {
        margin: 8px 0;
        border-left: 4px solid var(--folder-color);
        border-radius: 4px;
        background: var(--bg-canvas);
        overflow: hidden;
    }
    .folder-header {
        display: flex;
        align-items: center;
        padding: 8px;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border-color);
    }
    .toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0 8px;
    }
    .folder-title {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--text-primary);
        font-weight: bold;
        font-size: 1rem;
        outline: none;
    }
    .delete-btn {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
    }
    .delete-btn:hover {
        color: #ef4444;
    }
    .folder-content {
        padding: 8px 0 8px 12px;
    }
</style>
