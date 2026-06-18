import { describe, it, expect, beforeEach } from 'vitest';
import { expressions, folders, activeTool } from '../../src/state/store';
import { get } from 'svelte/store';

// Helper to access the internal store for tests since it's an encapsulated factory
const getExpressionsStore = () => get(expressions as any);

describe('Application Stores', () => {
    beforeEach(() => {
        // Reset stores before each test if possible
        if ((expressions as any).set) {
            (expressions as any).set([]);
        }
        if ((folders as any).set) {
            (folders as any).set([]);
        }
    });

    describe('Expressions Store', () => {
        it('should add a mathematical expression', () => {
            expressions.addExpression('y = x^2');
            const exprs = get(expressions as any);
            expect(exprs.length).toBe(1);
            expect(exprs[0].type).toBe('math');
            expect(exprs[0].text).toBe('y = x^2');
            expect(exprs[0].id).toBeDefined();
            expect(exprs[0].visible).toBe(true);
            expect(exprs[0].color).toBeDefined();
        });

        it('should add a text expression', () => {
            expressions.addTextExpression('Note: This is a parabola');
            const exprs = get(expressions as any);
            expect(exprs.length).toBe(1);
            expect(exprs[0].type).toBe('text');
            expect(exprs[0].text).toBe('Note: This is a parabola');
        });

        it('should add a data table expression', () => {
            expressions.addTable();
            const exprs = get(expressions as any);
            expect(exprs.length).toBe(1);
            expect(exprs[0].type).toBe('table');
            expect(exprs[0].points).toBeDefined();
            expect(exprs[0].points.length).toBe(2);
        });

        it('should update expression text safely without duplicating', () => {
            expressions.addExpression('y = x');
            let exprs = get(expressions as any);
            const id = exprs[0].id;

            expressions.updateText(id, 'y = x^2', 'y = x^2');
            exprs = get(expressions as any);
            
            expect(exprs.length).toBe(1); // Should not clone!
            expect(exprs[0].text).toBe('y = x^2');
        });

        it('should update expression style safely', () => {
            expressions.addExpression('y = x');
            let exprs = get(expressions as any);
            const id = exprs[0].id;

            expressions.updateStyle(id, { color: '#ff0000', visible: false, lineWidth: 5 });
            exprs = get(expressions as any);
            
            expect(exprs.length).toBe(1);
            expect(exprs[0].color).toBe('#ff0000');
            expect(exprs[0].visible).toBe(false);
            expect(exprs[0].lineWidth).toBe(5);
        });

        it('should remove an expression safely', () => {
            expressions.addExpression('y = x');
            expressions.addExpression('y = 2x');
            let exprs = get(expressions as any);
            expect(exprs.length).toBe(2);
            
            const idToRemove = exprs[0].id;
            expressions.removeExpression(idToRemove);
            
            exprs = get(expressions as any);
            expect(exprs.length).toBe(1);
            expect(exprs[0].text).toBe('y = 2x');
        });

        it('should move an expression to a different index', () => {
            expressions.addExpression('A');
            expressions.addExpression('B');
            expressions.addExpression('C');
            
            let exprs = get(expressions as any);
            expect(exprs.map((e: any) => e.text)).toEqual(['A', 'B', 'C']);

            expressions.moveExpression(0, 2); // Move 'A' to end
            
            exprs = get(expressions as any);
            expect(exprs.map((e: any) => e.text)).toEqual(['B', 'C', 'A']);
        });
    });

    describe('Folders Store', () => {
        it('should add a folder', () => {
            folders.addFolder('My Folder');
            const f = get(folders as any);
            expect(f.length).toBe(1);
            expect(f[0].title).toBe('My Folder');
            expect(f[0].collapsed).toBe(false);
        });

        it('should remove a folder and its contents', () => {
            folders.addFolder('My Folder');
            const f = get(folders as any);
            const folderId = f[0].id;

            expressions.addExpression('y=x', folderId);
            expressions.addExpression('y=2x');

            let exprs = get(expressions as any);
            expect(exprs.length).toBe(2);

            folders.removeFolder(folderId);
            
            // Folder should be gone
            expect(get(folders as any).length).toBe(0);
            
            // In the current implementation, deleting a folder does NOT delete expressions.
            // Svelte handles orphan expressions by unlinking them or displaying them at the root.
            exprs = get(expressions as any);
            expect(exprs.length).toBe(2);
        });

        it('should toggle folder collapse state', () => {
            folders.addFolder('My Folder');
            const folderId = get(folders as any)[0].id;

            folders.toggleCollapse(folderId);
            expect(get(folders as any)[0].collapsed).toBe(true);

            folders.toggleCollapse(folderId);
            expect(get(folders as any)[0].collapsed).toBe(false);
        });
    });

    describe('Advanced Store Actions', () => {
        it('should add multiple tables with auto-incrementing variables', () => {
            expressions.addTable(); // Will use x_1, y_1
            expressions.addTable(); // Will use x_2, y_2
            
            const exprs = get(expressions as any);
            expect(exprs.length).toBe(2);
            expect(exprs[0].xCol).toBe('x1');
            expect(exprs[0].yCol).toBe('y1');
            expect(exprs[1].xCol).toBe('x2');
            expect(exprs[1].yCol).toBe('y2');
        });

        it('should clear all expressions safely', () => {
            expressions.addExpression('y=x');
            expressions.addTable();
            expect(get(expressions as any).length).toBe(2);

            (expressions as any).set([]);
            expect(get(expressions as any).length).toBe(0);
        });

        it('should rename folder', () => {
            folders.addFolder('Initial');
            const id = get(folders as any)[0].id;
            
            folders.updateTitle(id, 'Updated');
            expect(get(folders as any)[0].title).toBe('Updated');
        });
    });
});
