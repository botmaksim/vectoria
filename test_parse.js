import { parse } from 'mathjs';
try {
    parse("x^2/16 + y^2/9 = 1");
    console.log("Success with =");
} catch (e) {
    console.log("Failed with =", e.message);
}

try {
    parse("x^2/16 + y^2/9 - 1");
    console.log("Success with -");
} catch (e) {
    console.log("Failed with -", e.message);
}
