/**
 * @file types.ts
 * @brief Global type definitions for the Geomos application.
 * @details Contains interfaces defining the core domain objects, such as mathematical expressions, data tables, and viewport camera states.
 */

/**
 * @interface Expression
 * @brief Represents a user-defined mathematical expression or a data table.
 */
export interface Expression {
  /** @brief A globally unique identifier for the expression. */
  id: string;

  /** @brief Optional folder grouping identifier. */
  folderId?: string;

  /** @brief The structural type of the item. */
  type?: "math" | "table" | "text";

  /** @brief The raw text/ascii representation of the mathematical expression. */
  text: string;

  /** @brief The LaTeX representation utilized by MathLive for high-fidelity typesetting. */
  latex: string;

  /** @brief Relational operator for inequalities and implicit functions. */
  operator?: "=" | "<" | ">" | "<=" | ">=";

  /** @brief If true, this expression block behaves as a rich text/markdown annotation. */
  isText?: boolean;

  /** @brief The hexadecimal color code assigned to the expression for plotting. */
  color: string;

  /** @brief Boolean flag determining if the expression should be rendered on the canvas. */
  visible: boolean;

  /** @brief (Table only) The column header for the independent variable x. */
  xCol?: string;

  /** @brief (Table only) The column header for the dependent variable y. */
  yCol?: string;

  /** @brief (Table only) The array of coordinate points defined within the table. */
  points?: { x: number | null; y: number | null }[];

  /** @brief The stroke width utilized when plotting lines for this expression. */
  lineWidth?: number;

  /** @brief (Regression only) Calculated parameters and statistics */
  regressionParams?: Record<string, number>;
  regressionRSquared?: number;

  /** @brief Real-time evaluation result string (e.g. geometric equation or numeric evaluation) */
  substitutedResult?: string;

  /** @brief The stroke style pattern utilized when plotting lines. */
  lineStyle?: "solid" | "dashed" | "dotted";

  /** @brief The geometric shape utilized when plotting discrete points. */
  pointStyle?: "circle" | "cross" | "diamond";
}

/**
 * @interface CameraState
 * @brief Represents the viewing parameters for the mathematical coordinate system.
 */
export interface CameraState {
  /** @brief The x-coordinate of the camera's center in mathematical space. */
  x: number;

  /** @brief The y-coordinate of the camera's center in mathematical space. */
  y: number;

  /** @brief The zoom level, defined as the number of screen pixels per mathematical unit. */
  zoom: number;
}

/**
 * @interface Folder
 * @brief Represents a collapsible grouping of expressions.
 */
export interface Folder {
  /** @brief A globally unique identifier for the folder. */
  id: string;

  /** @brief The display name of the folder. */
  title: string;

  /** @brief Whether the folder's contents are currently collapsed. */
  collapsed: boolean;

  /** @brief The color theme assigned to the folder icon/border. */
  color: string;
}
