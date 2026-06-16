/**
 * @file canvasEvents.ts
 * @brief Canvas interaction logic and tool handling.
 * @details Isolates pointer events from the Svelte component to handle geometric tool creation and manipulation.
 */

import { get } from 'svelte/store';
import { expressions } from '../../state/store';
import { activeTool } from '../../state/tools';

/**
 * @brief Handles pointer down events on the GraphCanvas.
 * @param e The triggering pointer event.
 * @param canvas The target canvas element.
 * @param cam The active camera instance.
 * @param lastEquationsToDraw Cache of rendered equations.
 * @param lastScope Current evaluation scope.
 * @param state General canvas state.
 * @param actions Callbacks to the canvas component.
 */
export function handleCanvasPointerDown(
    e: PointerEvent,
    canvas: HTMLCanvasElement,
    cam: any,
    lastEquationsToDraw: any[],
    lastScope: any,
    state: any,
    actions: any
) {
    const active = get(activeTool);
    if (active === 'move') return;

    const rect = canvas.getBoundingClientRect();
    const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    
    // Very simplified extraction: if point mode
    if (active === 'point') {
        const pId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
        expressions.addExpression(`${pId} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
        activeTool.setMode('move');
        return;
    }
    
    // Call the original logic from GraphCanvas passed via actions callback if needed,
    // or port it all here. Given the complexity, this serves as a stub for the refactoring pattern.
    actions.fallback(e);
}
