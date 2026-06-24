<script lang="ts">
    import { timeState } from '../state/timeState';
    
    let isCollapsed = false;

    function togglePlay() {
        timeState.update(s => ({ ...s, isPlaying: !s.isPlaying }));
    }
    
    function toggleLoop() {
        timeState.update(s => ({ ...s, isLooping: !s.isLooping }));
    }
    
    function resetTime() {
        timeState.update(s => ({ ...s, t: 0 }));
    }
</script>

<div class="timeline-container" class:collapsed={isCollapsed}>
    <button class="collapse-btn" on:click={() => isCollapsed = !isCollapsed} aria-label="Toggle Timeline">
        {#if isCollapsed}⏱️{:else}🔽{/if}
    </button>
    <div class="timeline-panel">
        <div class="controls">
            <button class="btn" class:active={$timeState.isPlaying} on:click={togglePlay}>
                {$timeState.isPlaying ? '⏸' : '▶'}
            </button>
            <button class="btn" on:click={resetTime}>⏹</button>
            <button class="btn" class:active={$timeState.isLooping} on:click={toggleLoop}>
                🔁
            </button>
            <div class="speed-control">
                <span>{$timeState.speed}x</span>
                <input type="range" min="0.1" max="5" step="0.1" bind:value={$timeState.speed} />
            </div>
        </div>
        
        <div class="scrubber">
            <span class="time-label">t = {$timeState.t.toFixed(2)}</span>
            <input class="scrubber-slider" type="range" min="0" max={$timeState.maxT} step="0.01" bind:value={$timeState.t} />
            <input class="max-t" type="number" bind:value={$timeState.maxT} title="Max Time" />
        </div>
    </div>
</div>

<style>
    .timeline-container {
        position: absolute;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .timeline-container.collapsed {
        transform: translate(-50%, calc(100% + 24px));
    }
    .timeline-container.collapsed .collapse-btn {
        transform: translateY(calc(-100% - 24px));
        background: var(--accent-color, #6366f1);
        color: white;
        border: none;
    }
    .collapse-btn {
        background: var(--bg-surface, #ffffff);
        border: 1px solid var(--border-light, #e5e7eb);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        color: var(--text-secondary, #6b7280);
        font-size: 0.8rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .collapse-btn:hover {
        background: var(--bg-canvas, #f9fafb);
    }
    .timeline-panel {
        background: color-mix(in srgb, var(--bg-surface, #ffffff) 85%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 400px;
        color: var(--text-primary, #111827);
    }
    .controls {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
    }
    .btn {
        background: transparent;
        border: 1px solid var(--border-light, #e5e7eb);
        border-radius: 6px;
        padding: 4px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        color: inherit;
    }
    .btn.active {
        background: var(--accent-light, #eef2ff);
        border-color: var(--accent-color, #6366f1);
        color: var(--accent-color, #6366f1);
    }
    .speed-control {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        margin-left: 16px;
    }
    .speed-control input {
        width: 80px;
    }
    .scrubber {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .time-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        min-width: 80px;
    }
    .scrubber-slider {
        flex: 1;
    }
    .max-t {
        width: 60px;
        font-size: 12px;
        border: 1px solid var(--border-light, #e5e7eb);
        border-radius: 4px;
        padding: 2px 4px;
        background: transparent;
        color: inherit;
    }

    @media (max-width: 768px) {
        .timeline-container {
            bottom: 85px; /* Above the ToolsPanel which is 60px high + some padding */
            width: 95%;
            max-width: 400px;
        }
        
        .timeline-panel {
            min-width: 0;
            width: 100%;
            padding: 10px;
            gap: 12px;
        }
        
        .speed-control {
            margin-left: auto;
        }
        
        .speed-control input {
            width: 60px;
        }
        
        .time-label {
            min-width: 70px;
            font-size: 12px;
        }
        
        .max-t {
            width: 50px;
        }
        
        .controls {
            gap: 4px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 4px 10px;
        }
    }
</style>
