<script lang="ts">
    /**
     * @file TutorialModal.svelte
     * @brief Explanatory modal providing a tutorial to the user.
     * @details Uses localized strings to guide users through the application's functionality.
     */

    import { t } from '../../state/i18n';
    import { fade, scale } from 'svelte/transition';

    export let onClose: () => void;

    let currentStep = 0;
    const steps = [
        { title: 'tutorial_eqs', icon: '📝' },
        { title: 'tutorial_vars', icon: '🎚️' },
        { title: 'tutorial_matrix', icon: '🌐' },
        { title: 'tutorial_data', icon: '📈' },
        { title: 'tutorial_tools', icon: '📐' },
        { title: 'tutorial_cas', icon: '🧮' },
        { title: 'tutorial_piecewise', icon: '🧩' },
        { title: 'tutorial_text', icon: '📋' },
        { title: 'tutorial_gallery', icon: '🖼️' },
        { title: 'tutorial_recording', icon: '🎥' }
    ];

    function nextStep() {
        if (currentStep < steps.length - 1) {
            currentStep++;
        } else {
            onClose();
        }
    }

    function prevStep() {
        if (currentStep > 0) currentStep--;
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={onClose}>
    <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }} on:click|stopPropagation>
        <h2>{$t('tutorial_title')}</h2>
        
        <div class="carousel">
            {#key currentStep}
            <div class="slide" in:fade={{duration: 200}}>
                <div class="icon">{steps[currentStep].icon}</div>
                <p class="description">{$t(steps[currentStep].title as any)}</p>
            </div>
            {/key}
        </div>

        <div class="progress">
            {#each steps as _, i}
                <div class="dot" class:active={i === currentStep}></div>
            {/each}
        </div>

        <div class="actions">
            <button class="text-btn" on:click={onClose}>{$t('tutorial_skip')}</button>
            <div class="nav-btns">
                {#if currentStep > 0}
                    <button class="secondary-btn" on:click={prevStep}>{$t('tutorial_prev')}</button>
                {/if}
                <button class="primary-btn" on:click={nextStep}>
                    {currentStep === steps.length - 1 ? $t('tutorial_finish') : $t('tutorial_next')}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    .modal-content {
        background: var(--bg-surface);
        color: var(--text-primary);
        padding: 32px;
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
    }
    h2 {
        margin-top: 0;
        color: var(--text-primary);
        text-align: center;
    }
    .carousel {
        min-height: 140px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 20px 0;
        text-align: center;
    }
    .slide {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
    }
    .icon {
        font-size: 3rem;
    }
    .description {
        font-size: 1.1rem;
        line-height: 1.6;
        color: var(--text-secondary);
        margin: 0;
    }
    .progress {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 32px;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--border-color);
        transition: background 0.3s, transform 0.3s;
    }
    .dot.active {
        background: var(--accent-color);
        transform: scale(1.3);
    }
    .actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .nav-btns {
        display: flex;
        gap: 12px;
    }
    button {
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    .text-btn {
        background: transparent;
        color: var(--text-secondary);
    }
    .text-btn:hover {
        color: var(--text-primary);
    }
    .secondary-btn {
        background: var(--bg-surface-hover);
        color: var(--text-primary);
    }
    .secondary-btn:hover {
        background: var(--border-color);
    }
    .primary-btn {
        background: var(--accent-color);
        color: white;
    }
    .primary-btn:hover {
        opacity: 0.9;
    }
</style>
