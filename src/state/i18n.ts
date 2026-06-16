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
        tutorial_eqs: 'Equations & Shaders: Typed explicitly (f(...) = ...) or implicitly (x^2 + y^2 = 25). WebGL asynchronously compiles ASTs into GLSL fragment shaders via a dedicated WebWorker pool to strictly maintain UI operational limits.',
        tutorial_matrix: 'Matrices & Transforms: Apply global linear algebras! Construct matrices natively [[a, b], [c, d]] and invoke Transform(mat) to uniformly manipulate screen rendering layouts dynamically.',
        tutorial_data: 'Data Science & Arrays: Interpolate topologies importing mass datasets via UI Tables. Evaluate regressions dynamically and enact Fourier(Id), Voronoi(Id), or Delaunay(Id) structural maps natively.',
        tutorial_vars: 'Variables & Flow: Declare unbound chars to instantiate interpolative UI sliders. Activate temporal Play controls to compute runtime sweeps.',
        tutorial_tools: 'Geometry & Physics: Construct Segments, Bisectors, and evaluate logic limits on-canvas. Use PhysicsNode("A",x,y,pinned) and PhysicsLink("A","B",len) to synthesize discrete Verlet kinematic mechanisms!',
        tutorial_cas: 'CAS & Calculus: Empower formulas with Computer Algebra via Nerdamer. Execute definite derivation int(expr, x, a, b) or analytical symbolic steps via the CAS menu panel.',
        tutorial_piecewise: 'Piecewise, Fluids & Arrays: Implement hydrodynamics via VectorField(u, v) and simulate numerical advection of fluid particles across density maps.',
        tutorial_text: 'Notes & Sonification: Append text blocks housing Markdown to annotate workspaces. Transform geometric plots into auditory frequencies via 🔊 controls.',
        tutorial_gallery: 'Gallery: Traverse to the core toolbar and activate the 🖼️ icon to mount pre-configured system integrations: hydrodynamics, nested fractals, and simulated pendulums.',
        tutorial_recording: 'Recording: Press the 🎥 icon in the primary toolbar to capture screen geometry and generate WebM video artifacts of your graphical evaluations.',
        tutorial_skip: 'Acknowledge & Close',
        tutorial_next: 'Advance',
        tutorial_prev: 'Return',
        tutorial_finish: 'Initialize Platform',
        tools: 'Tools'
    },
    ru: {
        title: 'Vectoria',
        equations: 'Уравнения',
        variables: 'Параметры',
        add: '+ Добавить',
        placeholder: 'f(x) = ...',
        help: 'Обучение / Справка',
        tutorial_title: 'Руководство Vectoria',
        tutorial_eqs: 'Уравнения и Шейдеры: Поддерживаются явные (f(x) = ...) и неявные (x^2 + y^2 = 25). WebGL асинхронно компилирует AST дерева в GLSL фрагментные шейдеры для быстрой отрисовки.',
        tutorial_matrix: 'Матрицы и ЛинАл: Применяйте глобальные матрицы Transform(mat) для линейных преобразований плоскости координат. Задавайте собственные 2x2 структуры массивов.',
        tutorial_data: 'Дата Саенс и Ряды: Добавляйте таблицы, стройте линии тренда и регрессии. Применяйте Fourier(pts) для генерации эпициклов, а Voronoi / Delaunay для геометрических графов на плоскости.',
        tutorial_vars: 'Переменные и Анимация: Объявляйте переменные для создания слайдеров. Включайте функцию воспроизведения (Play) для анимации параметров во времени.',
        tutorial_tools: 'Геометрия и Физика: Стройте отрезки, биссектрисы угла через новые мышиные инструменты (САПР). Используйте PhysicsNode и PhysicsLink для симуляции физики методом Верле (Verlet)!',
        tutorial_cas: 'Компьютерная Алгебра (CAS): Символьные вычисления через Nerdamer. Находите производные и определенные интегралы int(expr, x, a, b) на отдельной панели CAS.',
        tutorial_piecewise: 'Кусочные функции и Поля: Используйте VectorField(u, v) для симуляции векторного поля и спавна частиц через инструмент ODE Phase Spawner.',
        tutorial_text: 'Заметки и Сонификация: Создавайте Markdown текстовые блоки для описания графиков. Конвертируйте математические кривые напрямую в звук через частоты.',
        tutorial_gallery: 'Галерея: Нажмите на 🖼️ иконку на верхней панели инструментов, чтобы загрузить встроенную галерею демо-пресетов: гидродинамика, фракталы и многое другое.',
        tutorial_recording: 'Запись Экрана: Нажмите 🎥 иконку для записи холста и генерации WebM видеоартефакта прямо в браузере.',
        tutorial_skip: 'Пропустить',
        tutorial_next: 'Далее',
        tutorial_prev: 'Назад',
        tutorial_finish: 'Начать работу',
        tools: 'Инструменты'
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
