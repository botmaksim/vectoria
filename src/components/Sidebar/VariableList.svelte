<script lang="ts">
    import Slider from './Slider.svelte';
    import { sliders } from '../../state/store';
    import { t } from '../../state/i18n';
</script>

{#if Object.keys($sliders).length > 0}
    <div class="sliders-header">{$t('variables')}</div>
    {#each Object.keys($sliders) as varName (varName)}
        <Slider name={varName} />
    {/each}
{/if}

<style>
    .sliders-header {
        margin-top: 20px;
        margin-bottom: 10px;
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
</style>
