import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../../src/core/math/evaluator';

describe('Matrix Compilation', () => {
    it('compiles a matrix', () => {
        const compiled = compileExpression('M = [[1, 2], [3, 4]]');
        console.log(compiled);
        expect(compiled).not.toBeNull();
    });
});
