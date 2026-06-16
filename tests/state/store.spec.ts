import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { expressions, sliders, folders } from '../../src/state/store';

describe('Store functionality', () => {
    beforeEach(() => {
        // Reset stores before each test if possible, or just add uniquely
    });

    it('should add a new math expression', () => {
        const initialCount = get(expressions).length;
        expressions.addExpression('y = x^2', 'y = x^2');
        const currentExprs = get(expressions);
        expect(currentExprs.length).toBe(initialCount + 1);
        expect(currentExprs[currentExprs.length - 1].text).toBe('y = x^2');
    });

    it('should add a text expression', () => {
        const initialCount = get(expressions).length;
        expressions.addTextExpression('Hello world');
        const currentExprs = get(expressions);
        expect(currentExprs.length).toBe(initialCount + 1);
        const last = currentExprs[currentExprs.length - 1];
        expect(last.type).toBe('text');
        expect(last.text).toBe('Hello world');
    });

    it('should add a folder', () => {
        const initialCount = get(folders).length;
        folders.addFolder('My Folder');
        const currentFolders = get(folders);
        expect(currentFolders.length).toBe(initialCount + 1);
        expect(currentFolders[currentFolders.length - 1].title).toBe('My Folder');
    });
});
