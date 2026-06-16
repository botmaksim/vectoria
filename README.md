<div align="center">
  <img src="https://raw.githubusercontent.com/sveltejs/branding/master/svelte-logo.svg" alt="Vectoria Logo" width="120" />

  # Vectoria

  **Next-Generation Mathematical Graphing Calculator & Simulation Engine**

  <p align="center">
    A highly performant, GPU-accelerated alternative to Desmos and GeoGebra. Engineered with Svelte, WebGL, WebWorkers, mathematical structural parsers, and a comprehensive continuous constraints physics engine.
  </p>

  [![Svelte](https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev/)
  [![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://get.webgl.org/)
  [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

<br />

## 💡 Architectural Directives

Vectoria was architected to transcend conventional limitations of synchronous browser-based plotting pipelines. By leveraging an **Asynchronous WebWorker Orchestration Pool** coupled tightly with a **Dual-Layer Rendering Sequence** (incorporating concurrent Canvas 2D routines and GLSL Fragment evaluation protocols), Vectoria guarantees structural integrity and zero frame-dropping, regardless of topological mesh density. 

Furthermore, Vectoria strictly elevates mathematical syntax directly into continuous visual simulation protocols incorporating real-world constraints via its embedded discrete **Verlet Physics Integration Engine**, translating static algebra dynamically into mechanical linkages and fluid hydrodynamics representations.

---

## 🚀 Advanced Deployment Capabilities

*   **Fourier Analysis & Epicycles:** Perform a Discrete Fourier Transform (DFT) automatically on any parametric curve or imported scalar dataset using `Fourier(x, y)` to visualize rotational epicycles recursively tracing topography.
*   **Intuitive CAD Interface:** Beyond structural text input, utilize native CAD mouse interaction patterns. Click and drag geometric intersections automatically or calculate dynamic `AngleBisector(A, B, C)` relations utilizing responsive pointer capabilities. Construct `Intersection(LineA, LineB)` completely programmatically.
*   **Strict Codebase Documentation:** Enforces rigid Doxygen C++-style comment parameter tracking rules executing `make doxygen` dynamically producing integrated documentation sets validating architectural constraints directly.
* **Algorithmic Sonification (Wavetable Oscillators):** Convert mapped implicit contours and 2D topology graphs into real-time auditory waveforms utilizing Web Audio API via `Oscillator`. Actively modulate parameter sliders to synthesize shifting harmonic overtone timbres dynamically.
* **Voronoi / Delaunay Space Partitioning:** Synthesize spatial diagrams explicitly over array inputs `Voronoi(pts)` or `Delaunay(pts)`, seamlessly integrating point cloud boundaries from external imported tabular CSV coordinates.
* **GPU-Accelerated Implicit Matrix Rendering:** Compiles arbitrary AST inputs via distributed asynchronous WebWorkers into natively bound GLSL fragment shaders mapping highly complex continuous contour structures (e.g. `x^2 + y^2 = 25`) with mathematical exactitude.
* **Global Matrix Linear Algebra:** Execute operations using defined 2x2 matrices (e.g. `[[cos(t), -sin(t)], [sin(t), cos(t)]]`). Directly manipulate the Cartesian canvas coordinate topography visually utilizing globally mapped transformations via `Transform(matrix)`.
* **Data Science & Tracing Algorithms:** Apply temporal memory maps for moving mathematical elements visually with `Trace(entity)`. Input massive JSON/CSV topological databases seamlessly into UI datasets, implementing intelligent gradient descent Line Fitting approximations automatically resolving Linear, Quadratic, and Exponential regressions.
* **Fluid Dynamic & Kinematic Timelines:** Native Timeline scrubbing UI handles continuous mathematical constants (i.e., `t`). Play, loop, pause, and step simulations precisely.
* **Hydrodynamic Vector Mapping:** Natively incorporates particle advection to render localized divergence algorithms and density variations for given spatial velocity parameters utilizing the `VectorField()` syntactical directive.
* **Continuous Constraint Physics Framework:** Provides users access to a fully resolved Verlet iterative mechanism executing bounded length tolerances and physical kinematics models through explicitly registered `PhysicsNode()` and `PhysicsLink()` coordinates. 
* **Symbolic Calculus Analysis & CAS Navigation:** An encapsulated analytic solver performing integration limits dynamically `int(expr, x, bounds)`, coupled synchronously with discrete `d/dx` representations over an integrated computation side-panel leveraging Nerdamer implementations.
* **Audio Sonification Transduction:** Synthesizes Y-delta geometries against stereophonic panning architectures via native standard `AudioContext` sweeps, converting purely visual parameters into direct auditory oscillations and frequencies.
* **Responsive Geometric Primitives Matrix:** Fully extensible API covering static coordinate assignments, intersecting ray boundaries, perpendicular bisectors, parameter sequences, and comprehensive table matrix tracking algorithms mapping directly over visual coordinates.

---

## 🛠 Infrastructure Topology

Vectoria is rigidly structured incorporating modular abstraction boundaries adhering to modern application scale frameworks:

### **Runtime Modules**
* **[Svelte 5 Runes](https://svelte.dev/):** Reactive orchestration bindings dynamically synchronizing system parameters without framework blocking procedures.
* **[MathLive](https://cortexjs.io/mathlive/):** Embedded mathematical topography processing `<math-field>` artifacts to correctly represent standard LaTeX matrix formatting.
* **Worker Delegation Pipelines:** Specialized off-thread compilers strictly insulating MathJS node resolution layers from rendering event-loops avoiding latency cascade anomalies.

### **Core Systems Architecture (`/src/core`)**
* `evaluator.ts` and `geometryCompiler.ts`: Deep logic layers sequentially executing string reduction mappings parsing complex syntactic constraints into distinct geometric node classes.
* `physicsEngine.ts`: Embedded physics continuous solver performing time-stepping verlet integrations correcting displacement residuals iteratively.
* `plotter.ts` & Component Aggregations: Dynamic routing engine pushing coordinates out to immediate WebGL matrices or fallback explicit functional canvas traces based entirely on runtime evaluations.
  
---

## 💻 Initialization Instructions

### 1. Requisites Definition
Evaluate existence of local Node execution resources mapping correctly to Node.JS protocol versions exceeding > `v18.0`.

### 2. Assembly Directives
Acquire repository artifacts locally resolving NPM tree dependencies sequentially.
```bash
git clone https://github.com/your-username/vectoria.git
cd vectoria
npm install
```

### 3. Subsystem Boot Sequences
Trigger localized Vite orchestration pipeline rendering runtime logic to hot-reloaded modules.
```bash
npm run dev
```
Route designated browsers explicitly targeting `http://localhost:5173`.

---

## 🐳 Docker Deployment Strategy

Vectoria implements containerized encapsulation pipelines conforming directly to remote server deployment directives constructing purely static artifacts via an optimized multi-tier alpine image methodology.

### Container Synthesis
```bash
docker build -t vectoria-app .
```

### Protocol Binding
```bash
docker run -d -p 8080:80 --name vectoria vectoria-app
```
Application state becomes resolvable globally facing via mapped default HTTP `http://localhost:8080`.

---

## 📄 Licensing Information

Authorized under the MIT License distribution model. Verify included `LICENSE` definition mappings.
