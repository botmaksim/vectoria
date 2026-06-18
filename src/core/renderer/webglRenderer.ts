/**
 * @file webglRenderer.ts
 * @brief GPU-accelerated rendering engine for mathematical equations.
 * @details Implements a WebGL pipeline that evaluates fragment shaders (generated from ASTs) over a fullscreen quad to render implicit equations and inequalities with pixel-perfect accuracy.
 */

import type { Camera } from "./camera";
import { Logger } from "../../utils/logger";

/**
 * @brief Vertex shader source code.
 * @details Passes the fullscreen quad positions directly to gl_Position.
 * @param glslExpr:string
 * @param op:string
 * @param uniformsList:string
 */
const VS_SOURCE = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * @brief Generates the fragment shader source code for a specific equation.
 * @param glslExpr The GLSL mathematical expression.
 * @param op The mathematical operator ('=', '<', '>', etc.).
 * @param uniformsList The array of uniform variable names required by the expression.
 * @returns The complete fragment shader source string.
 */
function getFSSource(
  glslExpr: string,
  op: string,
  uniformsList: string[],
): string {
  let uniformsStr = uniformsList.map((u) => `uniform float ${u};`).join("\n");
  let evaluationStr = "";

  if (op === "=") {
    evaluationStr = `
        float gradX = dFdx(val);
        float gradY = dFdy(val);
        float grad = sqrt(gradX * gradX + gradY * gradY);
        
        float dist = abs(val) / (grad + 0.000001);
        float alpha = 1.0 - smoothstep(1.0, 2.0, dist);
        
        if (alpha <= 0.01) discard;
        gl_FragColor = vec4(u_color, alpha);
        `;
  } else {
    const check = op.includes("<") ? "val < 0.0" : "val > 0.0";
    evaluationStr = `
        float isInside = ${check} ? 1.0 : 0.0;
        
        float gradX = dFdx(val);
        float gradY = dFdy(val);
        float grad = sqrt(gradX * gradX + gradY * gradY);
        float dist = abs(val) / (grad + 0.000001);
        
        float borderAlpha = 1.0 - smoothstep(0.0, 1.5, dist);
        if (isInside == 0.0 && borderAlpha <= 0.0) discard;
        
        float finalAlpha = max(isInside * 0.3, borderAlpha);
        gl_FragColor = vec4(u_color, finalAlpha);
        `;
  }

  const complexLibrary = `
        float sinh(float x) { return (exp(x) - exp(-x)) / 2.0; }
        float cosh(float x) { return (exp(x) + exp(-x)) / 2.0; }
        float tanh(float x) { float e2x = exp(2.0 * x); return (e2x - 1.0) / (e2x + 1.0); }

        vec2 c_add(vec2 a, vec2 b) { return a + b; }
        vec2 c_sub(vec2 a, vec2 b) { return a - b; }
        vec2 c_mul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
        vec2 c_div(vec2 a, vec2 b) { float d = dot(b,b); return vec2(dot(a,b), a.y*b.x - a.x*b.y)/d; }
        vec2 c_pow(vec2 z, vec2 a) { 
            float r = length(z); float th = atan(z.y, z.x);
            float p_r = pow(r, a.x) * exp(-a.y * th);
            float p_th = a.x * th + a.y * log(r);
            return p_r * vec2(cos(p_th), sin(p_th));
        }
        vec2 c_exp(vec2 z) { return exp(z.x) * vec2(cos(z.y), sin(z.y)); }
        vec2 c_log(vec2 z) { return vec2(log(length(z)), atan(z.y, z.x)); }
        vec2 c_sin(vec2 z) { return vec2(sin(z.x)*cosh(z.y), cos(z.x)*sinh(z.y)); }
        vec2 c_cos(vec2 z) { return vec2(cos(z.x)*cosh(z.y), -sin(z.x)*sinh(z.y)); }
        vec2 c_sqrt(vec2 z) { float r = sqrt(length(z)); float th = atan(z.y, z.x)/2.0; return r*vec2(cos(th), sin(th)); }

        vec3 hsl2rgb(vec3 c) {
            vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
            return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
        }
    `;

    return `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;
    
    uniform vec2 u_resolution;
    uniform vec2 u_camPos;
    uniform float u_zoom;
    uniform vec3 u_color;
    uniform mat2 u_invTransform;
    
    ${uniformsStr}
    
    ${complexLibrary}

    float f(float x, float y) {
        ${glslExpr.includes('return') ? glslExpr : 'return ' + glslExpr + ';'}
    }

    void main() {
        vec2 mathPos = vec2(
            u_camPos.x + (gl_FragCoord.x - u_resolution.x * 0.5) / u_zoom,
            u_camPos.y + (gl_FragCoord.y - u_resolution.y * 0.5) / u_zoom
        );
        mathPos = u_invTransform * mathPos;

        float x = mathPos.x;
        float y = mathPos.y;
        float val = f(x, y);
        ${evaluationStr}
    }
    `;
}

/**
 * @class WebGLRenderer
 * @brief Orchestrates WebGL context, shader compilation, and draw calls.
 */
export class WebGLRenderer {
  /** @brief The active WebGL rendering context. */
  gl: WebGLRenderingContext | null = null;
  /** @brief The VBO containing the fullscreen quad geometry. */
  quadBuffer: WebGLBuffer | null = null;
  /** @brief Cache for compiled shader programs to optimize performance. */
  programCache: Map<string, { program: WebGLProgram; uniforms: string[] }> =
    new Map();

  /**
   * @brief Initializes the WebGL context and uploads the fullscreen quad geometry.
   * @param canvas The target HTMLCanvasElement.
   */
  init(canvas: HTMLCanvasElement): void {
    Logger.info("WebGLRenderer", "Initializing WebGL context.");
    this.gl = canvas.getContext("webgl", {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!this.gl) {
      Logger.error("WebGLRenderer", "Failed to acquire WebGL context.");
      return;
    }

    const gl = this.gl;
    const ext = gl.getExtension("OES_standard_derivatives");
    if (!ext) {
      Logger.warn(
        "WebGLRenderer",
        "OES_standard_derivatives extension is not supported on this device.",
      );
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    Logger.debug("WebGLRenderer", "Quad buffer successfully initialized.");
  }

  /**
   * @brief Compiles a raw string into a WebGL shader object.
   * @param type The type of shader (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER).
   * @param source The shader source code.
   * @returns A compiled WebGLShader, or null on failure.
   */
  compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      Logger.error(
        "WebGLRenderer",
        `Shader compilation error: ${gl.getShaderInfoLog(shader)}`,
      );
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * @brief Retrieves a cached shader program, or compiles a new one if it does not exist.
   * @param id The unique equation identifier.
   * @param glslExpr The GLSL mathematical expression.
   * @param op The relational operator.
   * @param uniformsList The required uniforms.
   * @returns The compiled program data, or null on failure.
   * @param canvas:HTMLCanvasElement
   */
  getOrCreateProgram(
    id: string,
    glslExpr: string,
    op: string,
    uniformsList: string[],
  ) {
    if (!this.gl) return null;
    const gl = this.gl;

    const cacheKey = id + "_" + glslExpr + "_" + op;
    if (this.programCache.has(cacheKey)) {
      return this.programCache.get(cacheKey);
    }

    Logger.info(
      "WebGLRenderer",
      `Compiling new shader program for key: ${cacheKey}`,
    );
    const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = this.compileShader(
      gl.FRAGMENT_SHADER,
      getFSSource(glslExpr, op, uniformsList),
    );

    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      Logger.error(
        "WebGLRenderer",
        `Program linking error: ${gl.getProgramInfoLog(program)}`,
      );
      return null;
    }

    const result = { program, uniforms: uniformsList };
    this.programCache.set(cacheKey, result);
    return result;
  }

  /**
   * @brief Clears the WebGL color buffer.
   */
  clear(): void {
    if (!this.gl) return;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * @brief Converts a hexadecimal color string to normalized RGB float values.
   * @param hex The hexadecimal color string (e.g. #ff0000).
   * @returns A tuple of [r, g, b] values ranging from 0.0 to 1.0.
   */
  hexToRGB(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b];
  }

  /**
   * @brief Executes the rendering pipeline for a given mathematical equation.
   * @param id The equation identifier.
   * @param glslExpr The compiled GLSL expression.
   * @param op The relational operator.
   * @param customUniforms List of custom variable names to pass as uniforms.
   * @param scope The current variable scope map.
   * @param camera The active camera state.
   * @param width The physical canvas width.
   * @param height The physical canvas height.
   * @param colorHex The rendering color in hex format.
   */
  drawEquation(
    id: string,
    glslExpr: string,
    op: string,
    customUniforms: string[],
    scope: Record<string, any>,
    camera: Camera,
    width: number,
    height: number,
    colorHex: string,
  ): void {
    const programData = this.getOrCreateProgram(
      id,
      glslExpr,
      op,
      customUniforms,
    );
    if (!programData || !this.gl || !this.quadBuffer) return;
    const gl = this.gl;

    const { program, uniforms } = programData;

    gl.useProgram(program);
    gl.viewport(0, 0, width, height);

    const posLoc = gl.getAttribLocation(program, "position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, "u_resolution");
    gl.uniform2f(resLoc, width, height);

    const camLoc = gl.getUniformLocation(program, "u_camPos");
    gl.uniform2f(camLoc, camera.state.x, camera.state.y);

    const zoomLoc = gl.getUniformLocation(program, "u_zoom");
    const dpr = window.devicePixelRatio || 1;
    gl.uniform1f(zoomLoc, camera.state.zoom * dpr);

    const locInvTransform = gl.getUniformLocation(program, "u_invTransform");
    if (locInvTransform) {
      gl.uniformMatrix2fv(locInvTransform, false, [
        camera.invTransform[0][0],
        camera.invTransform[1][0],
        camera.invTransform[0][1],
        camera.invTransform[1][1],
      ]);
    }

    const locColor = gl.getUniformLocation(program, "u_color");
    if (locColor) {
      const rgb = this.hexToRGB(colorHex);
      gl.uniform3f(locColor, rgb[0], rgb[1], rgb[2]);
    }

    for (const u of uniforms) {
      const loc = gl.getUniformLocation(program, u);
      const val = scope[u] !== undefined ? scope[u] : 0.0;
      gl.uniform1f(loc, val);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
