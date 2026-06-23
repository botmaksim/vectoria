<script lang="ts">
    /**
     * @file TutorialModal.svelte
     * @brief Explanatory modal providing a tutorial and searchable function reference.
     * @details Uses localized strings to guide users through the application's functionality.
     */

    import { t, locale } from '../../state/i18n';
    import { fade, scale } from 'svelte/transition';

    export let onClose: () => void;

    let activeTab: 'guide' | 'reference' = 'guide';

    // Steps for guide
    let currentStep = 0;
    const steps = [
        { title: 'tutorial_eqs', icon: '📝' },
        { title: 'tutorial_vars', icon: '🎚️' },
        { title: 'tutorial_matrix', icon: '🌐' },
        { title: 'tutorial_data', icon: '📈' },
        { title: 'tutorial_tools', icon: '📐' },
        { title: 'tutorial_cas', icon: '🧮' },
        { title: 'tutorial_piecewise', icon: '🧩' },
        { title: 'tutorial_calculus', icon: '∫' },
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

    // Reference items
    let searchQuery = '';
    let selectedCategory: 'all' | 'geometry' | 'physics' | 'analysis' | 'calculus' = 'all';

    const referenceItems = [
        {
            name: 'Parallel',
            category: 'geometry',
            syntax: 'Parallel(Point, Line) or Parallel(Line, Point)',
            desc_en: 'Creates a line parallel to the given line passing through the specified point.',
            desc_ru: 'Создает прямую, параллельную данной прямой, проходящую через указанную точку.',
            example: 'L_{1} = Parallel(P_{1}, L_{2})'
        },
        {
            name: 'Conic',
            category: 'geometry',
            syntax: 'Conic(A, B, C, D, E)',
            desc_en: 'Fits a conic section (ellipse, parabola, or hyperbola) passing through 5 points.',
            desc_ru: 'Строит коническое сечение (эллипс, парабола, гипербола) через 5 заданных точек.',
            example: 'c_{1} = Conic(A, B, C, D, E)'
        },
        {
            name: 'Line',
            category: 'geometry',
            syntax: 'Line(Point1, Point2)',
            desc_en: 'Creates an infinite straight line passing through two points.',
            desc_ru: 'Создает бесконечную прямую, проходящую через две точки.',
            example: 'L_{1} = Line(A, B)'
        },
        {
            name: 'Segment',
            category: 'geometry',
            syntax: 'Segment(Point1, Point2)',
            desc_en: 'Creates a line segment between two points.',
            desc_ru: 'Создает отрезок между двумя точками.',
            example: 's_{1} = Segment(A, B)'
        },
        {
            name: 'Circle',
            category: 'geometry',
            syntax: 'Circle(Center, Point) or Circle(Center, Radius)',
            desc_en: 'Creates a circle with a specified center and passing through a point, or with a fixed radius value.',
            desc_ru: 'Создает окружность с заданным центром, проходящую через точку, либо с фиксированным радиусом.',
            example: 'c_{1} = Circle(O, A)'
        },
        {
            name: 'Perpendicular',
            category: 'geometry',
            syntax: 'Perpendicular(Point, Line) or Perpendicular(Line, Point)',
            desc_en: 'Creates a line perpendicular to the given line passing through the point.',
            desc_ru: 'Создает прямую, перпендикулярную данной прямой, проходящую через указанную точку.',
            example: 'L_{1} = Perpendicular(P_{1}, L_{2})'
        },
        {
            name: 'PerpendicularBisector',
            category: 'geometry',
            syntax: 'PerpendicularBisector(Point1, Point2) or PerpendicularBisector(Segment)',
            desc_en: 'Creates a perpendicular bisector of a segment or two points.',
            desc_ru: 'Создает срединный перпендикуляр к отрезку или между двумя точками.',
            example: 'L_{1} = PerpendicularBisector(A, B)'
        },
        {
            name: 'AngleBisector',
            category: 'geometry',
            syntax: 'AngleBisector(A, B, C) or AngleBisector(Line1, Line2)',
            desc_en: 'Creates angle bisectors. For three points, bisects angle ABC. For two lines, returns both bisector lines.',
            desc_ru: 'Создает биссектрисы угла. Для трех точек строит биссектрису угла ABC. Для двух прямых возвращает обе биссектрисы.',
            example: 'L_{1} = AngleBisector(A, B, C)'
        },
        {
            name: 'Midpoint',
            category: 'geometry',
            syntax: 'Midpoint(Point1, Point2) or Midpoint(Segment)',
            desc_en: 'Calculates the midpoint coordinates of a segment or between two points.',
            desc_ru: 'Находит середину отрезка или среднюю точку между двумя точками.',
            example: 'M_{1} = Midpoint(A, B)'
        },
        {
            name: 'Tangent',
            category: 'geometry',
            syntax: 'Tangent(Point, Curve)',
            desc_en: 'Creates tangent lines from a point to a circle, ellipse, or mathematical function.',
            desc_ru: 'Создает касательные линии из точки к окружности, эллипсу или математической функции.',
            example: 'L_{1} = Tangent(A, c_{1})'
        },
        {
            name: 'Intersect',
            category: 'geometry',
            syntax: 'Intersect(Line1, Line2)',
            desc_en: 'Finds the intersection point of two lines, segments, or circles.',
            desc_ru: 'Находит точку пересечения двух прямых, отрезков или окружностей.',
            example: 'P_{1} = Intersect(L_{1}, L_{2})'
        },
        {
            name: 'VectorField',
            category: 'physics',
            syntax: 'VectorField(u(x, y), v(x, y))',
            desc_en: 'Creates a 2D vector field with custom horizontal and vertical components.',
            desc_ru: 'Создает двумерное векторное поле с заданными горизонтальной и вертикальной компонентами.',
            example: 'VectorField(-y, x)'
        },
        {
            name: 'PhysicsNode',
            category: 'physics',
            syntax: 'PhysicsNode(name, x, y, pinned)',
            desc_en: 'Creates a point mass node inside the Verlet physics engine. Pinned nodes act as fixed pivots.',
            desc_ru: 'Создает материальную точку для физического движка Верле. Закрепленные узлы действуют как неподвижные опоры.',
            example: 'PhysicsNode("Pivot", 0, 5, true)'
        },
        {
            name: 'PhysicsLink',
            category: 'physics',
            syntax: 'PhysicsLink(nodeA, nodeB, length)',
            desc_en: 'Creates a rigid constraint/spring link between two physical nodes.',
            desc_ru: 'Создает пружинную связь между двумя физическими узлами.',
            example: 'PhysicsLink("Pivot", "Mass1", 5)'
        },
        {
            name: 'Fourier',
            category: 'analysis',
            syntax: 'Fourier(x_array, y_array)',
            desc_en: 'Generates DFT epicycle animations that draw the path formed by point arrays.',
            desc_ru: 'Создает эпициклы на основе ДПФ, которые прорисовывают контур, заданный массивом координат.',
            example: 'Fourier(x1, y1)'
        },
        {
            name: 'Voronoi',
            category: 'analysis',
            syntax: 'Voronoi(x_array, y_array)',
            desc_en: 'Generates Voronoi cells dynamically from arrays of x and y coordinates.',
            desc_ru: 'Динамически строит диаграмму Вороного по координатным массивам точек.',
            example: 'Voronoi(x1, y1)'
        },
        {
            name: 'Delaunay',
            category: 'analysis',
            syntax: 'Delaunay(x_array, y_array)',
            desc_en: 'Renders Delaunay triangulation mesh from coordinate arrays.',
            desc_ru: 'Строит триангуляцию Делоне по координатным массивам точек.',
            example: 'Delaunay(x1, y1)'
        },
        {
            name: 'int',
            category: 'calculus',
            syntax: 'int(expr, variable, a, b)',
            desc_en: 'Calculates the definite integral of expr with respect to variable from a to b.',
            desc_ru: 'Находит определенный интеграл выражения по переменной в пределах от a до b.',
            example: 'int(x^2, x, 0, 5)'
        },
        {
            name: 'derivative',
            category: 'calculus',
            syntax: 'derivative(expr, variable)',
            desc_en: 'Calculates the analytical symbolic derivative of expr with respect to variable.',
            desc_ru: 'Находит символьную аналитическую производную выражения по переменной.',
            example: 'derivative(sin(x), x)'
        },
        {
            name: 'Transform',
            category: 'analysis',
            syntax: 'Transform(M)',
            desc_en: 'Applies a global 2D linear transformation matrix to geometric coordinates dynamically.',
            desc_ru: 'Применяет глобальную матрицу линейного двумерного преобразования к геометрическим координатам.',
            example: 'Transform([[1, 0.5], [0, 1]])'
        },
        {
            name: 'Polygon',
            category: 'geometry',
            syntax: 'Polygon(Point1, Point2, ...)',
            desc_en: 'Creates a filled polygon connecting the specified sequence of points.',
            desc_ru: 'Создает закрашенный многоугольник, соединяя указанную последовательность точек.',
            example: 'Polygon((0,0), (2,0), (1,2))'
        },
        {
            name: 'Label',
            category: 'geometry',
            syntax: 'Label(x, y, "Text")',
            desc_en: 'Renders a custom text label at the specified coordinates.',
            desc_ru: 'Отображает произвольный текстовый ярлык по заданным координатам.',
            example: 'Label(2, 3, "My Point")'
        },
        {
            name: 'PhysicsCloth',
            category: 'physics',
            syntax: 'PhysicsCloth(startX, startY, rows, cols, spacing, [pinned_i, pinned_j...])',
            desc_en: 'Creates a 2D cloth lattice simulated via physics constraints. Additional pairs of integers specify pinned node indices.',
            desc_ru: 'Создает двумерную сетку ткани для физической симуляции. Дополнительные пары чисел задают индексы закрепленных узлов.',
            example: 'PhysicsCloth(0, 5, 5, 5, 1, 0, 0, 0, 4)'
        },
        {
            name: 'ODE',
            category: 'calculus',
            syntax: 'ODE(dx/dt, dy/dt)',
            desc_en: 'Defines a system of Ordinary Differential Equations. Generates a phase portrait and solves numerically.',
            desc_ru: 'Задает систему обыкновенных дифференциальных уравнений. Строит фазовый портрет и решает численно.',
            example: 'ODE(y, -x)'
        },
        {
            name: 'Regression (~)',
            category: 'analysis',
            syntax: 'y_1 ~ expr',
            desc_en: 'Fits parameters to a dataset using statistical regression. Define a table first, then use the ~ operator.',
            desc_ru: 'Подбирает параметры для набора данных с помощью статистической регрессии. Сначала задайте таблицу, затем используйте оператор ~.',
            example: 'y_1 ~ a*x_1^2 + b*x_1 + c'
        }
    ];

    $: filteredItems = referenceItems.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ($locale === 'ru' ? item.desc_ru : item.desc_en).toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.syntax.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    let expandedItem: string | null = null;
    function toggleExpand(name: string) {
        if (expandedItem === name) {
            expandedItem = null;
        } else {
            expandedItem = name;
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={onClose}>
    <div class="modal-content" transition:scale={{ duration: 200, start: 0.95 }} on:click|stopPropagation>
        
        <div class="modal-tabs">
            <button class="tab-btn" class:active={activeTab === 'guide'} on:click={() => activeTab = 'guide'}>
                {$t('tab_guide')}
            </button>
            <button class="tab-btn" class:active={activeTab === 'reference'} on:click={() => activeTab = 'reference'}>
                {$t('tab_reference')}
            </button>
        </div>

        {#if activeTab === 'guide'}
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
        {:else}
            <h2>{$t('tab_reference')}</h2>
            
            <div class="reference-controls">
                <input 
                    type="text" 
                    placeholder={$t('search_placeholder')} 
                    bind:value={searchQuery}
                    class="search-input"
                />
                
                <div class="category-filters">
                    <button class="filter-btn" class:active={selectedCategory === 'all'} on:click={() => selectedCategory = 'all'}>All</button>
                    <button class="filter-btn" class:active={selectedCategory === 'geometry'} on:click={() => selectedCategory = 'geometry'}>Geometry</button>
                    <button class="filter-btn" class:active={selectedCategory === 'physics'} on:click={() => selectedCategory = 'physics'}>Physics</button>
                    <button class="filter-btn" class:active={selectedCategory === 'analysis'} on:click={() => selectedCategory = 'analysis'}>Analysis</button>
                    <button class="filter-btn" class:active={selectedCategory === 'calculus'} on:click={() => selectedCategory = 'calculus'}>Calculus</button>
                </div>
            </div>

            <div class="reference-list">
                {#each filteredItems as item}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div class="ref-item" class:expanded={expandedItem === item.name} on:click={() => toggleExpand(item.name)}>
                        <div class="ref-header">
                            <span class="ref-name">{item.name}</span>
                            <span class="ref-syntax">{item.syntax}</span>
                            <span class="expand-arrow">{expandedItem === item.name ? '▼' : '▶'}</span>
                        </div>
                        {#if expandedItem === item.name}
                            <div class="ref-body" transition:fade={{ duration: 150 }}>
                                <p class="ref-desc">{$locale === 'ru' ? item.desc_ru : item.desc_en}</p>
                                <div class="ref-example">
                                    <span class="example-label">{$t('example_label')}</span>
                                    <code>{item.example}</code>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="actions">
                <button class="primary-btn" on:click={onClose}>{$t('tutorial_skip')}</button>
            </div>
        {/if}
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
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
    }
    h2 {
        margin-top: 0;
        color: var(--text-primary);
        text-align: center;
        font-size: 1.5rem;
    }
    .modal-tabs {
        display: flex;
        border-bottom: 2px solid var(--border-color);
        margin-bottom: 20px;
        gap: 16px;
        justify-content: center;
    }
    .tab-btn {
        background: transparent;
        border: none;
        padding: 8px 16px;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        transition: color 0.2s, border-bottom 0.2s;
        border-bottom: 3px solid transparent;
        border-radius: 0;
    }
    .tab-btn:hover {
        color: var(--text-primary);
    }
    .tab-btn.active {
        color: var(--accent-color);
        border-bottom: 3px solid var(--accent-color);
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
    .reference-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
    }
    .search-input {
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--bg-surface-hover);
        color: var(--text-primary);
        font-size: 0.95rem;
    }
    .search-input:focus {
        outline: none;
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent);
    }
    .category-filters {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding-bottom: 4px;
    }
    .filter-btn {
        padding: 4px 10px;
        font-size: 0.8rem;
        border-radius: 20px;
        border: 1px solid var(--border-color);
        background: var(--bg-surface);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }
    .filter-btn.active {
        background: var(--accent-color);
        color: white;
        border-color: var(--accent-color);
    }
    .reference-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 24px;
        max-height: 300px;
        padding-right: 4px;
    }
    /* Custom scrollbar for list */
    .reference-list::-webkit-scrollbar {
        width: 6px;
    }
    .reference-list::-webkit-scrollbar-track {
        background: transparent;
    }
    .reference-list::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 3px;
    }
    .ref-item {
        background: var(--bg-surface-hover);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 14px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
    }
    .ref-item:hover {
        border-color: var(--accent-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .ref-item.expanded {
        border-color: var(--accent-color);
        background: var(--bg-surface);
    }
    .ref-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .ref-name {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--text-primary);
        min-width: 80px;
    }
    .ref-syntax {
        font-family: monospace;
        font-size: 0.85rem;
        color: var(--accent-color);
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .expand-arrow {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    .ref-body {
        margin-top: 10px;
        border-top: 1px dashed var(--border-color);
        padding-top: 10px;
    }
    .ref-desc {
        font-size: 0.9rem;
        color: var(--text-secondary);
        line-height: 1.4;
        margin: 0 0 10px 0;
        text-align: left;
    }
    .ref-example {
        background: var(--bg-canvas);
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-left: 3px solid var(--accent-color);
        text-align: left;
    }
    .example-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: bold;
        text-transform: uppercase;
    }
    code {
        color: var(--text-primary);
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
