<script lang="ts">
    /**
     * @file GraphCanvas.svelte
     * @brief The core rendering canvas component.
     * @details Manages 2D and WebGL contexts, coordinates input events, manages animation loops, and delegates rendering mathematically compiled data onto the viewport.
     */
    import { onMount, onDestroy } from 'svelte';
    import { expressions, camera, sliders, tickerActive } from '../../state/store';
    import { plotExpressions, type CompiledEquation } from '../../core/renderer/plotter';
    import { Camera } from '../../core/renderer/camera';
    import { compileExpression, type EquationType, type CompiledEquationData } from '../../core/math/evaluator';
    import { WebGLRenderer } from '../../core/renderer/webglRenderer';
    import { activeTool, odeSpawners } from '../../state/tools';
    import { settings } from '../../state/settings';
    import { isRecording, startRecordingTrigger, stopRecordingTrigger } from '../../state/recorder';
    import { compilerPool } from '../../core/workers/workerPool';
    import { Logger } from '../../utils/logger';
    import { physicsEngine } from '../../core/math/physicsEngine';

    let canvas: HTMLCanvasElement;
    let webglCanvas: HTMLCanvasElement;
    let cam = new Camera();
    const webgl = new WebGLRenderer();

    let compiledCache = new Map<string, { 
        text: string; 
        data: CompiledEquationData | null; 
        domainColoring?: boolean;
    }>();

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    let segmentStartPoint: string | null = null;
    let polygonPoints: string[] = [];
    let circleStartPoint: string | null = null;
    let circle3PtsPoints: string[] = [];
    let midpointPoints: string[] = [];
    let perpendicularObjects: string[] = [];
    let lineStartPoint: string | null = null;
    let perpBisectorStartPoint: string | null = null;
    let angleBisectorPoints: string[] = [];
    let intersectLines: string[] = [];
    let tangentStartPoint: string | null = null;

    // Pointer state for Multi-touch Pan/Zoom
    let activePointers = new Map<number, PointerEvent>();
    let lastPinchDistance = 0;
    let lastPinchCenter = {x: 0, y: 0};

    // Theme state
    import { theme } from '../../state/theme';
    let themeColors = { major: '#d1d5db', minor: '#f3f4f6', text: '#6b7280', bg: '#ffffff' };

    $: {
        if (canvas) {
            if ($theme === 'dark') {
                themeColors = { major: '#4b5563', minor: '#1f2937', text: '#9ca3af', bg: '#111827' };
            } else {
                themeColors = { major: '#d1d5db', minor: '#f3f4f6', text: '#6b7280', bg: '#ffffff' };
            }
            canvas.style.backgroundColor = 'transparent'; // Let webgl show through
            if (webglCanvas) webglCanvas.style.backgroundColor = themeColors.bg;
        }
    }

    // Animation time
    import { timeState } from '../../state/timeState';
    import Timeline from '../Timeline.svelte';

    $: {
        const requiredVars = new Set<string>();
        const customFunctions: Record<string, string> = {};
        for (const expr of $expressions) {
            const match = expr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_])\)\s*=(.*)$/);
            if (match) customFunctions[match[1]] = match[3].trim();
        }

        for (const expr of $expressions) {
            const compiled = compileExpression(expr.text, customFunctions, $settings.domainColoring);
            if (compiled && compiled.vars) {
                compiled.vars.forEach(v => requiredVars.add(v));
            }
        }
        if (requiredVars.size > 0) {
            sliders.requireVars(Array.from(requiredVars));
        }
    }

    let lastEquationsToDraw: CompiledEquation[] = [];
    let lastScope: Record<string, any> = {};

    let draggingPointId: string | null = null;
    let hoveredPointId: string | null = null;
    
    let currentPois: {x: number, y: number, type: string}[] = [];
    let activeTooltip: {screenX: number, screenY: number, text: string} | null = null;

    const unsubscribeCam = camera.subscribe(state => {
        cam.state = state;
    });

    let mediaRecorder: MediaRecorder | null = null;
    let recordedChunks: Blob[] = [];
    let compositeCanvas: HTMLCanvasElement | null = null;
    let compositeCtx: CanvasRenderingContext2D | null = null;

    const unsubStartRec = startRecordingTrigger.subscribe(val => {
        if (val) {
            startRecording();
            startRecordingTrigger.set(false);
        }
    });

    const unsubStopRec = stopRecordingTrigger.subscribe(val => {
        if (val) {
            stopRecording();
            stopRecordingTrigger.set(false);
        }
    });

    function startRecording() {
        if (!canvas || !webglCanvas) return;
        compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = canvas.width;
        compositeCanvas.height = canvas.height;
        compositeCtx = compositeCanvas.getContext('2d');
        if (!compositeCtx) return;

        const stream = compositeCanvas.captureStream(60);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vectoria_export_${Date.now()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
            recordedChunks = [];
        };
        
        mediaRecorder.start();
        isRecording.set(true);
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording.set(false);
        compositeCanvas = null;
        compositeCtx = null;
    }

    onMount(() => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        webgl.init(webglCanvas);

        let animationFrameId: number;
        let lastTime = 0;

        function render(timestamp: number) {
            if (lastTime === 0) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;
            
            sliders.tickAnimations(dt);
            
            if ($timeState.isPlaying) {
                timeState.update(s => {
                    let newT = s.t + dt * s.speed;
                    if (s.isLooping && newT > s.maxT) newT = 0;
                    return { ...s, t: newT };
                });
            }

            if (container) {
                const ratio = window.devicePixelRatio || 1;
                const width = container.clientWidth;
                const height = container.clientHeight;
                
                if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
                    canvas.width = Math.floor(width * ratio);
                    canvas.height = Math.floor(height * ratio);
                    canvas.style.width = `${width}px`;
                    canvas.style.height = `${height}px`;

                    webglCanvas.width = canvas.width;
                    webglCanvas.height = canvas.height;
                    webglCanvas.style.width = canvas.style.width;
                    webglCanvas.style.height = canvas.style.height;
                }

                ctx!.save();
                try {
                    ctx!.scale(ratio, ratio);

                    const activeSliders = $sliders;
                let currentScope: Record<string, any> = { t: $timeState.t };
                for (const [key, slider] of Object.entries(activeSliders)) {
                    currentScope[key] = slider.value;
                }

                // Inject tables into scope
                const activeTables = $expressions.filter(e => e.type === 'table');
                for (const table of activeTables) {
                    if (!table.points) continue;
                    const validPoints = table.points.filter(p => p.x !== null && p.y !== null);
                    if (table.xCol) currentScope[table.xCol] = validPoints.map(p => p.x);
                    if (table.yCol) currentScope[table.yCol] = validPoints.map(p => p.y);
                }

                const equationsToDraw: CompiledEquation[] = [];
                const customFunctions: Record<string, string> = {};
                for (const expr of $expressions) {
                    const match = expr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_])\)\s*=(.*)$/);
                    if (match) customFunctions[match[1]] = match[3].trim();
                }

                for (const expr of $expressions) {
                    if (!expr.visible) continue;
                    
                    if (expr.type === 'table') {
                        if (expr.points && expr.points.length > 0) {
                            const validPoints = expr.points.filter(p => p.x !== null && p.y !== null);
                            if (validPoints.length > 0) {
                                equationsToDraw.push({
                                    id: expr.id,
                                    name: undefined,
                                    color: expr.color,
                                    type: 'point',
                                    isDraggable: false,
                                    pointData: () => ({ x: validPoints.map(p => p.x), y: validPoints.map(p => p.y) }),
                                    lineWidth: expr.lineWidth,
                                    lineStyle: expr.lineStyle,
                                    pointStyle: expr.pointStyle
                                });
                            }
                        }
                        continue;
                    }

                    let cached = compiledCache.get(expr.id);
                    // Also invalidate cache if domainColoring changed
                    if (!cached || cached.text !== expr.text || (cached as any).domainColoring !== $settings.domainColoring) {
                        const compiled = compileExpression(expr.text, customFunctions, $settings.domainColoring);
                        cached = {
                            text: expr.text,
                            data: compiled,
                            domainColoring: $settings.domainColoring
                        };
                        compiledCache.set(expr.id, cached);
                        
                        // Delegate heavy GLSL compilation array to the Worker Pool
                        if (compiled && (compiled.type === 'implicit' || compiled.type === 'inequality') && !compiled.glslExpr) {
                            compilerPool.compileGLSLAsync(expr.id, expr.text, $settings.domainColoring)
                                .then((workerResult: any) => {
                                    if (workerResult.success) {
                                        const stillCached = compiledCache.get(expr.id);
                                        if (stillCached && stillCached.data) {
                                            stillCached.data.glslExpr = workerResult.glsl;
                                            stillCached.data.glslUniforms = workerResult.uniforms;
                                            // Trigger a repaint so the new shader shows up immediately
                                            if (canvas && webglCanvas) {
                                                paint($expressions, $camera, $timeState);
                                            }
                                        }
                                    }
                                }).catch(() => {});
                        }
                    }

                    if (cached!.data) {
                        const dataVars = cached!.data.vars || [];
                        const arrayVars = dataVars.filter(v => Array.isArray(currentScope[v]));
                        
                        if (arrayVars.length > 0) {
                            // Find the maximum length among the array variables
                            const maxLength = Math.max(...arrayVars.map(v => currentScope[v].length));
                            for (let i = 0; i < maxLength; i++) {
                                // Create a proxy scope that pins the array variables to their i-th element
                                const instanceScope = new Proxy(currentScope, {
                                    get(target, prop) {
                                        if (typeof prop === 'string' && arrayVars.includes(prop)) {
                                            const arr = target[prop];
                                            return arr[Math.min(i, arr.length - 1)];
                                        }
                                        return target[prop as any];
                                    }
                                });
                                
                                equationsToDraw.push({
                                    ...cached!.data,
                                    id: expr.id + '_' + i,
                                    name: cached!.data.name ? `${cached!.data.name}_${i}` : undefined,
                                    color: expr.color,
                                    isDraggable: false, // Don't drag instances of a family
                                    fnExplicit: cached!.data.fnExplicit ? (x, s) => cached!.data!.fnExplicit!(x, instanceScope) : undefined,
                                    fnImplicit: cached!.data.fnImplicit ? (x, y, s) => cached!.data!.fnImplicit!(x, y, instanceScope) : undefined,
                                    pointData: cached!.data.pointData ? (s) => cached!.data!.pointData!(instanceScope) : undefined,
                                    fnParametric: cached!.data.fnParametric ? (t, s) => cached!.data!.fnParametric!(t, instanceScope) : undefined,
                                    segmentData: cached!.data.segmentData ? (s) => cached!.data!.segmentData!(instanceScope) : undefined,
                                    polygonData: cached!.data.polygonData ? (s) => cached!.data!.polygonData!(instanceScope) : undefined,
                                    circleData: cached!.data.circleData ? (s) => cached!.data!.circleData!(instanceScope) : undefined,
                                    labelData: cached!.data.labelData ? (s) => cached!.data!.labelData!(instanceScope) : undefined,
                                    constantValue: cached!.data.constantValue ? (s) => cached!.data!.constantValue!(instanceScope) : undefined,
                                    dataFn: cached!.data.dataFn ? (s) => cached!.data!.dataFn!(instanceScope) : undefined,
                                    lineData: cached!.data.lineData ? (s) => cached!.data!.lineData!(instanceScope) : undefined,
                                    actionExecute: cached!.data.actionExecute ? (s) => cached!.data!.actionExecute!(instanceScope) : undefined,
                                    lineWidth: expr.lineWidth,
                                    lineStyle: expr.lineStyle,
                                    pointStyle: expr.pointStyle,
                                    glslUniformsScope: instanceScope // We'll pass this special property for WebGL to use
                                });
                            }
                        } else {
                            equationsToDraw.push({
                                ...cached!.data,
                                id: expr.id,
                                color: expr.color,
                                lineWidth: expr.lineWidth,
                                lineStyle: expr.lineStyle,
                                pointStyle: expr.pointStyle
                            });
                        }
                    }
                }

                // Topological sort/injection of named variables
                let unresolved = [...equationsToDraw];
                let maxPasses = 5;
                while (unresolved.length > 0 && maxPasses > 0) {
                    const nextUnresolved = [];
                    for (const eq of unresolved) {
                        try {
                            if (eq.name) {
                                if (eq.type === 'point' && eq.pointData) {
                                    const pt = eq.pointData(currentScope);
                                    if (isNaN(pt.x) || isNaN(pt.y)) throw new Error('NaN');
                                    currentScope[eq.name] = [pt.x, pt.y];
                                } else if (eq.type === 'line' && eq.lineData) {
                                    const ld = eq.lineData(currentScope);
                                    if (ld && !isNaN(ld.px)) currentScope[eq.name] = ld;
                                } else if (eq.type === 'circle' && eq.circleData) {
                                    const cd = eq.circleData(currentScope);
                                    if (cd && !isNaN(cd.cx)) currentScope[eq.name] = cd;
                                } else if (eq.constantValue) {
                                    const val = eq.constantValue(currentScope);
                                    if (isNaN(val)) throw new Error('NaN');
                                    currentScope[eq.name] = val;
                                }
                            }
                            if (eq.type === 'regression' && eq.regressionSolve) {
                                const solveData = eq.regressionSolve(currentScope);
                                if (solveData) {
                                    for (const [k, v] of Object.entries(solveData.params)) {
                                        currentScope[k] = v;
                                    }
                                    expressions.updateRegressionParams(eq.id, solveData.params, solveData.rSquared);
                                }
                            }
                            if (eq.type === 'action' && eq.actionExecute && $tickerActive) {
                                const res = eq.actionExecute(currentScope);
                                if (res) {
                                    sliders.updateValue(res.target, res.value);
                                    currentScope[res.target] = res.value;
                                }
                            }
                        } catch (e) {
                            nextUnresolved.push(eq);
                        }
                    }
                    if (nextUnresolved.length === unresolved.length) break; // no progress
                    unresolved = nextUnresolved;
                    maxPasses--;
                }

                lastEquationsToDraw = equationsToDraw;
                lastScope = currentScope;

                const webglEquations: CompiledEquation[] = [];
                const cpuEquations: CompiledEquation[] = [];

                for (const eq of equationsToDraw) {
                    if ((eq.type === 'implicit' || eq.type === 'inequality') && eq.glslExpr) {
                        webglEquations.push(eq);
                    } else {
                        cpuEquations.push(eq);
                    }
                }

                webgl.clear();
                for (const eq of webglEquations) {
                    webgl.drawEquation(
                        eq.id,
                        eq.glslExpr!,
                        eq.operator || '=',
                        eq.glslUniforms || [],
                        (eq as any).glslUniformsScope || currentScope,
                        cam,
                        webglCanvas.width,
                        webglCanvas.height,
                        eq.color,
                        $settings.domainColoring
                    );
                }

                ctx!.clearRect(0, 0, width, height);
                
                // Build Colliders from explicit math functions
                const colliders: ((x: number) => number)[] = [];
                for (const eq of cpuEquations) {
                    if (eq.type === 'explicit' && eq.fnExplicit && eq.operator === '=') {
                        const compiledFn = eq.fnExplicit;
                        colliders.push((x: number) => compiledFn(x, currentScope));
                    }
                }
                
                // Advance Physics Engine
                physicsEngine.step(dt, 5, colliders);
                
                currentPois = plotExpressions(ctx!, cpuEquations, cam, width, height, currentScope, themeColors, $settings.gridType, dt, $odeSpawners);
                
                // Draw table points
                for (const table of activeTables) {
                    if (!table.visible || !table.points) continue;
                    ctx!.fillStyle = table.color;
                    for (const p of table.points) {
                        if (p.x === null || p.y === null) continue;
                        const screenP = cam.mathToScreen(p.x, p.y, width, height);
                        ctx!.beginPath();
                        ctx!.arc(screenP.x, screenP.y, 6, 0, Math.PI * 2);
                        ctx!.fill();
                    }
                }
                } catch (e) {
                    Logger.error('GraphCanvas', 'Error in render frame: ' + e);
                } finally {
                    ctx!.restore();
                }

                if ($isRecording && compositeCtx && compositeCanvas) {
                    if (compositeCanvas.width !== canvas.width || compositeCanvas.height !== canvas.height) {
                        compositeCanvas.width = canvas.width;
                        compositeCanvas.height = canvas.height;
                    }
                    compositeCtx.fillStyle = themeColors.bg;
                    compositeCtx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                    compositeCtx.drawImage(webglCanvas, 0, 0);
                    compositeCtx.drawImage(canvas, 0, 0);
                }
            }

            animationFrameId = requestAnimationFrame(render);
        }

        animationFrameId = requestAnimationFrame(render);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    });

    onDestroy(() => {
        unsubscribeCam();
        unsubStartRec();
        unsubStopRec();
    });

    // Touch and Mouse handlers
    function handlePointerDown(e: PointerEvent) {
        if (hoveredPointId) {
            draggingPointId = hoveredPointId;
            canvas.setPointerCapture(e.pointerId);
            return;
        }

        if ($activeTool === 'ode') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            odeSpawners.update(sp => [...sp, { x: mathP.x, y: mathP.y }]);
            return;
        }

        if ($activeTool === 'point') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            const pId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
            expressions.addExpression(`${pId} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
            activeTool.setMode('move');
            return;
        }

        if ($activeTool === 'segment') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.pointData && eq.name) {
                    try {
                        const p = eq.pointData(lastScope);
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) {
                            clickedPointName = eq.name;
                            break;
                        }
                    } catch (err) {}
                }
            }

            if (!segmentStartPoint) {
                if (clickedPointName) {
                    segmentStartPoint = clickedPointName;
                } else {
                    const pId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                    expressions.addExpression(`${pId} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                    segmentStartPoint = pId;
                }
            } else {
                let endPointName = clickedPointName;
                if (!endPointName) {
                    endPointName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                    expressions.addExpression(`${endPointName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                }
                if (segmentStartPoint !== endPointName) {
                    expressions.addExpression(`Segment(${segmentStartPoint}, ${endPointName})`);
                }
                segmentStartPoint = null;
                activeTool.setMode('move');
            }
            return;
        }

        if ($activeTool === 'polygon') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.pointData && eq.name) {
                    try {
                        const p = eq.pointData(lastScope);
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) {
                            clickedPointName = eq.name;
                            break;
                        }
                    } catch (err) {}
                }
            }

            let ptName = clickedPointName;
            if (!ptName) {
                ptName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                expressions.addExpression(`${ptName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
            }

            // If we click the first point again, close the polygon
            if (polygonPoints.length > 2 && polygonPoints[0] === ptName) {
                expressions.addExpression(`Polygon(${polygonPoints.join(', ')})`);
                polygonPoints = [];
                activeTool.setMode('move');
            } else {
                polygonPoints.push(ptName);
            }
            return;
        }

        if ($activeTool === 'circle') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.pointData && eq.name) {
                    try {
                        const p = eq.pointData(lastScope);
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) {
                            clickedPointName = eq.name;
                            break;
                        }
                    } catch (err) {}
                }
            }

            if (!circleStartPoint) {
                if (clickedPointName) {
                    circleStartPoint = clickedPointName;
                } else {
                    const pId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                    expressions.addExpression(`${pId} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                    circleStartPoint = pId;
                }
            } else {
                let endPointName = clickedPointName;
                if (!endPointName) {
                    endPointName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                    expressions.addExpression(`${endPointName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                }
                if (circleStartPoint !== endPointName) {
                    expressions.addExpression(`Circle(${circleStartPoint}, ${endPointName})`);
                }
                circleStartPoint = null;
                activeTool.setMode('move');
            }
            return;
        }

        if (['line', 'perpBisector', 'perpendicular', 'tangent', 'midpoint', 'circle3pts', 'intersect', 'angleBisector'].includes($activeTool)) {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            let clickedLineName = null;
            let clickedCurveName = null;

            for (let i = lastEquationsToDraw.length - 1; i >= 0; i--) {
                const eq = lastEquationsToDraw[i];
                if (eq.name) {
                    if (eq.type === 'point' && eq.pointData && !clickedPointName && !clickedLineName) {
                        try {
                            const p = eq.pointData(lastScope);
                            const dx = p.x - mathP.x;
                            const dy = p.y - mathP.y;
                            const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                            if (dist < 15) clickedPointName = eq.name;
                        } catch (err) {}
                    } else if ((eq.type === 'line' || eq.type === 'segment') && (eq.lineData || eq.segmentData) && !clickedLineName && !clickedPointName) {
                        try {
                            const data = eq.lineData ? eq.lineData(lastScope) : eq.segmentData!(lastScope);
                            if (data) {
                                let dist = 1000;
                                if ('dx' in data) { // Line
                                    const l2 = data.dx*data.dx + data.dy*data.dy;
                                    const t = ((mathP.x - data.px) * data.dx + (mathP.y - data.py) * data.dy) / l2;
                                    const projX = data.px + t * data.dx;
                                    const projY = data.py + t * data.dy;
                                    dist = Math.sqrt((mathP.x - projX)**2 + (mathP.y - projY)**2) * cam.state.zoom;
                                } else { // Segment
                                    const l2 = (data.x1 - data.x2)**2 + (data.y1 - data.y2)**2;
                                    let t = Math.max(0, Math.min(1, ((mathP.x - data.x1) * (data.x2 - data.x1) + (mathP.y - data.y1) * (data.y2 - data.y1)) / l2));
                                    const projX = data.x1 + t * (data.x2 - data.x1);
                                    const projY = data.y1 + t * (data.y2 - data.y1);
                                    dist = Math.sqrt((mathP.x - projX)**2 + (mathP.y - projY)**2) * cam.state.zoom;
                                }
                                if (dist < 15) clickedLineName = eq.name;
                            }
                        } catch (err) {}
                    } else if ($activeTool === 'tangent' && !eq.pointData && !clickedCurveName && !clickedPointName) {
                         clickedCurveName = eq.name; 
                    }
                }
            }

            if ($activeTool === 'intersect') {
                if (clickedLineName) {
                    intersectLines.push(clickedLineName);
                    if (intersectLines.length === 2) {
                        expressions.addExpression(`Intersect(${intersectLines[0]}, ${intersectLines[1]})`);
                        intersectLines = [];
                        activeTool.setMode('move');
                    }
                }
                return;
            } else if ($activeTool === 'angleBisector') {
                if (clickedLineName) {
                    angleBisectorPoints = [];
                    intersectLines.push(clickedLineName);
                    if (intersectLines.length === 2) {
                        expressions.addExpression(`AngleBisector(${intersectLines[0]}, ${intersectLines[1]})`);
                        intersectLines = [];
                        activeTool.setMode('move');
                    }
                } else {
                    intersectLines = [];
                    let ptName = clickedPointName;
                    if (!ptName) {
                        ptName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                        expressions.addExpression(`${ptName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                    }
                    angleBisectorPoints.push(ptName);
                    if (angleBisectorPoints.length === 3) {
                        expressions.addExpression(`AngleBisector(${angleBisectorPoints.join(', ')})`);
                        angleBisectorPoints = [];
                        activeTool.setMode('move');
                    }
                }
                return;
            } else if ($activeTool === 'perpendicular') {
                if (clickedLineName && !perpendicularObjects.includes(clickedLineName)) {
                    perpendicularObjects.push(clickedLineName);
                } else {
                    let ptName = clickedPointName;
                    if (!ptName) {
                        ptName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                        expressions.addExpression(`${ptName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                    }
                    if (!perpendicularObjects.includes(ptName)) {
                        perpendicularObjects.push(ptName);
                    }
                }
                
                if (perpendicularObjects.length === 2) {
                    expressions.addExpression(`Perpendicular(${perpendicularObjects[0]}, ${perpendicularObjects[1]})`);
                    perpendicularObjects = [];
                    activeTool.setMode('move');
                }
                return;
            }

            let startState = $activeTool === 'line' ? lineStartPoint : ($activeTool === 'perpBisector' ? perpBisectorStartPoint : ($activeTool === 'tangent' ? tangentStartPoint : null));
            let ptName = clickedPointName;
            
            if (!ptName) {
                ptName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                expressions.addExpression(`${ptName} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
            }

            if ($activeTool === 'circle3pts') {
                circle3PtsPoints.push(ptName);
                if (circle3PtsPoints.length === 3) {
                    expressions.addExpression(`Circle(${circle3PtsPoints.join(', ')})`);
                    circle3PtsPoints = [];
                    activeTool.setMode('move');
                }
                return;
            }
            if ($activeTool === 'midpoint') {
                midpointPoints.push(ptName);
                if (midpointPoints.length === 2) {
                    const midPtId = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 100);
                    expressions.addExpression(`${midPtId} = Midpoint(${midpointPoints[0]}, ${midpointPoints[1]})`);
                    midpointPoints = [];
                    activeTool.setMode('move');
                }
                return;
            }

            if (!startState) {
                if ($activeTool === 'line') lineStartPoint = ptName;
                else if ($activeTool === 'perpBisector') perpBisectorStartPoint = ptName;
                else if ($activeTool === 'tangent') tangentStartPoint = ptName;
            } else {
                if ($activeTool === 'line') {
                    expressions.addExpression(`Line(${startState}, ${ptName})`);
                    lineStartPoint = null;
                } else if ($activeTool === 'perpBisector') {
                    expressions.addExpression(`PerpendicularBisector(${startState}, ${ptName})`);
                    perpBisectorStartPoint = null;
                } else if ($activeTool === 'tangent') {
                     const target = clickedCurveName || ptName;
                     expressions.addExpression(`Tangent(${tangentStartPoint}, ${target})`);
                     tangentStartPoint = null;
                }
                activeTool.setMode('move');
            }
            return;
        }

        if ($activeTool === 'delete') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedEquationId = null;
            // Iterate in reverse to grab the topmost rendered element
            for (let i = lastEquationsToDraw.length - 1; i >= 0; i--) {
                const eq = lastEquationsToDraw[i];
                if (eq.type === 'point' && eq.pointData) {
                    try {
                        const p = eq.pointData(lastScope);
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) {
                            clickedEquationId = eq.id;
                            break;
                        }
                    } catch (err) {}
                } else if (eq.type === 'segment' && eq.segmentData) {
                    try {
                        const seg = eq.segmentData(lastScope);
                        if (seg) {
                            // Distance from point to line segment
                            const l2 = (seg.x1 - seg.x2)**2 + (seg.y1 - seg.y2)**2;
                            let t = Math.max(0, Math.min(1, ((mathP.x - seg.x1) * (seg.x2 - seg.x1) + (mathP.y - seg.y1) * (seg.y2 - seg.y1)) / l2));
                            const projX = seg.x1 + t * (seg.x2 - seg.x1);
                            const projY = seg.y1 + t * (seg.y2 - seg.y1);
                            const dist = Math.sqrt((mathP.x - projX)**2 + (mathP.y - projY)**2) * cam.state.zoom;
                            if (dist < 10) {
                                clickedEquationId = eq.id;
                                break;
                            }
                        }
                    } catch (err) {}
                }
            }

            if (clickedEquationId) {
                expressions.removeExpression(clickedEquationId);
            }
            return;
        }

        canvas.setPointerCapture(e.pointerId);
        activePointers.set(e.pointerId, e);
        if (activePointers.size === 1) {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        } else if (activePointers.size === 2) {
            isDragging = false;
            const pts = Array.from(activePointers.values());
            lastPinchDistance = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
            lastPinchCenter = {
                x: (pts[0].clientX + pts[1].clientX) / 2,
                y: (pts[0].clientY + pts[1].clientY) / 2
            };
        }
    }

    function handlePointerMove(e: PointerEvent) {
        const rect = canvas.getBoundingClientRect();

        if (draggingPointId) {
            let mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            // Grid Snapping
            const snapThreshold = 10 / cam.state.zoom; // 10 pixels snapping distance
            if (Math.abs(mathP.x - Math.round(mathP.x)) < snapThreshold) mathP.x = Math.round(mathP.x);
            if (Math.abs(mathP.y - Math.round(mathP.y)) < snapThreshold) mathP.y = Math.round(mathP.y);
            // Axis Snapping
            if (Math.abs(mathP.x) < snapThreshold) mathP.x = 0;
            if (Math.abs(mathP.y) < snapThreshold) mathP.y = 0;

            const eq = lastEquationsToDraw.find(eq => eq.id === draggingPointId);
            if (eq) {
                const newText = eq.name ? `${eq.name} = (${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})` : `(${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`;
                expressions.updateText(eq.id, newText, newText);
            }
            return;
        }

        if (!isDragging && activePointers.size === 0) {
            // Check hover for draggable points
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            let foundPoint = null;
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.isDraggable && eq.pointData) {
                    try {
                        const p = eq.pointData(lastScope);
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) { // 15 pixels hover radius
                            foundPoint = eq.id;
                            break;
                        }
                    } catch (err) {}
                }
            }
            hoveredPointId = foundPoint;
            
            // Check POIs for tooltip
            let foundPoi = null;
            if (!foundPoint && $activeTool === 'move') {
                for (const poi of currentPois) {
                    const screenP = cam.mathToScreen(poi.x, poi.y, rect.width, rect.height);
                    const dx = screenP.x - (e.clientX - rect.left);
                    const dy = screenP.y - (e.clientY - rect.top);
                    if (Math.sqrt(dx*dx + dy*dy) < 15) {
                        foundPoi = { 
                            screenX: screenP.x + rect.left, 
                            screenY: screenP.y + rect.top, 
                            text: `${poi.type === 'root' ? 'Root' : (poi.type === 'y-intercept' ? 'Y-intercept' : 'Intersection')}: (${poi.x.toFixed(2)}, ${poi.y.toFixed(2)})` 
                        };
                        break;
                    }
                }
            }
            activeTooltip = foundPoi;

            canvas.style.cursor = hoveredPointId || activeTooltip ? 'pointer' : 'grab';
            return;
        }

        if (!activePointers.has(e.pointerId)) return;
        activePointers.set(e.pointerId, e);

        if (activePointers.size === 1 && isDragging) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            camera.update(state => ({
                ...state,
                x: state.x - dx / state.zoom,
                y: state.y + dy / state.zoom
            }));
        } else if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            const currentDistance = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
            const currentCenter = {
                x: (pts[0].clientX + pts[1].clientX) / 2,
                y: (pts[0].clientY + pts[1].clientY) / 2
            };

            const dx = currentCenter.x - lastPinchCenter.x;
            const dy = currentCenter.y - lastPinchCenter.y;

            if (lastPinchDistance === 0) lastPinchDistance = 1;
            const zoomFactor = currentDistance / lastPinchDistance;
            
            const mathBefore = cam.screenToMath(currentCenter.x - rect.left, currentCenter.y - rect.top, rect.width, rect.height);

            camera.update(state => {
                const newZoom = Math.max(1, state.zoom * zoomFactor);
                const newCx = mathBefore.x - (currentCenter.x - rect.left - rect.width / 2) / newZoom - dx / newZoom;
                const newCy = mathBefore.y + (currentCenter.y - rect.top - rect.height / 2) / newZoom + dy / newZoom;

                return {
                    x: newCx,
                    y: newCy,
                    zoom: newZoom
                };
            });

            lastPinchDistance = currentDistance;
            lastPinchCenter = currentCenter;
        }
    }

    function handlePointerUp(e: PointerEvent) {
        if (draggingPointId) {
            draggingPointId = null;
            return;
        }

        activePointers.delete(e.pointerId);
        if (activePointers.size === 0) {
            isDragging = false;
        } else if (activePointers.size === 1) {
            const remaining = Array.from(activePointers.values())[0];
            isDragging = true;
            lastMouseX = remaining.clientX;
            lastMouseY = remaining.clientY;
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const mathBefore = cam.screenToMath(mouseX, mouseY, rect.width, rect.height);

        camera.update(state => {
            const newZoom = Math.max(1, state.zoom * zoomFactor);
            const newCx = mathBefore.x - (mouseX - rect.width / 2) / newZoom;
            const newCy = mathBefore.y + (mouseY - rect.height / 2) / newZoom;

            return {
                x: newCx,
                y: newCy,
                zoom: newZoom
            };
        });
    }

    function zoomIn() {
        camera.update(state => ({ ...state, zoom: state.zoom * 1.2 }));
    }

    function zoomOut() {
        camera.update(state => ({ ...state, zoom: Math.max(1, state.zoom * 0.8) }));
    }

    function resetView() {
        camera.update(state => ({ x: 0, y: 0, zoom: 50 }));
    }

let container: HTMLDivElement;
</script>

<div class="canvas-container" bind:this={container}>
    <canvas class="webgl-layer" bind:this={webglCanvas}></canvas>
    <canvas class="canvas-layer" bind:this={canvas}
        on:pointerdown={handlePointerDown}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerUp}
        on:pointercancel={handlePointerUp}
        on:pointerleave={handlePointerUp}
        on:wheel|nonpassive={handleWheel}
    ></canvas>
    
    <div class="zoom-controls">
        <button on:click={zoomIn} aria-label="Zoom In">➕</button>
        <button on:click={zoomOut} aria-label="Zoom Out">➖</button>
        <button on:click={resetView} aria-label="Reset View">🏠</button>
    </div>
    
    <Timeline />
    
    {#if activeTooltip}
        <div class="poi-tooltip" style="left: {activeTooltip.screenX}px; top: {activeTooltip.screenY}px;">
            {activeTooltip.text}
        </div>
    {/if}
</div>

<style>
    .canvas-container {
        flex: 1;
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .webgl-layer, .canvas-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    .canvas-layer {
        pointer-events: auto; /* handle all touch/mouse */
        z-index: 2;
        cursor: grab;
    }
    .canvas-layer:active {
        cursor: grabbing;
    }
    .zoom-controls {
        position: absolute;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 10;
    }
    .zoom-controls button {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.2s;
        font-size: 1.2rem;
        color: var(--text-primary);
    }
    .zoom-controls button:hover {
        background: var(--bg-surface-hover, var(--border-color));
        transform: translateY(-2px);
    }
    .webgl-layer {
        pointer-events: none;
        z-index: 1;
    }
    .poi-tooltip {
        position: absolute;
        transform: translate(-50%, -150%);
        background-color: var(--bg-surface);
        backdrop-filter: var(--backdrop-blur);
        -webkit-backdrop-filter: var(--backdrop-blur);
        color: var(--text-primary);
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 0.85rem;
        font-family: 'Computer Modern', serif;
        pointer-events: none;
        white-space: nowrap;
        z-index: 20;
    }
</style>
