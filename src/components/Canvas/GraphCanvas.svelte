<script lang="ts">
    /**
     * @file GraphCanvas.svelte
     * @brief The core rendering canvas component.
     * @details Manages 2D and WebGL contexts, coordinates input events, manages animation loops, and delegates rendering mathematically compiled data onto the viewport.
     */
    import { onMount, onDestroy } from 'svelte';
    import { expressions, camera, sliders, tickerActive, selectedExpressionId } from '../../state/store';
    import { plotExpressions, type CompiledEquation } from '../../core/renderer/plotter';
    import { Camera } from '../../core/renderer/camera';
    import { compileExpression, type EquationType, type CompiledEquationData } from '../../core/math/evaluator';
    import { preprocessMathLive } from '../../core/math/transformers';
    import { WebGLRenderer } from '../../core/renderer/webglRenderer';
    import { activeTool } from '../../state/tools';
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
        customFunctionsStr?: string;
        macrosStr?: string;
    }>();

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    let segmentStartPoint: string | null = null;
    let polygonPoints: string[] = [];
    let circleStartPoint: string | null = null;
    let circle3PtsPoints: string[] = [];
    let midpointPoints: string[] = [];
    let perpendicularObjects: string[] = [];
    let parallelObjects: string[] = [];
    let conicPoints: string[] = [];
    let lineStartPoint: string | null = null;
    let perpBisectorStartPoint: string | null = null;
    let angleBisectorPoints: string[] = [];
    let intersectLines: string[] = [];
    let tangentStartPoint: string | null = null;

    function autoName(prefix: string): string {
        let maxIndex = 0;
        const regex = new RegExp(`^${prefix}_(?:\\{)?(\\d+)(?:\\})?\\s*=`);
        for (const expr of $expressions) {
            const match = expr.text.match(regex);
            if (match) {
                const idx = parseInt(match[1], 10);
                if (idx > maxIndex) {
                    maxIndex = idx;
                }
            }
        }
        return `${prefix}_{${maxIndex + 1}}`;
    }

    // Pointer state for Multi-touch Pan/Zoom
    let activePointers = new Map<number, PointerEvent>();
    let lastPinchDistance = 0;
    let lastPinchCenter = {x: 0, y: 0};

    // Theme state
    import { theme } from '../../state/theme';
    let themeColors = { major: '#d1d5db', minor: '#f3f4f6', text: '#6b7280', bg: '#ffffff' };

    $: if ($activeTool) {
        segmentStartPoint = null;
        polygonPoints = [];
        circleStartPoint = null;
        circle3PtsPoints = [];
        midpointPoints = [];
        perpendicularObjects = [];
        parallelObjects = [];
        conicPoints = [];
        lineStartPoint = null;
        perpBisectorStartPoint = null;
        angleBisectorPoints = [];
        intersectLines = [];
        tangentStartPoint = null;
    }

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
        const customFunctions: Record<string, { param: string; body: string }> = {};
        const macros: Record<string, string> = {};
        const customNames = new Set<string>();

        // 1. Gather custom functions and macros
        for (const expr of $expressions) {
            let processedText = preprocessMathLive(expr.text);
            const match = processedText.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_])\s*\)\s*=(.*)$/);
            if (match) {
                const name = match[1];
                const param = match[2];
                const body = match[3].trim();
                customFunctions[name] = { param, body };
                customNames.add(name);
            } else {
                const assignMatch = processedText.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
                if (assignMatch && !["y", "x", "r", "f(x)"].includes(assignMatch[1].trim())) {
                    const varName = assignMatch[1].trim();
                    const rhs = assignMatch[2].trim();
                    customNames.add(varName);
                    if (varName.includes('_dt') || varName.includes('_d') || rhs.match(/[a-zA-Z]/)) {
                        macros[varName] = rhs;
                    }
                }
            }
            if (expr.type === 'table') {
                if (expr.xCol) customNames.add(expr.xCol);
                if (expr.yCol) customNames.add(expr.yCol);
            }
        }

        // 3. Compile expressions and extract variables (filter out defined ones)
        for (const expr of $expressions) {
            const compiled = compileExpression(expr.text, customFunctions, customNames, macros);
            if (compiled && compiled.vars) {
                compiled.vars.forEach(v => {
                    if (!customNames.has(v) && v !== 't') {
                        requiredVars.add(v);
                    }
                });
            }
        }
        sliders.syncVars(Array.from(requiredVars));
    }

    let lastEquationsToDraw: CompiledEquation[] = [];
    let lastScope: Record<string, any> = {};

    let draggingPointId: string | null = null;
    let hoveredPointId: string | null = null;
    let hoveredCurveId: string | null = null;
    
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
            
            cam.setTransform([[1, 0], [0, 1]]); // Reset transform for new frame
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
                const customFunctions: Record<string, { param: string; body: string }> = {};
                const macros: Record<string, string> = {};
                const customNames = new Set<string>();

                for (const expr of $expressions) {
                    let processedText = preprocessMathLive(expr.text);
                    const match = processedText.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_])\s*\)\s*=(.*)$/);
                    if (match) {
                        customFunctions[match[1]] = { param: match[2], body: match[3].trim() };
                        customNames.add(match[1]);
                    } else {
                        const assignMatch = processedText.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
                        if (assignMatch && !["y", "x", "r", "f(x)"].includes(assignMatch[1].trim())) {
                            const varName = assignMatch[1].trim();
                            const rhs = assignMatch[2].trim();
                            customNames.add(varName);
                            const isGeom = rhs.match(/^\s*(Segment|PerpendicularBisector|Line|Intersect|Midpoint|Circle|Ellipse|Parallel|Perpendicular|AngleBisector|Tangent|Polygon|Fourier|Voronoi|Delaunay|Conic|Point|PhysicsNode|PhysicsLink|PhysicsCloth|VectorField)\s*\(/i);
                            if (varName.includes('_dt') || varName.includes('_d') || (rhs.match(/[a-zA-Z]/) && !isGeom)) {
                                macros[varName] = rhs;
                            }
                        }
                    }
                }
                console.group('[Vectoria ODE Debug] Macro collection pass');
                console.log('Macros:', JSON.stringify(macros));
                console.log('CustomNames:', [...customNames]);
                console.log('CustomFunctions:', Object.keys(customFunctions));
                console.groupEnd();

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
                    const needsRecompile = !cached || cached.text !== expr.text || cached.customFunctionsStr !== JSON.stringify(customFunctions) || cached.macrosStr !== JSON.stringify(macros);
                    if (needsRecompile) {
                        const compiled = compileExpression(expr.text, customFunctions, customNames, macros);
                        console.log(`[Vectoria ODE Debug] compileExpression("${expr.text}") =>`, compiled ? `type=${compiled.type} name=${compiled.name} vars=[${compiled.vars}] hasVectorData=${!!compiled.vectorData} hasFnImplicit=${!!compiled.fnImplicit} hasConstant=${!!compiled.constantValue}` : 'NULL');
                        cached = {
                            text: expr.text,
                            customFunctionsStr: JSON.stringify(customFunctions),
                            macrosStr: JSON.stringify(macros),
                            data: compiled,
                            
                        };
                        compiledCache.set(expr.id, cached);
                        
                        // Delegate heavy GLSL compilation array to the Worker Pool
                        if (compiled && (compiled.type === 'implicit' || compiled.type === 'inequality') && !compiled.glslExpr) {
                            compilerPool.compileGLSLAsync(
                                expr.id,
                                expr.text,
                                false, // isComplex
                                customFunctions,
                                Array.from(customNames),
                                macros
                            )
                                .then((workerResult: any) => {
                                    if (workerResult.success) {
                                        const stillCached = compiledCache.get(expr.id);
                                        if (stillCached && stillCached.data) {
                                            stillCached.data.glslExpr = workerResult.glsl;
                                            stillCached.data.glslUniforms = workerResult.uniforms;
                                            // The render loop running on requestAnimationFrame will automatically pick up the new shader values
                                        }
                                    }
                                }).catch(() => {});
                        }
                    }

                    if (cached!.data) {
                        const dataVars = cached!.data.vars || [];
                        const arrayVars = dataVars.filter(v => Array.isArray(currentScope[v]));
                        
                        if (arrayVars.length > 0 && !['fourier', 'voronoi', 'delaunay', 'regression'].includes(cached!.data.type)) {
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
                                    conicData: cached!.data.conicData ? (s) => cached!.data!.conicData!(instanceScope) : undefined,
                                    labelData: cached!.data.labelData ? (s) => cached!.data!.labelData!(instanceScope) : undefined,
                                    constantValue: cached!.data.constantValue ? (s) => cached!.data!.constantValue!(instanceScope) : undefined,
                                    dataFn: cached!.data.dataFn ? (s) => cached!.data!.dataFn!(instanceScope) : undefined,
                                    lineData: cached!.data.lineData ? (s) => cached!.data!.lineData!(instanceScope) : undefined,
                                    actionExecute: cached!.data.actionExecute ? (s) => cached!.data!.actionExecute!(instanceScope) : undefined,
                                    transformExecute: cached!.data.transformExecute ? (s) => cached!.data!.transformExecute!(instanceScope) : undefined,
                                    lineWidth: expr.lineWidth,
                                    lineStyle: expr.lineStyle,
                                    pointStyle: expr.pointStyle,
                                    glslUniformsScope: instanceScope, // We'll pass this special property for WebGL to use
                                    _substitutedResult: expr.substitutedResult,
                                    _regressionParams: expr.regressionParams
                                });
                            }
                        } else {
                            equationsToDraw.push({
                                ...cached!.data,
                                id: expr.id,
                                color: expr.color,
                                lineWidth: expr.lineWidth,
                                lineStyle: expr.lineStyle,
                                pointStyle: expr.pointStyle,
                                _substitutedResult: expr.substitutedResult,
                                _regressionParams: expr.regressionParams
                            });
                        }
                    }
                }

                console.log('[Vectoria ODE Debug] equationsToDraw:', equationsToDraw.map(e => `${e.id}:${e.type}(name=${e.name})`));

                // Topological sort/injection of named variables
                let unresolved = [...equationsToDraw];
                let maxPasses = 5;
                while (unresolved.length > 0 && maxPasses > 0) {
                    const nextUnresolved = [];
                    for (const eq of unresolved) {
                        try {
                            let resStr = '';
                            if (eq.type === 'point' && eq.pointData) {
                                const ptRaw = eq.pointData(currentScope);
                                // pointData may return a single {x,y} or an array of {x,y}
                                const ptArr: {x:number,y:number}[] = Array.isArray(ptRaw) ? ptRaw : (ptRaw ? [ptRaw] : []);
                                const firstPt = ptArr.find(p => typeof p.x === 'number' && !isNaN(p.x) && typeof p.y === 'number' && !isNaN(p.y));
                                if (!firstPt) throw new Error('no valid point');
                                // Store raw result in scope (array or single point)
                                if (eq.name) currentScope[eq.name] = ptArr.length === 1 ? [firstPt.x, firstPt.y] : ptArr;
                                resStr = ptArr.length === 1
                                    ? `= (${firstPt.x.toFixed(2)}, ${firstPt.y.toFixed(2)})`
                                    : `${ptArr.length} точки`;
                            } else if (eq.type === 'line' && eq.lineData) {
                                const ld = eq.lineData(currentScope);
                                if (ld && (typeof ld.px === 'number' || typeof ld.a === 'number' || Array.isArray(ld))) {
                                    if (eq.name) currentScope[eq.name] = ld;
                                    if (typeof ld.a === 'number') {
                                        // Implicit form: ax + by = c
                                        const norm = Math.hypot(ld.a, ld.b) || 1;
                                        const an = ld.a / norm, bn = ld.b / norm, cn = ld.c / norm;
                                        resStr = `${an.toFixed(2)}x ${bn >= 0 ? '+' : '-'} ${Math.abs(bn).toFixed(2)}y = ${cn.toFixed(2)}`;
                                    } else if (typeof ld.px === 'number' && typeof ld.dx === 'number') {
                                        // Parametric form: convert normal direction (-dy, dx) → implicit
                                        const a = -ld.dy, b = ld.dx;
                                        const c = a * ld.px + b * ld.py;
                                        const norm = Math.hypot(a, b) || 1;
                                        const an = a / norm, bn = b / norm, cn = c / norm;
                                        resStr = `${an.toFixed(2)}x ${bn >= 0 ? '+' : '-'} ${Math.abs(bn).toFixed(2)}y = ${cn.toFixed(2)}`;
                                    } else if (Array.isArray(ld) && ld.length > 0) {
                                        resStr = `${ld.length} line(s)`;
                                    }
                                }
                            } else if (eq.type === 'circle' && eq.circleData) {
                                const cd = eq.circleData(currentScope);
                                if (cd && !isNaN(cd.cx)) {
                                    if (eq.name) currentScope[eq.name] = cd;
                                    resStr = `(x ${cd.cx >= 0 ? '-' : '+'} ${Math.abs(cd.cx).toFixed(2)})² + (y ${cd.cy >= 0 ? '-' : '+'} ${Math.abs(cd.cy).toFixed(2)})² = ${(cd.r * cd.r).toFixed(2)}`;
                                }
                            } else if (eq.type === 'ellipse' && eq.ellipseData) {
                                const ed = eq.ellipseData(currentScope);
                                if (ed && !isNaN(ed.cx)) {
                                    if (eq.name) currentScope[eq.name] = ed;
                                    resStr = `(x ${ed.cx >= 0 ? '-' : '+'} ${Math.abs(ed.cx).toFixed(2)})²/${(ed.rx*ed.rx).toFixed(2)} + (y ${ed.cy >= 0 ? '-' : '+'} ${Math.abs(ed.cy).toFixed(2)})²/${(ed.ry*ed.ry).toFixed(2)} = 1`;
                                }
                            } else if (eq.type === 'implicit' && eq.conicData) {
                                const cd = eq.conicData(currentScope);
                                if (cd) {
                                    if (eq.name) currentScope[eq.name] = cd;
                                    // Make uniforms available for fnImplicit and shaders
                                    currentScope['u_conic_a'] = cd.a;
                                    currentScope['u_conic_b'] = cd.b;
                                    currentScope['u_conic_c'] = cd.c;
                                    currentScope['u_conic_d'] = cd.d;
                                    currentScope['u_conic_e'] = cd.e;
                                    currentScope['u_conic_f'] = cd.f;
                                    // Save for fnImplicit
                                    currentScope['__conic_cache'] = cd;
                                    resStr = `${cd.a.toFixed(2)}x² + ${cd.b.toFixed(2)}xy + ${cd.c.toFixed(2)}y² + ${cd.d.toFixed(2)}x + ${cd.e.toFixed(2)}y + ${cd.f.toFixed(2)} = 0`;
                                }
                            } else if (eq.type === 'segment' && eq.segmentData) {
                                const sd = eq.segmentData(currentScope);
                                if (sd && !isNaN(sd.x1)) {
                                    if (eq.name) currentScope[eq.name] = sd;
                                    const len = Math.hypot(sd.x2 - sd.x1, sd.y2 - sd.y1);
                                    resStr = `Length: ${len.toFixed(2)}`;
                                }
                            } else if (eq.type === 'polygon' && eq.polygonData) {
                                const pd = eq.polygonData(currentScope);
                                if (pd) {
                                    if (eq.name) currentScope[eq.name] = pd;
                                    let area = 0;
                                    if (pd.length > 2) {
                                        for (let i = 0; i < pd.length; i++) {
                                            const j = (i + 1) % pd.length;
                                            area += pd[i].x * pd[j].y - pd[j].x * pd[i].y;
                                        }
                                        area = Math.abs(area) / 2;
                                    }
                                    resStr = `Area: ${area.toFixed(2)}`;
                                }
                            } else if (eq.type === 'integral' && eq.boundsFn && eq.fnExplicit) {
                                let bounds = [NaN, NaN];
                                try {
                                    bounds = eq.boundsFn(currentScope);
                                } catch (e) {
                                    // Ignore bounds evaluation errors (e.g., if bounds contain 'x')
                                }
                                if (!isNaN(bounds[0]) && !isNaN(bounds[1])) {
                                    const minX = Math.min(bounds[0], bounds[1]);
                                    const maxX = Math.max(bounds[0], bounds[1]);
                                    const segments = 200;
                                    const dx = (maxX - minX) / segments;
                                    let area = 0;
                                    const scalarFn = (x: number) => {
                                        let res = eq.fnExplicit!(x, currentScope);
                                        if (Array.isArray(res) || res?.toArray) {
                                            res = Array.isArray(res) ? res[0] : res.toArray()[0];
                                        }
                                        return res as number;
                                    };
                                    for (let i = 1; i < segments; i++) {
                                        area += scalarFn(minX + i * dx) * (i % 2 === 0 ? 2 : 4);
                                    }
                                    area += scalarFn(minX) + scalarFn(maxX);
                                    area *= dx / 3;
                                    if (bounds[0] > bounds[1]) area = -area;
                                    
                                    resStr = `Area: ${area.toPrecision(6).replace(/\\.0+$/, '').replace(/\\.$/, '')}`;
                                } else {
                                    resStr = 'Area: NaN';
                                }
                            } else if (eq.constantValue) {
                                const val = eq.constantValue(currentScope);
                                const isArrayOrMatrix = val && (Array.isArray(val) || typeof val.toArray === 'function');
                                if (!isArrayOrMatrix && isNaN(val as number)) throw new Error('NaN');
                                if (eq.name) currentScope[eq.name] = val;
                                
                                if ((eq as any).evaluatedExpression) {
                                    resStr = (eq as any).evaluatedExpression;
                                } else if (isArrayOrMatrix) {
                                    const arr = Array.isArray(val) ? val : val.toArray();
                                    resStr = '= ' + JSON.stringify(arr);
                                } else {
                                    resStr = `= ${Number(val).toFixed(2)}`;
                                }
                            } else if ((eq as any).evaluatedExpression) {
                                resStr = (eq as any).evaluatedExpression;
                            }
                            if (resStr && resStr !== (eq as any)._substitutedResult) {
                                expressions.updateSubstitutedResult(eq.id.split('_')[0], resStr);
                            }
                            if (eq.type === 'regression' && eq.regressionSolve) {
                                const solveData = eq.regressionSolve(currentScope, (eq as any)._regressionParams);
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
                            if (eq.type === 'transform' && eq.transformExecute) {
                                const m = eq.transformExecute(currentScope);
                                if (m) {
                                    cam.setTransform(m);
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
                    const baseId = eq.id.split('_')[0];
                    (eq as any).selected = ($selectedExpressionId !== null && baseId === $selectedExpressionId);
                    // WebGL 32-bit floats lose precision at extreme zoom levels (zoom > 50000), causing
                    // implicit equations to break into blocky artifacts. In such cases, fallback to CPU.
                    const isExtremeZoom = cam.state.zoom > 50000;
                    if (!isExtremeZoom && (eq.type === 'implicit' || eq.type === 'inequality') && eq.glslExpr) {
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
                        eq.color
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
                
                // Advance Physics Engine (or reset if paused/t=0)
                if (!$tickerActive || $timeState.t === 0) {
                    physicsEngine.reset();
                } else {
                    physicsEngine.step(dt, 5, colliders);
                }
                
                currentPois = plotExpressions(ctx!, cpuEquations, cam, width, height, currentScope, themeColors, $settings.gridType, dt);
                
                // Temporary polygon drawing
                if ($activeTool === 'polygon' && polygonPoints.length > 0) {
                    ctx!.beginPath();
                    ctx!.strokeStyle = themeColors.text;
                    ctx!.lineWidth = 2;
                    let started = false;
                    for (const ptName of polygonPoints) {
                        const val = currentScope[ptName];
                        if (val && typeof val.x === 'number') {
                            const sp = cam.mathToScreen(val.x, val.y, width, height);
                            if (!started) { ctx!.moveTo(sp.x, sp.y); started = true; }
                            else { ctx!.lineTo(sp.x, sp.y); }
                        } else if (Array.isArray(val) && val.length >= 2) {
                            const sp = cam.mathToScreen(val[0], val[1], width, height);
                            if (!started) { ctx!.moveTo(sp.x, sp.y); started = true; }
                            else { ctx!.lineTo(sp.x, sp.y); }
                        }
                    }
                    if (started) {
                        const rect = canvas.getBoundingClientRect();
                        // Draw line to current mouse pos if mouse is over canvas
                        if (currentMouseX > 0 && currentMouseY > 0) {
                            ctx!.lineTo(currentMouseX - rect.left, currentMouseY - rect.top);
                        }
                        ctx!.stroke();
                    }
                }
                
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
            const baseId = hoveredPointId.split('_')[0];
            selectedExpressionId.set(baseId);
            
            if ($activeTool === 'move') {
                draggingPointId = hoveredPointId;
                canvas.setPointerCapture(e.pointerId);
                return;
            }
        }

        if ($activeTool === 'move') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedId = null;
            let minDist = 15; // 15 pixels threshold
            
            // Check points
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.pointData) {
                    try {
                        const pData = eq.pointData(lastScope);
                        const pts = Array.isArray(pData) ? pData : [pData];
                        for (const p of pts) {
                            if (!p || typeof p.x !== 'number') continue;
                            const dx = p.x - mathP.x;
                            const dy = p.y - mathP.y;
                            const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                            if (dist < minDist) {
                                minDist = dist;
                                clickedId = eq.id;
                            }
                        }
                    } catch {}
                }
            }
            
            // Check segments
            if (!clickedId) {
                for (const eq of lastEquationsToDraw) {
                    if (eq.type === 'segment' && eq.segmentData) {
                        try {
                            const seg = eq.segmentData(lastScope);
                            if (seg) {
                                const l2 = (seg.x1 - seg.x2)**2 + (seg.y1 - seg.y2)**2;
                                let t = Math.max(0, Math.min(1, ((mathP.x - seg.x1) * (seg.x2 - seg.x1) + (mathP.y - seg.y1) * (seg.y2 - seg.y1)) / l2));
                                const projX = seg.x1 + t * (seg.x2 - seg.x1);
                                const projY = seg.y1 + t * (seg.y2 - seg.y1);
                                const dist = Math.sqrt((mathP.x - projX)**2 + (mathP.y - projY)**2) * cam.state.zoom;
                                if (dist < minDist) {
                                    minDist = dist;
                                    clickedId = eq.id;
                                }
                            }
                        } catch {}
                    }
                }
            }
            
            // Check lines
            if (!clickedId) {
                for (const eq of lastEquationsToDraw) {
                    if (eq.type === 'line' && eq.lineData) {
                        try {
                            const ld = eq.lineData(lastScope);
                            if (ld) {
                                const checkDist = (l: any) => {
                                    let dist = 1000;
                                    if ('dx' in l) {
                                        const l2 = l.dx*l.dx + l.dy*l.dy;
                                        const t = ((mathP.x - l.px) * l.dx + (mathP.y - l.py) * l.dy) / l2;
                                        const projX = l.px + t * l.dx;
                                        const projY = l.py + t * l.dy;
                                        dist = Math.sqrt((mathP.x - projX)**2 + (mathP.y - projY)**2) * cam.state.zoom;
                                    } else if ('a' in l) {
                                        const { a, b, c } = l;
                                        dist = Math.abs(a * mathP.x + b * mathP.y + c) / Math.sqrt(a * a + b * b) * cam.state.zoom;
                                    }
                                    if (dist < minDist) {
                                        minDist = dist;
                                        clickedId = eq.id;
                                    }
                                };
                                if (Array.isArray(ld)) {
                                    ld.forEach(checkDist);
                                } else {
                                    checkDist(ld);
                                }
                            }
                        } catch {}
                    }
                }
            }
            
            // Check circles
            if (!clickedId) {
                for (const eq of lastEquationsToDraw) {
                    if (eq.type === 'circle' && eq.circleData) {
                        try {
                            const cd = eq.circleData(lastScope);
                            if (cd) {
                                const distToCenter = Math.sqrt((mathP.x - cd.cx)**2 + (mathP.y - cd.cy)**2);
                                const dist = Math.abs(distToCenter - cd.r) * cam.state.zoom;
                                if (dist < minDist) {
                                    minDist = dist;
                                    clickedId = eq.id;
                                }
                            }
                        } catch {}
                    }
                }
            }

            // Check ellipses
            if (!clickedId) {
                for (const eq of lastEquationsToDraw) {
                    if (eq.type === 'ellipse' && eq.ellipseData) {
                        try {
                            const ed = eq.ellipseData(lastScope);
                            if (ed) {
                                const scaleFactor = ed.rx / ed.ry;
                                const sPt = { x: mathP.x, y: mathP.y * scaleFactor };
                                const sCenter = { x: ed.cx, y: ed.cy * scaleFactor };
                                const distToCenter = Math.sqrt((sPt.x - sCenter.x)**2 + (sPt.y - sCenter.y)**2);
                                const dist = Math.abs(distToCenter - ed.rx) * cam.state.zoom;
                                if (dist < minDist) {
                                    minDist = dist;
                                    clickedId = eq.id;
                                }
                            }
                        } catch {}
                    }
                }
            }

            // Check functions
            if (!clickedId) {
                for (const eq of lastEquationsToDraw) {
                    if (eq.type === 'explicit' && eq.fnExplicit) {
                        try {
                            const yVal = eq.fnExplicit(mathP.x, lastScope);
                            const dist = Math.abs(yVal - mathP.y) * cam.state.zoom;
                            if (dist < minDist) {
                                minDist = dist;
                                clickedId = eq.id;
                            }
                        } catch {}
                    }
                }
            }
            
            if (clickedId) {
                const baseId = clickedId.split('_')[0];
                selectedExpressionId.set(baseId);
            } else {
                selectedExpressionId.set(null);
            }
        }

        

        if ($activeTool === 'point') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            const pId = autoName('P');
            if (hoveredCurveId) {
                const target = lastEquationsToDraw.find(e => e.id === hoveredCurveId);
                if (target && target.name) {
                    expressions.addExpression(`${pId} = PointOn(${target.name}, ${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`);
                    return;
                }
            }
            expressions.addExpression(`${pId} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
            return;
        }

        if ($activeTool === 'segment') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            if (hoveredPointId) {
                const eq = lastEquationsToDraw.find(e => e.id === hoveredPointId);
                if (eq && eq.name) clickedPointName = eq.name;
            }

            if (!segmentStartPoint) {
                if (clickedPointName) {
                    segmentStartPoint = clickedPointName;
                } else {
                    const pId = autoName('P');
                    expressions.addExpression(`${pId} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    segmentStartPoint = pId;
                }
            } else {
                let endPointName = clickedPointName;
                if (!endPointName) {
                    endPointName = autoName('P');
                    expressions.addExpression(`${endPointName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                }
                if (segmentStartPoint !== endPointName) {
                    expressions.addExpression(`${autoName('s')} = Segment(${segmentStartPoint}, ${endPointName})`);
                }
                segmentStartPoint = null;
            }
            return;
        }

        if ($activeTool === 'polygon') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            if (hoveredPointId) {
                const eq = lastEquationsToDraw.find(e => e.id === hoveredPointId);
                if (eq && eq.name) clickedPointName = eq.name;
            }

            let ptName = clickedPointName;
            if (!ptName) {
                ptName = autoName('P');
                expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
            }

            // If we click the first point again, close the polygon
            if (polygonPoints.length > 2 && polygonPoints[0] === ptName) {
                for (let i = 0; i < polygonPoints.length; i++) {
                    const p1 = polygonPoints[i];
                    const p2 = polygonPoints[(i + 1) % polygonPoints.length];
                    expressions.addExpression(`${autoName('s')} = Segment(${p1}, ${p2})`);
                }
                expressions.addExpression(`${autoName('poly')} = Polygon(${polygonPoints.join(', ')})`);
                polygonPoints = [];
            } else {
                polygonPoints.push(ptName);
            }
            return;
        }

        if ($activeTool === 'circle') {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            if (hoveredPointId) {
                const eq = lastEquationsToDraw.find(e => e.id === hoveredPointId);
                if (eq && eq.name) clickedPointName = eq.name;
            }

            if (!circleStartPoint) {
                if (clickedPointName) {
                    circleStartPoint = clickedPointName;
                } else {
                    const pId = autoName('P');
                    expressions.addExpression(`${pId} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    circleStartPoint = pId;
                }
            } else {
                let endPointName = clickedPointName;
                if (!endPointName) {
                    endPointName = autoName('P');
                    expressions.addExpression(`${endPointName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                }
                if (circleStartPoint !== endPointName) {
                    expressions.addExpression(`${autoName('c')} = Circle(${circleStartPoint}, ${endPointName})`);
                }
                circleStartPoint = null;
            }
            return;
        }

        if (['line', 'perpBisector', 'perpendicular', 'parallel', 'conic', 'tangent', 'midpoint', 'circle3pts', 'intersect', 'angleBisector'].includes($activeTool)) {
            const rect = canvas.getBoundingClientRect();
            const mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            let clickedPointName = null;
            let clickedLineName = null;
            let clickedCurveName = null;
            
            const HIT_PX = 15;
            let minDist = HIT_PX;

            // Direct point hit test
            for (const eq of lastEquationsToDraw) {
                if (eq.type === 'point' && eq.pointData) {
                    try {
                        const pData = eq.pointData(lastScope);
                        const pts = Array.isArray(pData) ? pData : [pData];
                        for (const p of pts) {
                            if (!p || typeof p.x !== 'number') continue;
                            const d = Math.hypot(p.x - mathP.x, p.y - mathP.y) * cam.state.zoom;
                            if (d < minDist) { minDist = d; clickedPointName = eq.name; }
                        }
                    } catch {}
                }
            }

            // Direct curve hit test
            if (!clickedPointName) {
                for (const eq of lastEquationsToDraw) {
                    try {
                        let hit = false;
                        if (eq.type === 'segment' && eq.segmentData) {
                            const seg = eq.segmentData(lastScope);
                            if (seg) {
                                const l2 = (seg.x2 - seg.x1)**2 + (seg.y2 - seg.y1)**2;
                                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mathP.x - seg.x1)*(seg.x2 - seg.x1) + (mathP.y - seg.y1)*(seg.y2 - seg.y1)) / l2)) : 0;
                                if (Math.hypot(mathP.x - (seg.x1 + t*(seg.x2 - seg.x1)), mathP.y - (seg.y1 + t*(seg.y2 - seg.y1))) * cam.state.zoom < HIT_PX) hit = true;
                            }
                        } else if (eq.type === 'line' && eq.lineData) {
                            const ld = eq.lineData(lastScope);
                            const lines = Array.isArray(ld) ? ld : (ld ? [ld] : []);
                            for (const l of lines) {
                                if (typeof l.a === 'number') {
                                    if (Math.abs(l.a * mathP.x + l.b * mathP.y + l.c) / Math.hypot(l.a, l.b) * cam.state.zoom < HIT_PX) hit = true;
                                } else if (typeof l.px === 'number') {
                                    const dlen = Math.hypot(l.dx, l.dy);
                                    if (dlen > 0 && Math.abs((-l.dy/dlen)*(mathP.x - l.px) + (l.dx/dlen)*(mathP.y - l.py)) * cam.state.zoom < HIT_PX) hit = true;
                                }
                            }
                        } else if (eq.type === 'circle' && eq.circleData) {
                            const cd = eq.circleData(lastScope);
                            if (cd && Math.abs(Math.hypot(mathP.x - cd.cx, mathP.y - cd.cy) - cd.r) * cam.state.zoom < HIT_PX) hit = true;
                        } else if (eq.type === 'ellipse' && eq.ellipseData) {
                            const ed = eq.ellipseData(lastScope);
                            if (ed) {
                                const nx = (mathP.x - ed.cx) / (ed.rx || 1), ny = (mathP.y - ed.cy) / (ed.ry || 1);
                                if ((Math.abs(nx*nx + ny*ny - 1) / Math.hypot(2*nx/ed.rx, 2*ny/ed.ry)) * cam.state.zoom < HIT_PX) hit = true;
                            }
                        } else if ((eq.type === 'implicit' || eq.type === 'conic') && eq.fnImplicit) {
                            const v = eq.fnImplicit(mathP.x, mathP.y, lastScope);
                            const eps = 1.0 / cam.state.zoom;
                            const gx = (eq.fnImplicit(mathP.x + eps, mathP.y, lastScope) - v) / eps;
                            const gy = (eq.fnImplicit(mathP.x, mathP.y + eps, lastScope) - v) / eps;
                            if ((Math.abs(v) / (Math.hypot(gx, gy) || 1)) * cam.state.zoom < HIT_PX) hit = true;
                        } else if (eq.type === 'explicit' && eq.fnExplicit) {
                            const y = eq.fnExplicit(mathP.x, lastScope);
                            if (!isNaN(y) && Math.abs(mathP.y - y) * cam.state.zoom < HIT_PX) hit = true;
                        }
                        if (hit) {
                            if (eq.type === 'line' || eq.type === 'segment') clickedLineName = eq.name;
                            clickedCurveName = eq.name;
                            break;
                        }
                    } catch {}
                }
            }

            if ($activeTool === 'intersect') {
                const targetName = clickedLineName || clickedCurveName;
                if (targetName && !intersectLines.includes(targetName)) {
                    intersectLines.push(targetName);
                    if (intersectLines.length === 2) {
                        expressions.addExpression(`${autoName('P')} = Intersect(${intersectLines[0]}, ${intersectLines[1]}, [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}])`);
                        intersectLines = [];
                    }
                }
                return;
            } else if ($activeTool === 'angleBisector') {
                if (clickedLineName) {
                    angleBisectorPoints = [];
                    intersectLines.push(clickedLineName);
                    if (intersectLines.length === 2) {
                        expressions.addExpression(`${autoName('L')} = AngleBisector(${intersectLines[0]}, ${intersectLines[1]})`);
                        intersectLines = [];
                    }
                } else {
                    intersectLines = [];
                    let ptName = clickedPointName;
                    if (!ptName) {
                        ptName = autoName('P');
                        expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    }
                    angleBisectorPoints.push(ptName);
                    if (angleBisectorPoints.length === 3) {
                        expressions.addExpression(`${autoName('L')} = AngleBisector(${angleBisectorPoints.join(', ')})`);
                        angleBisectorPoints = [];
                    }
                }
                return;
            } else if ($activeTool === 'perpendicular') {
                if (clickedLineName && !perpendicularObjects.includes(clickedLineName)) {
                    perpendicularObjects.push(clickedLineName);
                } else {
                    let ptName = clickedPointName;
                    if (!ptName) {
                        ptName = autoName('P');
                        expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    }
                    if (!perpendicularObjects.includes(ptName)) {
                        perpendicularObjects.push(ptName);
                    }
                }
                
                if (perpendicularObjects.length === 2) {
                    expressions.addExpression(`${autoName('L')} = Perpendicular(${perpendicularObjects[0]}, ${perpendicularObjects[1]})`);
                    perpendicularObjects = [];
                }
                return;
            } else if ($activeTool === 'parallel') {
                if (clickedLineName && !parallelObjects.includes(clickedLineName)) {
                    parallelObjects.push(clickedLineName);
                } else {
                    let ptName = clickedPointName;
                    if (!ptName) {
                        ptName = autoName('P');
                        expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    }
                    if (!parallelObjects.includes(ptName)) {
                        parallelObjects.push(ptName);
                    }
                }
                
                if (parallelObjects.length === 2) {
                    expressions.addExpression(`${autoName('L')} = Parallel(${parallelObjects[0]}, ${parallelObjects[1]})`);
                    parallelObjects = [];
                }
                return;
            } else if ($activeTool === 'conic') {
                let targetName = null;
                if (clickedLineName) targetName = clickedLineName;
                else if (clickedCurveName) targetName = clickedCurveName;
                else {
                    let ptName = clickedPointName;
                    if (!ptName) {
                        const SNAP_PX = 20;
                        for (let i = lastEquationsToDraw.length - 1; i >= 0; i--) {
                            const ceq = lastEquationsToDraw[i];
                            if (ceq.name && ceq.type === 'point' && ceq.pointData) {
                                try {
                                    const pRaw = ceq.pointData(lastScope);
                                    const pts = Array.isArray(pRaw) ? pRaw : (pRaw ? [pRaw] : []);
                                    const hit = pts.some(p => p && typeof p.x === 'number' &&
                                        Math.hypot(p.x - mathP.x, p.y - mathP.y) * cam.state.zoom < SNAP_PX);
                                    if (hit) { ptName = ceq.name; break; }
                                } catch {}
                            }
                        }
                    }
                    if (!ptName) {
                        ptName = autoName('P');
                        expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
                    }
                    targetName = ptName;
                }
                if (!conicPoints.includes(targetName)) {
                    conicPoints.push(targetName);
                }
                if (conicPoints.length === 5) {
                    expressions.addExpression(`${autoName('c')} = Conic(${conicPoints.join(', ')})`);
                    conicPoints = [];
                }
                return;
            }

            let startState = $activeTool === 'line' ? lineStartPoint : ($activeTool === 'perpBisector' ? perpBisectorStartPoint : ($activeTool === 'tangent' ? tangentStartPoint : null));
            if ($activeTool === 'tangent' && !startState) {
                if (clickedLineName) { tangentStartPoint = clickedLineName; return; }
                if (clickedCurveName) { tangentStartPoint = clickedCurveName; return; }
            }
            let ptName = clickedPointName;
            
            if (!ptName && !( $activeTool === 'tangent' && startState && (clickedLineName || clickedCurveName) )) {
                ptName = autoName('P');
                expressions.addExpression(`${ptName} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`);
            }

            if ($activeTool === 'circle3pts') {
                if (clickedLineName) {
                    circle3PtsPoints.push(clickedLineName);
                } else if (clickedCurveName) {
                    circle3PtsPoints.push(clickedCurveName);
                } else {
                    circle3PtsPoints.push(ptName);
                }
                if (circle3PtsPoints.length === 3) {
                    expressions.addExpression(`${autoName('c')} = Circle(${circle3PtsPoints.join(', ')})`);
                    circle3PtsPoints = [];
                }
                return;
            }
            if ($activeTool === 'midpoint') {
                if (clickedLineName && midpointPoints.length === 0) {
                    const midPtId = autoName('P');
                    expressions.addExpression(`${midPtId} = Midpoint(${clickedLineName})`);
                    return;
                }
                midpointPoints.push(ptName);
                if (midpointPoints.length === 2) {
                    const midPtId = autoName('P');
                    expressions.addExpression(`${midPtId} = Midpoint(${midpointPoints[0]}, ${midpointPoints[1]})`);
                    midpointPoints = [];
                }
                return;
            }

            if (!startState) {
                if ($activeTool === 'line') lineStartPoint = ptName;
                else if ($activeTool === 'perpBisector') perpBisectorStartPoint = ptName;
                else if ($activeTool === 'tangent') tangentStartPoint = ptName;
            } else {
                if ($activeTool === 'line') {
                    expressions.addExpression(`${autoName('L')} = Line(${startState}, ${ptName})`);
                    lineStartPoint = null;
                } else if ($activeTool === 'perpBisector') {
                    expressions.addExpression(`${autoName('L')} = PerpendicularBisector(${startState}, ${ptName})`);
                    perpBisectorStartPoint = null;
                } else if ($activeTool === 'tangent') {
                     const target = clickedLineName || clickedCurveName || ptName;
                     const src = tangentStartPoint;
                     tangentStartPoint = null;
                     // Create two indexed expressions so each tangent is an independent line object.
                     // If only one tangent exists (point on conic), the second expression evaluates to null silently.
                     const n1 = autoName('L');
                     const n2 = autoName('L');
                     expressions.addExpression(`${n1} = Tangent(${src}, ${target}, 1)`);
                     expressions.addExpression(`${n2} = Tangent(${src}, ${target}, 2)`);
                }
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
                        const pRaw = eq.pointData(lastScope);
                        const pts = Array.isArray(pRaw) ? pRaw : (pRaw ? [pRaw] : []);
                        let hit = false;
                        for (const p of pts) {
                            if (!p || typeof p.x !== 'number') continue;
                            const dx = p.x - mathP.x;
                            const dy = p.y - mathP.y;
                            const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                            if (dist < 15) { hit = true; break; }
                        }
                        if (hit) {
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
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;

        if (draggingPointId) {
            let mathP = cam.screenToMath(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
            
            // Snapping logic
            const snapThreshold = 10 / cam.state.zoom; // 10 pixels snapping distance
            if (Math.abs(mathP.x - Math.round(mathP.x)) < snapThreshold) mathP.x = Math.round(mathP.x);
            if (Math.abs(mathP.y - Math.round(mathP.y)) < snapThreshold) mathP.y = Math.round(mathP.y);
            if (Math.abs(mathP.x) < snapThreshold) mathP.x = 0;
            if (Math.abs(mathP.y) < snapThreshold) mathP.y = 0;

            if (draggingPointId.includes('_pt_')) {
                const [tableId, ptStr, indexStr] = draggingPointId.split('_');
                const ptIndex = parseInt(indexStr);
                const expr = $expressions.find(ex => ex.id === tableId);
                if (expr && expr.type === 'table') {
                    expressions.updateTablePoint(tableId, ptIndex, parseFloat(mathP.x.toFixed(2)), parseFloat(mathP.y.toFixed(2)));
                }
            } else {
                const eq = lastEquationsToDraw.find(eq => eq.id === draggingPointId);
                if (eq) {
                    const expr = $expressions.find(ex => ex.id === eq.id);
                    let newText = eq.name ? `${eq.name} = [${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]` : `[${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)}]`;
                    if (expr && expr.text.includes('PointOn')) {
                        const match = expr.text.match(/(PointOn\s*\([^,]+)(?:,\s*[-\d.]+\s*,\s*[-\d.]+\s*)?\)/i);
                        if (match) {
                            newText = eq.name ? `${eq.name} = ${match[1]}, ${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})` : `${match[1]}, ${mathP.x.toFixed(2)}, ${mathP.y.toFixed(2)})`;
                        }
                    }
                    expressions.updateText(eq.id, newText, newText);
                }
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
            // Check table points
            if (!foundPoint) {
                const activeTables = $expressions.filter(e => e.type === 'table');
                for (const table of activeTables) {
                    if (!table.visible || !table.points) continue;
                    for (let i = 0; i < table.points.length; i++) {
                        const p = table.points[i];
                        if (p.x === null || p.y === null) continue;
                        const dx = p.x - mathP.x;
                        const dy = p.y - mathP.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) * cam.state.zoom;
                        if (dist < 15) {
                            foundPoint = `${table.id}_pt_${i}`;
                            break;
                        }
                    }
                    if (foundPoint) break;
                }
            }

            /**
             * @brief Hover detection for selectable (non-draggable) geometric objects.
             * @details Checks lines, segments, circles, ellipses, explicit functions,
             *          implicit curves, parametric curves and conics for cursor proximity.
             *          Uses pixel-space distance threshold to decide cursor feedback.
             */
            hoveredCurveId = null;
            let hoveredCurve: string | null = null;
            if (!foundPoint) {
                const HIT_PX = 12; // pixel hit threshold
                for (const eq of lastEquationsToDraw) {
                    try {
                        if (eq.type === 'segment' && eq.segmentData) {
                            const seg = eq.segmentData(lastScope);
                            if (seg) {
                                const l2 = (seg.x2 - seg.x1)**2 + (seg.y2 - seg.y1)**2;
                                const t = l2 > 0 ? Math.max(0, Math.min(1, ((mathP.x - seg.x1)*(seg.x2 - seg.x1) + (mathP.y - seg.y1)*(seg.y2 - seg.y1)) / l2)) : 0;
                                const px = seg.x1 + t*(seg.x2 - seg.x1);
                                const py = seg.y1 + t*(seg.y2 - seg.y1);
                                if (Math.hypot(mathP.x - px, mathP.y - py) * cam.state.zoom < HIT_PX) { hoveredCurve = eq.id; break; }
                            }
                        } else if (eq.type === 'line' && eq.lineData) {
                            const ld = eq.lineData(lastScope);
                            const lines = Array.isArray(ld) ? ld : (ld ? [ld] : []);
                            for (const l of lines) {
                                if (typeof l.a === 'number') {
                                    // Implicit line ax + by = c: perpendicular pixel distance
                                    const dist = Math.abs(l.a * mathP.x + l.b * mathP.y + l.c) / Math.hypot(l.a, l.b) * cam.state.zoom;
                                    if (dist < HIT_PX) { hoveredCurve = eq.id; break; }
                                } else if (typeof l.px === 'number') {
                                    // Parametric line through (px,py) in direction (dx,dy)
                                    const dlen = Math.hypot(l.dx, l.dy);
                                    if (dlen > 0) {
                                        const nx = -l.dy / dlen, ny = l.dx / dlen;
                                        const dist = Math.abs(nx*(mathP.x - l.px) + ny*(mathP.y - l.py)) * cam.state.zoom;
                                        if (dist < HIT_PX) { hoveredCurve = eq.id; break; }
                                    }
                                }
                            }
                            if (hoveredCurve) break;
                        } else if (eq.type === 'circle' && eq.circleData) {
                            const cd = eq.circleData(lastScope);
                            if (cd) {
                                const distToEdge = Math.abs(Math.hypot(mathP.x - cd.cx, mathP.y - cd.cy) - cd.r) * cam.state.zoom;
                                if (distToEdge < HIT_PX) { hoveredCurve = eq.id; break; }
                            }
                        } else if (eq.type === 'ellipse' && eq.ellipseData) {
                            const ed = eq.ellipseData(lastScope);
                            if (ed) {
                                // Normalised distance via gradient of ellipse equation
                                const nx = (mathP.x - ed.cx) / (ed.rx || 1);
                                const ny = (mathP.y - ed.cy) / (ed.ry || 1);
                                const val = Math.abs(nx*nx + ny*ny - 1);
                                const gradX = 2*nx/ed.rx, gradY = 2*ny/ed.ry;
                                const gradLen = Math.hypot(gradX, gradY) || 1;
                                if ((val / gradLen) * cam.state.zoom < HIT_PX) { hoveredCurve = eq.id; break; }
                            }
                        } else if ((eq.type === 'explicit' || eq.type === 'regression') && eq.fnExplicit) {
                            // Vertical pixel distance from cursor to function value
                            const y = eq.fnExplicit(mathP.x, lastScope);
                            if (!isNaN(y) && Math.abs(mathP.y - y) * cam.state.zoom < HIT_PX) { hoveredCurve = eq.id; break; }
                        } else if ((eq.type === 'implicit' || eq.type === 'conic') && eq.fnImplicit) {
                            // |F(p)| / |∇F| gives approximate pixel distance to implicit curve
                            const v = eq.fnImplicit(mathP.x, mathP.y, lastScope);
                            const eps = 1.0 / cam.state.zoom; // 1 pixel in math coordinates
                            const gx = (eq.fnImplicit(mathP.x + eps, mathP.y, lastScope) - v) / eps;
                            const gy = (eq.fnImplicit(mathP.x, mathP.y + eps, lastScope) - v) / eps;
                            const gl = Math.hypot(gx, gy) || 1;
                            if ((Math.abs(v) / gl) * cam.state.zoom < HIT_PX) { hoveredCurve = eq.id; break; }
                        } else if (eq.type === 'parametric' && eq.fnParametric) {
                            // Sample 200 points along parameter range and find closest
                            const bounds = eq.paramBounds || [0, 2 * Math.PI];
                            const steps = 200;
                            const dt2 = (bounds[1] - bounds[0]) / steps;
                            let minD = Infinity;
                            for (let i = 0; i <= steps; i++) {
                                const p = eq.fnParametric(bounds[0] + i * dt2, lastScope);
                                const d = Math.hypot(p.x - mathP.x, p.y - mathP.y);
                                if (d < minD) minD = d;
                            }
                            if (minD * cam.state.zoom < HIT_PX) { hoveredCurve = eq.id; break; }
                        }
                    } catch {}
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

            hoveredCurveId = hoveredCurve;
            canvas.style.cursor = hoveredPointId || hoveredCurveId || activeTooltip ? 'pointer' : 'grab';
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
        touch-action: none;
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

    @media (max-width: 768px) {
        .zoom-controls {
            display: none;
        }
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
