<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import { showGallery } from '../../state/gallery';
    import { PRESETS, type Preset } from '../../state/presets';
    import { expressions, camera, sliders } from '../../state/store';
    import { get } from 'svelte/store';
    import { Logger } from '../../utils/logger';
    import { physicsEngine } from '../../core/math/physicsEngine';

    function closeGallery() {
        $showGallery = false;
    }

    function loadPreset(preset: Preset) {
        Logger.info('Gallery', `Loading preset: ${preset.id}`);
        physicsEngine.reset();
        
        // Wipe existing state
        expressions.set([]);
        
        // Wait a tick to ensure clean state, then set
        setTimeout(() => {
            camera.set(preset.camera);
            
            // Add preset expressions
            const newExprs = preset.expressions.map((e, index) => ({
                id: crypto.randomUUID(),
                type: 'math',
                visible: true,
                ...e
            }));
            expressions.set(newExprs as any[]);

            if (preset.sliders) {
                sliders.set(preset.sliders);
            } else {
                sliders.set({});
            }

            closeGallery();
        }, 10);
    }
</script>

{#if $showGallery}
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={closeGallery}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" transition:scale={{ duration: 300, start: 0.95 }} on:click|stopPropagation>
        <button class="close-btn" on:click={closeGallery}>✖</button>
        
        <h2 class="gallery-title">Demo Gallery</h2>
        <p class="gallery-subtitle">Выбери пресет, чтобы загрузить его в свою рабочую среду</p>
        
        <div class="preset-grid">
            {#each PRESETS as preset}
            <button class="preset-card" on:click={() => loadPreset(preset)}>
                <div class="preset-info">
                    <h3>{preset.title}</h3>
                    <p>{preset.description}</p>
                </div>
            </button>
            {/each}
        </div>
    </div>
</div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-content {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        box-shadow: 0 24px 48px rgba(0,0,0,0.2);
        border-radius: 16px;
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 32px;
        position: relative;
    }

    .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        font-size: 1.2rem;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 8px;
        border-radius: 50%;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: var(--bg-canvas);
        color: var(--danger-color, #ef4444);
    }

    .gallery-title {
        font-family: 'Outfit', sans-serif;
        font-size: 2rem;
        margin-top: 0;
        margin-bottom: 8px;
        color: var(--text-primary);
        font-weight: 700;
        text-align: center;
    }

    .gallery-subtitle {
        text-align: center;
        color: var(--text-secondary);
        margin-bottom: 32px;
        font-size: 1.1rem;
    }

    .preset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 24px;
    }

    .preset-card {
        background: var(--bg-canvas);
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        border: 1px solid var(--border-color);
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
        text-align: left;
        padding: 0;
        display: block;
        width: 100%;
    }

    .preset-card:hover {
        transform: translateY(-8px) scale(1.02);
        box-shadow: 0 12px 24px rgba(0,0,0,0.15);
        border-color: var(--accent-color);
    }

    .preset-info {
        padding: 16px;
    }

    .preset-info h3 {
        margin: 0 0 8px 0;
        font-size: 1.1rem;
        color: var(--text-primary);
        font-weight: 600;
    }

    .preset-info p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.4;
    }
</style>
