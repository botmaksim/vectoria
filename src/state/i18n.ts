/**
 * @file i18n.ts
 * @brief Internationalization and localization subsystem.
 * @details Manages UI translation dictionaries and tracks the currently active user locale.
 */

import { writable, derived } from 'svelte/store';
import { Logger } from '../utils/logger';

/**
 * @brief Static translation dictionary mapped by locale and translation key.
 */
export const translations = {
    en: {
        title: 'Vectoria',
        equations: 'Equations',
        variables: 'Variables',
        add: '+ Add',
        placeholder: 'f(x) = ...',
        help: 'Help / Tutorial',
        tutorial_title: 'Vectoria User Guide & Capabilities Tracker',
        tutorial_eqs: 'Equations & Shaders: Declare custom functions (e.g. f(x) = x^2) to reuse them dynamically in other expressions, derivatives, or CAS panels. Supports explicit and implicit equations (x^2 + y^2 = 25). WebGL asynchronously compiles ASTs into GLSL fragment shaders via a dedicated WebWorker pool to strictly maintain UI operational limits.',
        tutorial_matrix: 'Matrices & Transforms: Apply global linear algebras! Construct matrices natively [[a, b], [c, d]] and invoke Transform(mat) to uniformly manipulate screen rendering layouts dynamically.',
        tutorial_data: 'Data Science & Arrays: Interpolate topologies importing mass datasets via UI Tables. Evaluate regressions dynamically and enact Fourier(Id), Voronoi(Id), or Delaunay(Id) structural maps natively.',
        tutorial_vars: 'Variables & Flow: Declare unbound chars to instantiate interpolative UI sliders. Activate temporal Play controls to compute runtime sweeps.',
        tutorial_tools: 'Geometry & Physics: Construct Segments, Bisectors, and evaluate logic limits on-canvas. Use PhysicsNode("A",x,y,pinned) and PhysicsLink("A","B",len) to synthesize discrete Verlet kinematic mechanisms!',
        tutorial_cas: 'CAS & Calculus: Empower formulas with Computer Algebra via Nerdamer. Execute definite derivation int(expr, x, a, b) or analytical symbolic steps via the CAS menu panel.',
        tutorial_piecewise: 'Piecewise & Calculus: Use `piecewise(x < 0, x^2, x >= 0, x)` for logic. Calculate `derivative(x^2, x, 2)` or `defint(x^2, x, 0, 1)` for dynamic integral evaluation.',
        tutorial_text: 'Text Notes: Any line starting with a double quote (") is a Markdown text block. Use it for comments, titles, or descriptions.',
        tutorial_gallery: 'Gallery: Traverse to the core toolbar and activate the 🖼️ icon to mount pre-configured system integrations: hydrodynamics, nested fractals, and simulated pendulums.',
        tutorial_recording: 'Recording: Press the 🎥 icon in the primary toolbar to capture screen geometry and generate WebM video artifacts of your graphical evaluations.',
        tutorial_skip: 'Acknowledge & Close',
        tutorial_next: 'Advance',
        tutorial_prev: 'Return',
        tutorial_finish: 'Initialize Platform',
        tools: 'Tools',
        tab_guide: 'User Guide',
        tab_reference: 'Function Reference',
        search_placeholder: 'Search functions...',
        example_label: 'Example:',
        tool_move: 'Move',
        tool_move_desc: 'Move (Pan/Zoom)',
        tool_point: 'Point',
        tool_point_desc: 'Point',
        tool_intersect: 'Intersect',
        tool_intersect_desc: 'Intersection',
        tool_segment: 'Segment',
        tool_segment_desc: 'Segment',
        tool_line: 'Line',
        tool_line_desc: 'Line',
        tool_polygon: 'Polygon',
        tool_polygon_desc: 'Polygon',
        tool_circle: 'Circle',
        tool_circle_desc: 'Circle',
        tool_circle3pts: 'Circle(3pt)',
        tool_circle3pts_desc: 'Circle (3 Points)',
        tool_midpoint: 'Midpoint',
        tool_midpoint_desc: 'Midpoint',
        tool_perp_bisect: 'Perp. Bisect',
        tool_perp_bisect_desc: 'Perpendicular Bisector',
        tool_perpendicular: 'Perpendicular',
        tool_perpendicular_desc: 'Perpendicular Line (Click Point, then Line)',
        tool_parallel: 'Parallel',
        tool_parallel_desc: 'Parallel Line (Click Point, then Line)',
        tool_conic: 'Conic',
        tool_conic_desc: 'Conic (Click 5 Points)',
        tool_angle_bisect: 'Ang. Bisect',
        tool_angle_bisect_desc: 'Angle Bisector (Click 3 pts or 2 lines)',
        tool_tangent: 'Tangent',
        tool_tangent_desc: 'Tangent',
        tool_ode: 'ODE',
        tool_ode_desc: 'ODE Phase Spawner',
        tool_delete: 'Delete',
        tool_delete_desc: 'Delete Element',
    },
    ru: {
        title: 'Vectoria',
        equations: 'Уравнения',
        variables: 'Параметры',
        add: '+ Добавить',
        placeholder: 'f(x) = ...',
        help: 'Обучение / Справка',
        tutorial_title: 'Руководство Vectoria',
        tutorial_eqs: 'Уравнения и Функции: Задавайте пользовательские функции (например, f(x) = x^2) для их повторного использования в других формулах, производных и панели CAS. Поддерживаются явные и неявные (x^2 + y^2 = 25) уравнения. WebGL асинхронно компилирует AST дерева во фрагментные шейдеры GLSL.',
        tutorial_matrix: 'Матрицы и ЛинАл: Применяйте глобальные матрицы Transform(mat) для линейных преобразований плоскости координат. Задавайте собственные 2x2 структуры массивов.',
        tutorial_data: 'Дата Саенс и Ряды: Добавляйте таблицы, стройте линии тренда и регрессии. Применяйте Fourier(pts) для генерации эпициклов, а Voronoi / Delaunay для геометрических графов на плоскости.',
        tutorial_vars: 'Переменные и Анимация: Объявляйте переменные для создания слайдеров. Включайте функцию воспроизведения (Play) для анимации параметров во времени.',
        tutorial_tools: 'Геометрия и Физика: Стройте отрезки, биссектрисы угла через новые мышиные инструменты (САПР). Используйте PhysicsNode и PhysicsLink для симуляции физики методом Верле (Verlet)!',
        tutorial_cas: 'Компьютерная Алгебра (CAS): Символьные вычисления через Nerdamer. Находите производные и определенные интегралы int(expr, x, a, b) на отдельной панели CAS.',
        tutorial_piecewise: 'Кусочные функции: `piecewise(x < 0, x^2, x >= 0, x)`. Интегралы и производные: `derivative(x^2, x, 2)` и `defint(x^2, x, 0, 1)`.',
        tutorial_text: 'Текстовые заметки: Строка, начинающаяся с кавычки (") является текстовым блоком Markdown. Используйте для заголовков.',
        tutorial_gallery: 'Галерея: Нажмите на 🖼️ иконку на верхней панели инструментов, чтобы загрузить встроенную галерею демо-пресетов: гидродинамика, фракталы и многое другое.',
        tutorial_recording: 'Запись Экрана: Нажмите 🎥 иконку для записи холста и генерации WebM видеоартефакта прямо в браузере.',
        tutorial_skip: 'Пропустить',
        tutorial_next: 'Далее',
        tutorial_prev: 'Назад',
        tutorial_finish: 'Начать работу',
        tools: 'Инструменты',
        tab_guide: 'Руководство',
        tab_reference: 'Справочник функций',
        search_placeholder: 'Поиск функций...',
        example_label: 'Пример:',
        tool_move: 'Двигать',
        tool_move_desc: 'Движение холста (Панорамирование/Масштаб)',
        tool_point: 'Точка',
        tool_point_desc: 'Точка',
        tool_intersect: 'Пересечение',
        tool_intersect_desc: 'Пересечение объектов',
        tool_segment: 'Отрезок',
        tool_segment_desc: 'Отрезок',
        tool_line: 'Прямая',
        tool_line_desc: 'Прямая',
        tool_polygon: 'Многоугольник',
        tool_polygon_desc: 'Многоугольник',
        tool_circle: 'Окружность',
        tool_circle_desc: 'Окружность по центру и точке',
        tool_circle3pts: 'Окруж.(3т)',
        tool_circle3pts_desc: 'Окружность по 3 точкам',
        tool_midpoint: 'Середина',
        tool_midpoint_desc: 'Середина отрезка или двух точек',
        tool_perp_bisect: 'Ср. перп.',
        tool_perp_bisect_desc: 'Срединный перпендикуляр',
        tool_perpendicular: 'Перпендикуляр',
        tool_perpendicular_desc: 'Перпендикулярная прямая (Кликните точку, затем прямую/отрезок)',
        tool_parallel: 'Параллель',
        tool_parallel_desc: 'Параллельная прямая (Кликните точку, затем прямую)',
        tool_conic: 'Коника',
        tool_conic_desc: 'Коническое сечение по 5 точкам',
        tool_angle_bisect: 'Биссектриса',
        tool_angle_bisect_desc: 'Биссектриса угла (Кликните 3 точки или 2 прямые)',
        tool_tangent: 'Касательная',
        tool_tangent_desc: 'Касательная (Кликните точку, затем кривую)',
        tool_ode: 'ОДУ',
        tool_ode_desc: 'Траектория обыкновенного дифференциального уравнения',
        tool_delete: 'Удалить',
        tool_delete_desc: 'Удалить элемент',
    }
};

/** @type Locale */
export type Locale = keyof typeof translations;

/** @type TranslationKey */
export type TranslationKey = keyof typeof translations['en'];

const defaultLocale: Locale = typeof window !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en';

/** @brief Writable store tracking the current application language. */
export const locale = writable<Locale>(defaultLocale);

// Log locale initialization
if (typeof window !== 'undefined') {
    Logger.info('i18n', `Initialized application locale to: ${defaultLocale}`);
}

/** 
 * @brief Derived store that provides the translation function `t(key)`.
 * @details Automatically updates UI components when the active `locale` changes.
 */
export const t = derived(locale, $locale => (key: TranslationKey) => {
    return translations[$locale][key] || key;
});
