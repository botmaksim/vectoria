/**
 * @file exportCompiler.ts
 * @brief Handles generation of Python (Matplotlib) and LaTeX (TikZ) code from math expressions.
 * @details Parses expressions using mathjs and outputs visualizable code formats for scientific reports.
 */

import { parse } from 'mathjs';
import type { Expression, CameraState } from '../types';

/**
 * @brief Converts a mathjs AST node to a string formatted for Python/numpy.
 * @param node The mathjs AST node.
 * @return Python/numpy string representation.
 */
function toPython(node: any): string {
    if (!node) return '';
    if (node.isSymbolNode) {
        if (node.name === 'pi') return 'np.pi';
        if (node.name === 'e') return 'np.e';
        return node.name;
    }
    if (node.isConstantNode) {
        return node.value.toString();
    }
    if (node.isOperatorNode) {
        const args = node.args.map(toPython);
        if (node.op === '^') {
            return `(${args[0]} ** ${args[1]})`;
        }
        if (node.args.length === 1) {
            return `${node.op}${args[0]}`;
        }
        return `(${args[0]} ${node.op} ${args[1]})`;
    }
    if (node.isFunctionNode) {
        const args = node.args.map(toPython);
        const name = node.name;
        if (name === 'sin') return `np.sin(${args[0]})`;
        if (name === 'cos') return `np.cos(${args[0]})`;
        if (name === 'tan') return `np.tan(${args[0]})`;
        if (name === 'sqrt') return `np.sqrt(${args[0]})`;
        if (name === 'exp') return `np.exp(${args[0]})`;
        if (name === 'abs') return `np.abs(${args[0]})`;
        if (name === 'log') return `np.log(${args[0]})`;
        if (name === 'derivative') return `np.gradient(${args[0]}, x)`;
        return `np.${name}(${args.join(', ')})`;
    }
    if (node.isParenthesisNode) {
        return `(${toPython(node.content)})`;
    }
    return node.toString();
}

/**
 * @brief Converts a mathjs AST node to a string formatted for LaTeX/TikZ.
 * @param node The mathjs AST node.
 * @return LaTeX/TikZ string representation.
 */
function toTikZ(node: any): string {
    if (!node) return '';
    if (node.isSymbolNode) {
        if (node.name === 'x') return '\\x';
        if (node.name === 'y') return '\\y';
        if (node.name === 't') return '\\t';
        if (node.name === 'theta') return '\\t';
        if (node.name === 'pi') return 'pi';
        if (node.name === 'e') return '2.7182818';
        return node.name;
    }
    if (node.isConstantNode) {
        return node.value.toString();
    }
    if (node.isOperatorNode) {
        const args = node.args.map(toTikZ);
        if (node.op === '^') {
            return `(${args[0]}^${args[1]})`;
        }
        if (node.args.length === 1) {
            return `${node.op}${args[0]}`;
        }
        return `(${args[0]} ${node.op} ${args[1]})`;
    }
    if (node.isFunctionNode) {
        const args = node.args.map(toTikZ);
        const name = node.name;
        if (['sin', 'cos', 'tan'].includes(name)) {
            return `${name}(${args[0]} r)`;
        }
        return `${name}(${args.join(', ')})`;
    }
    if (node.isParenthesisNode) {
        return `(${toTikZ(node.content)})`;
    }
    return node.toString();
}

export interface ExportOptions {
    hideAxes?: boolean;
    transparentBg?: boolean;
}

/**
 * @brief Generates export code based on current expressions, camera, and export mode.
 * @param eqs Array of user expressions.
 * @param cam Current camera state.
 * @param mode Export mode: 'python' or 'tikz'.
 * @param options Additional export options.
 * @return The generated code.
 */
export function generateCode(eqs: Expression[], cam: CameraState, mode: string, options: ExportOptions = {}): string {
    const x_min = (cam.x - cam.zoom).toFixed(2);
    const x_max = (cam.x + cam.zoom).toFixed(2);
    const y_min = (cam.y - cam.zoom).toFixed(2);
    const y_max = (cam.y + cam.zoom).toFixed(2);

    if (mode === 'python') {
        let py = `import numpy as np\nimport matplotlib.pyplot as plt\n\n`;
        py += `# Viewport setup\n`;
        py += `fig, ax = plt.subplots(figsize=(8, 8))\n`;
        
        if (options.transparentBg) {
            py += `fig.patch.set_alpha(0.0)\n`;
            py += `ax.patch.set_alpha(0.0)\n`;
        }
        
        if (options.hideAxes) {
            py += `ax.axis('off')\n`;
        }
        
        py += `ax.set_xlim([${x_min}, ${x_max}])\n`;
        py += `ax.set_ylim([${y_min}, ${y_max}])\n`;
        py += `ax.set_aspect('equal')\n\n`;

        for (let eq of eqs) {
            if (!eq.text) continue;
            py += `# --- ${eq.text} ---\n`;
            try {
                // Check custom function definition: f(x) = ...
                const funcMatch = eq.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_])\)\s*=(.*)$/);
                if (funcMatch) {
                    const funcName = funcMatch[1].trim();
                    const param = funcMatch[2].trim();
                    const body = funcMatch[3].trim();
                    const bodyPy = toPython(parse(body));
                    py += `def ${funcName}(${param}):\n    return ${bodyPy}\n\n`;
                    continue;
                }

                // Check assignment: a = ...
                const assignMatch = eq.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
                if (assignMatch) {
                    const varName = assignMatch[1].trim();
                    const rhs = assignMatch[2].trim();
                    const pointMatch = rhs.match(/^\s*\((.+?)\s*,\s*(.+?)\)\s*$/);
                    if (pointMatch) {
                        py += `${varName} = np.array([${toPython(parse(pointMatch[1]))}, ${toPython(parse(pointMatch[2]))}])\n`;
                    } else {
                        py += `${varName} = ${toPython(parse(rhs))}\n`;
                    }
                    continue;
                }

                // Check explicit function: y = sin(x) or y < sin(x)
                const explicitMatch = eq.text.match(/^\s*(y|f\(x\))\s*(=|<=|>=|<|>)\s*(.*)$/);
                if (explicitMatch) {
                    const op = explicitMatch[2];
                    const rhs = explicitMatch[3].trim();
                    const rhsPy = toPython(parse(rhs));
                    py += `x = np.linspace(${x_min}, ${x_max}, 1000)\n`;
                    py += `y = ${rhsPy}\n`;
                    if (op === '=') {
                        py += `ax.plot(x, y, label=${JSON.stringify(eq.text)}, color='${eq.color}', linewidth=2)\n`;
                    } else {
                        if (op === '<' || op === '<=') {
                            py += `ax.fill_between(x, y, ${y_min}, alpha=0.2, label=${JSON.stringify(eq.text)}, color='${eq.color}')\n`;
                        } else {
                            py += `ax.fill_between(x, y, ${y_max}, alpha=0.2, label=${JSON.stringify(eq.text)}, color='${eq.color}')\n`;
                        }
                    }
                    continue;
                }

                // Check parametric curve: (x(t), y(t))
                const paraMatch = eq.text.match(/^\s*\((.+?)\s*,\s*(.+?)\)\s*$/);
                if (paraMatch) {
                    const xPy = toPython(parse(paraMatch[1]));
                    const yPy = toPython(parse(paraMatch[2]));
                    py += `t = np.linspace(0, 12 * np.pi, 1000)\n`;
                    py += `x = ${xPy}\n`;
                    py += `y = ${yPy}\n`;
                    py += `ax.plot(x, y, label=${JSON.stringify(eq.text)}, color='${eq.color}', linewidth=2)\n`;
                    continue;
                }

                // Check polar: r = ...
                const polarMatch = eq.text.match(/^\s*r\s*=\s*(.*)$/);
                if (polarMatch) {
                    const rPy = toPython(parse(polarMatch[1]));
                    py += `theta = np.linspace(0, 2 * np.pi, 1000)\n`;
                    py += `r = ${rPy}\n`;
                    py += `x = r * np.cos(theta)\n`;
                    py += `y = r * np.sin(theta)\n`;
                    py += `ax.plot(x, y, label=${JSON.stringify(eq.text)}, color='${eq.color}', linewidth=2)\n`;
                    continue;
                }

                // Check CAD primitives in text
                if (eq.text.includes('Circle')) {
                    const circMatch = eq.text.match(/Circle\(\s*(.+?)\s*,\s*(.+?)\)/);
                    if (circMatch) {
                        const center = circMatch[1];
                        const radius = circMatch[2];
                        py += `circle = plt.Circle((${center}[0] if isinstance(${center}, np.ndarray) else ${center}[0], ${center}[1] if isinstance(${center}, np.ndarray) else ${center}[1]), ${radius}, fill=False, color='${eq.color}', linewidth=2)\n`;
                        py += `ax.add_patch(circle)\n`;
                    }
                    continue;
                }

                if (eq.text.includes('Segment')) {
                    const segMatch = eq.text.match(/Segment\(\s*(.+?)\s*,\s*(.+?)\)/);
                    if (segMatch) {
                        const p1 = segMatch[1];
                        const p2 = segMatch[2];
                        py += `ax.plot([${p1}[0], ${p2}[0]], [${p1}[1], ${p2}[1]], color='${eq.color}', linewidth=2)\n`;
                    }
                    continue;
                }

                // General implicit / contour fallback
                const eqMatch = eq.text.match(/^(.*?)(<=|>=|<|>|=|~)(.*)$/);
                if (eqMatch) {
                    const op = eqMatch[2];
                    const lhs = eqMatch[1].trim();
                    const rhs = eqMatch[3].trim();
                    const lhsPy = toPython(parse(lhs));
                    const rhsPy = toPython(parse(rhs));
                    py += `X, Y = np.meshgrid(np.linspace(${x_min}, ${x_max}, 200), np.linspace(${y_min}, ${y_max}, 200))\n`;
                    py += `Z = eval("${lhsPy} - (${rhsPy})", globals(), {'x': X, 'y': Y})\n`;
                    if (op === '=') {
                        py += `ax.contour(X, Y, Z, levels=[0], colors=['${eq.color}'], linewidths=2)\n`;
                    } else {
                        if (op === '<' || op === '<=') {
                            py += `ax.contourf(X, Y, Z, levels=[-np.inf, 0], colors=['${eq.color}'], alpha=0.2)\n`;
                        } else {
                            py += `ax.contourf(X, Y, Z, levels=[0, np.inf], colors=['${eq.color}'], alpha=0.2)\n`;
                        }
                    }
                    continue;
                }
            } catch (e) {
                py += `# Error exporting: ${e}\n`;
            }
        }

        if (options.hideAxes) {
            py += `\nplt.legend()\nplt.show()\n`;
        } else {
            py += `\nplt.grid(True)\nplt.legend()\nplt.show()\n`;
        }
        return py;

    } else {
        // TikZ mode
        let tz = `\\documentclass[tikz,border=10pt]{standalone}\n`;
        tz += `\\usepackage{pgfplots}\n`;
        tz += `\\pgfplotsset{compat=1.18}\n`;
        tz += `\\begin{document}\n`;
        tz += `\\begin{tikzpicture}\n`;
        
        // Define colors
        const uniqueColors = Array.from(new Set(eqs.map(e => e.color).filter(Boolean)));
        uniqueColors.forEach((color, i) => {
            const name = `col${i}`;
            if (color) {
               tz += `\\definecolor{${name}}{HTML}{${color.replace('#', '')}}\n`;
            }
        });
        tz += `\n`;

        tz += `\\begin{axis}[\n`;
        tz += `  xmin=${x_min}, xmax=${x_max},\n`;
        tz += `  ymin=${y_min}, ymax=${y_max},\n`;
        if (options.hideAxes) {
            tz += `  hide axis,\n`;
        } else {
            tz += `  axis lines=center,\n  grid=both,\n`;
        }
        tz += `  width=10cm, height=10cm\n`;
        tz += `]\n\n`;

        for (let eq of eqs) {
            if (!eq.text) continue;
            const colName = `col${uniqueColors.indexOf(eq.color)}`;
            tz += `% --- ${eq.text} ---\n`;
            try {
                // Check custom function definition: f(x) = ...
                const funcMatch = eq.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_])\)\s*=(.*)$/);
                if (funcMatch) {
                    const funcName = funcMatch[1].trim();
                    const param = funcMatch[2].trim();
                    const body = funcMatch[3].trim();
                    const bodyTz = toTikZ(parse(body));
                    tz += `% Function f(x) declared in global document scope:\n% \\tikzset{declare function={${funcName}(\\${param}) = ${bodyTz};}}\n`;
                    continue;
                }

                // Check explicit function: y = sin(x)
                const explicitMatch = eq.text.match(/^\s*(y|f\(x\))\s*(=|<=|>=|<|>)\s*(.*)$/);
                if (explicitMatch) {
                    const op = explicitMatch[2];
                    const rhs = explicitMatch[3].trim();
                    const rhsTz = toTikZ(parse(rhs));
                    if (op === '=') {
                        tz += `\\addplot[domain=${x_min}:${x_max}, samples=200, smooth, color=${colName}, thick] {${rhsTz}};\n`;
                    } else {
                        tz += `\\addplot[domain=${x_min}:${x_max}, samples=200, smooth, color=${colName}, fill=${colName}, fill opacity=0.15, thick] {${rhsTz}};\n`;
                    }
                    continue;
                }

                // Check parametric curve: (x(t), y(t))
                const paraMatch = eq.text.match(/^\s*\((.+?)\s*,\s*(.+?)\)\s*$/);
                if (paraMatch) {
                    const xTz = toTikZ(parse(paraMatch[1]));
                    const yTz = toTikZ(parse(paraMatch[2]));
                    tz += `\\draw[color=${colName}, thick, variable=\\t, domain=0:12*pi, samples=300, smooth] plot ({${xTz}}, {${yTz}});\n`;
                    continue;
                }

                // Check polar: r = ...
                const polarMatch = eq.text.match(/^\s*r\s*=\s*(.*)$/);
                if (polarMatch) {
                    const rTz = toTikZ(parse(polarMatch[1]));
                    tz += `\\draw[color=${colName}, thick, variable=\\t, domain=0:2*pi, samples=300, smooth] plot ({(${rTz})*cos(\\t r)}, {(${rTz})*sin(\\t r)});\n`;
                    continue;
                }

                // Segment
                if (eq.text.includes('Segment')) {
                    const segMatch = eq.text.match(/Segment\(\s*(.+?)\s*,\s*(.+?)\)/);
                    if (segMatch) {
                        const p1 = segMatch[1];
                        const p2 = segMatch[2];
                        tz += `\\draw[color=${colName}, thick] (${p1}) -- (${p2});\n`;
                    }
                    continue;
                }

                // Circle
                if (eq.text.includes('Circle')) {
                    const circMatch = eq.text.match(/Circle\(\s*(.+?)\s*,\s*(.+?)\)/);
                    if (circMatch) {
                        const center = circMatch[1];
                        const radius = circMatch[2];
                        tz += `\\draw[color=${colName}, thick] (${center}) circle (${radius});\n`;
                    }
                    continue;
                }

                tz += `% (Fallback for ${eq.text})\n`;
            } catch (e) {
                tz += `% Error exporting: ${e}\n`;
            }
        }

        tz += `\\end{axis}\n`;
        tz += `\\end{tikzpicture}\n`;
        tz += `\\end{document}\n`;
        return tz;
    }
}
