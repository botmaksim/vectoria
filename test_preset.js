import * as mathjs from 'mathjs';

const scope = {};
const expressions = [
    'A = [-4, -2]',
    'c1 = Circle(A, 4)',
    'P = PointOn(c1, 0, 2)',
    'c2 = x^2/16 + y^2/9 - 1', // modified
    'I = Intersect(c1, c2)',
    'L = Line(A, P)',
    'T = Tangent(L, c2)'
];

try {
    for (const expr of expressions) {
        mathjs.evaluate(expr, scope);
        console.log(`Evaluated ${expr}:`, scope[expr.split('=')[0].trim()]);
    }
    console.log("Success!");
} catch (e) {
    console.error("Error:", e.message);
}
