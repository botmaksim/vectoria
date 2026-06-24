
function toImplicitConic(c) {
  if (!c) return null;
  if (typeof c.a === 'number' && typeof c.b === 'number' && typeof c.c === 'number' && typeof c.d === 'number' && typeof c.e === 'number' && typeof c.f === 'number') {
    return c;
  }
  if (typeof c.cx === 'number' && typeof c.cy === 'number') {
    if (typeof c.r === 'number') {
      return {
        a: 1,
        b: 0,
        c: 1,
        d: -2 * c.cx,
        e: -2 * c.cy,
        f: c.cx * c.cx + c.cy * c.cy - c.r * c.r
      };
    }
  }
  return null;
}

function toImplicitLine(l) {
  if (!l) return null;
  if (Array.isArray(l) && l.length > 0) l = l[0];
  if (
    typeof l.a === "number" &&
    typeof l.b === "number" &&
    typeof l.c === "number" &&
    typeof l.d !== "number" // ensure it's not a conic
  ) {
    return l;
  }
  return null;
}

function Intersect(o1, o2) {
            const c1 = toImplicitConic(o1);
            const c2 = toImplicitConic(o2);
            const l1 = toImplicitLine(o1);
            const l2 = toImplicitLine(o2);

            if ((c1 && l2 && !l1) || (c2 && l1 && !c1)) {
                const theConic = (c1 && l2 && !l1) ? c1 : c2;
                const theLine = (c1 && l2 && !l1) ? l2 : l1;
                
                const pts = [];
                if (Math.abs(theLine.b) > Math.abs(theLine.a)) {
                    const m = -theLine.a/theLine.b, k = -theLine.c/theLine.b;
                    const A = theConic.a + theConic.b*m + theConic.c*m*m;
                    const B = theConic.b*k + 2*theConic.c*m*k + theConic.d + theConic.e*m;
                    const C = theConic.c*k*k + theConic.e*k + theConic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const x1 = (-B + Math.sqrt(delta))/(2*A);
                        const x2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: x1, y: m*x1 + k});
                        if (delta > 1e-8) pts.push({x: x2, y: m*x2 + k});
                    }
                } else if (Math.abs(theLine.a) > 1e-10) {
                    const m = -theLine.b/theLine.a, k = -theLine.c/theLine.a;
                    const A = theConic.c + theConic.b*m + theConic.a*m*m;
                    const B = theConic.b*k + 2*theConic.a*m*k + theConic.e + theConic.d*m;
                    const C = theConic.a*k*k + theConic.d*k + theConic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const y1 = (-B + Math.sqrt(delta))/(2*A);
                        const y2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: m*y1 + k, y: y1});
                        if (delta > 1e-8) pts.push({x: m*y2 + k, y: y2});
                    }
                }
                return pts.length === 1 ? pts[0] : (pts.length ? pts : null);
            }
            return "not line+conic";
}

const circle = {cx: 0, cy: 0, r: 5};
const line = {a: 1, b: 0, c: -3}; // x = 3
console.log("circle+line:", Intersect(circle, line));

const conic = {a: 1, b: 0, c: 1, d: 0, e: 0, f: -25}; // x^2 + y^2 = 25
console.log("conic+line:", Intersect(conic, line));
