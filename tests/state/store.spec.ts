import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { expressions, sliders, folders } from '../../src/state/store';

describe('Store functionality', () => {
    beforeEach(() => {
        // Clear stores before each test to guarantee test isolation
        expressions.set([]);
        sliders.set({});
        folders.set([]);
    });

    describe('Expressions Store', () => {
        it('should add a new math expression with custom styles', () => {
            expressions.addExpression('y = x^2');
            const currentExprs = get(expressions);
            expect(currentExprs.length).toBe(1);
            expect(currentExprs[0].text).toBe('y = x^2');
            expect(currentExprs[0].type).toBe('math');
            expect(currentExprs[0].visible).toBe(true);
            expect(currentExprs[0].color).toBeDefined();
        });

        it('should add a text expression', () => {
            expressions.addTextExpression('Hello world');
            const currentExprs = get(expressions);
            expect(currentExprs.length).toBe(1);
            expect(currentExprs[0].type).toBe('text');
            expect(currentExprs[0].text).toBe('Hello world');
        });

        it('should add tables and automatically name their columns with table count suffix', () => {
            expressions.addTable();
            expressions.addTable();

            const current = get(expressions);
            expect(current.length).toBe(2);
            expect(current[0].type).toBe('table');
            expect(current[0].xCol).toBe('x1');
            expect(current[0].yCol).toBe('y1');
            expect(current[0].points).toHaveLength(2); // default empty rows

            expect(current[1].type).toBe('table');
            expect(current[1].xCol).toBe('x2');
            expect(current[1].yCol).toBe('y2');
        });

        it('should support adding table with pre-filled import data', () => {
            const importData = [
                { x: 1, y: 10 },
                { x: 2, y: 20 }
            ];
            expressions.addTableWithData(importData);
            const current = get(expressions);
            expect(current).toHaveLength(1);
            expect(current[0].type).toBe('table');
            // Check that it appended an extra empty row at the end
            expect(current[0].points).toEqual([
                { x: 1, y: 10 },
                { x: 2, y: 20 },
                { x: null, y: null }
            ]);
        });

        it('should update expression text and latex', () => {
            expressions.addExpression('a');
            const id = get(expressions)[0].id;

            expressions.updateText(id, 'b', 'b_latex');
            const updated = get(expressions)[0];
            expect(updated.text).toBe('b');
            expect(updated.latex).toBe('b_latex');
        });

        it('should update table points and append a new empty row when the last row is filled', () => {
            expressions.addTable();
            const id = get(expressions)[0].id;

            // Initially has [{x: null, y: null}, {x: null, y: null}]
            // Let's edit row index 1 (the last row)
            expressions.updateTablePoint(id, 1, 5, 6);

            const table = get(expressions)[0];
            expect(table.points![1]).toEqual({ x: 5, y: 6 });
            // A new empty row should have been appended to the end of the points list
            expect(table.points).toHaveLength(3);
            expect(table.points![2]).toEqual({ x: null, y: null });
        });

        it('should toggle expression visibility', () => {
            expressions.addExpression('y = x');
            const id = get(expressions)[0].id;
            expect(get(expressions)[0].visible).toBe(true);

            expressions.toggleVisible(id);
            expect(get(expressions)[0].visible).toBe(false);

            expressions.toggleVisible(id);
            expect(get(expressions)[0].visible).toBe(true);
        });

        it('should update styling properties via updateStyle', () => {
            expressions.addExpression('y = x');
            const id = get(expressions)[0].id;

            expressions.updateStyle(id, { color: '#ff0000', visible: false });
            const item = get(expressions)[0];
            expect(item.color).toBe('#ff0000');
            expect(item.visible).toBe(false);
        });

        it('should remove expressions by id', () => {
            expressions.addExpression('y = 1');
            expressions.addExpression('y = 2');
            const listBefore = get(expressions);
            expect(listBefore).toHaveLength(2);

            expressions.removeExpression(listBefore[0].id);
            const listAfter = get(expressions);
            expect(listAfter).toHaveLength(1);
            expect(listAfter[0].id).toBe(listBefore[1].id);
        });

        it('should update regression parameters and optimize updates to prevent infinite loops', () => {
            expressions.addExpression('y1 ~ m * x1');
            const id = get(expressions)[0].id;

            // Set initial parameters
            expressions.updateRegressionParams(id, { m: 2.5 }, 0.98);
            let item = get(expressions)[0];
            expect(item.regressionParams).toEqual({ m: 2.5 });
            expect(item.regressionRSquared).toBe(0.98);

            // Setting same parameters should not return a new object reference in update map
            // to avoid triggering sub-listeners in Svelte component render cycles
            const prevRef = item.regressionParams;
            expressions.updateRegressionParams(id, { m: 2.5 }, 0.98);
            item = get(expressions)[0];
            expect(item.regressionParams).toBe(prevRef); // identical reference since values match
        });
    });

    describe('Sliders Store', () => {
        it('should synchronize sliders with active variables, pruning unused ones', () => {
            // Initial state is empty {}
            sliders.syncVars(['k1', 'k2']);
            let current = get(sliders);
            expect(Object.keys(current)).toEqual(['k1', 'k2']);
            expect(current.k1.value).toBe(1);

            // Sync with a new set, preserving k1, adding k3, and removing k2
            sliders.syncVars(['k1', 'k3']);
            current = get(sliders);
            expect(Object.keys(current)).toEqual(['k1', 'k3']);
        });

        it('should update value and toggle play state', () => {
            sliders.syncVars(['a']);
            expect(get(sliders).a.value).toBe(1);
            expect(get(sliders).a.isPlaying).toBe(false);

            sliders.updateValue('a', 7.5);
            expect(get(sliders).a.value).toBe(7.5);

            sliders.togglePlay('a');
            expect(get(sliders).a.isPlaying).toBe(true);
        });

        it('should animate playing sliders during ticks and bounce at bounds', () => {
            sliders.set({
                a: { name: 'a', value: 9.0, min: -10, max: 10, step: 0.1, isPlaying: true, animSpeed: 1, animDir: 1 }
            });

            // deltaTime = 0.5s. range = 20.
            // delta = range * 0.2 * animSpeed * deltaTime * animDir = 20 * 0.2 * 1 * 0.5 * 1 = 2.0
            // newVal = 9.0 + 2.0 = 11.0. Exceeds max 10.
            // Bounces back: newVal = max - (newVal - max) = 10 - (11 - 10) = 9.0. Dir becomes -1.
            sliders.tickAnimations(0.5);

            let current = get(sliders).a;
            expect(current.value).toBeCloseTo(9.0);
            expect(current.animDir).toBe(-1);

            // Tick again with dir = -1. newVal = 9.0 - 2.0 = 7.0
            sliders.tickAnimations(0.5);
            current = get(sliders).a;
            expect(current.value).toBeCloseTo(7.0);
            expect(current.animDir).toBe(-1);
        });
    });

    describe('Folders Store', () => {
        it('should add, collapse, rename, and remove folders', () => {
            folders.addFolder('Math Group');
            let list = get(folders);
            expect(list).toHaveLength(1);
            expect(list[0].title).toBe('Math Group');
            expect(list[0].collapsed).toBe(false);

            const folderId = list[0].id;

            // Toggle collapse
            folders.toggleCollapse(folderId);
            expect(get(folders)[0].collapsed).toBe(true);

            // Update title
            folders.updateTitle(folderId, 'New Title');
            expect(get(folders)[0].title).toBe('New Title');

            // Remove folder
            folders.removeFolder(folderId);
            expect(get(folders)).toHaveLength(0);
        });
    });
});
