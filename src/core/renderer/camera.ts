/**
 * @file camera.ts
 * @brief Viewport projection and coordinate transformation system.
 * @details Handles the conversion matrices between absolute mathematical coordinate spaces and logical screen pixel coordinates.
 */

import type { CameraState } from "../types";
import { Logger } from "../../utils/logger";

/**
 * @class Camera
 * @brief Manages spatial transformations for rendering contexts.
 */
export class Camera {
  /** @brief The current state configuration of the camera viewport. */
  state: CameraState = { x: 0, y: 0, zoom: 50 };

  /** @brief Global linear transformation matrix. */
  transform: number[][] = [
    [1, 0],
    [0, 1],
  ];
  invTransform: number[][] = [
    [1, 0],
    [0, 1],
  ];

  setTransform(mat: number[][]) {
    if (mat && mat.length === 2 && mat[0] && mat[0].length === 2) {
      this.transform = mat;
      const det = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
      if (Math.abs(det) > 1e-10) {
        this.invTransform = [
          [mat[1][1] / det, -mat[0][1] / det],
          [-mat[1][0] / det, mat[0][0] / det],
        ];
      } else {
        this.invTransform = [
          [1, 0],
          [0, 1],
        ];
      }
    } else {
      this.transform = [
        [1, 0],
        [0, 1],
      ];
      this.invTransform = [
        [1, 0],
        [0, 1],
      ];
    }
  }

  /**
   * @brief Transforms mathematical coordinates to screen pixel coordinates.
   * @param mathX The mathematical x-coordinate.
   * @param mathY The mathematical y-coordinate.
   * @param canvasWidth The current logical width of the rendering canvas.
   * @param canvasHeight The current logical height of the rendering canvas.
   * @returns A coordinate vector mapped to screen space.
   */
  mathToScreen(
    mathX: number,
    mathY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number } {
    const tx = this.transform[0][0] * mathX + this.transform[0][1] * mathY;
    const ty = this.transform[1][0] * mathX + this.transform[1][1] * mathY;
    const { x: cx, y: cy, zoom } = this.state;
    return {
      x: canvasWidth / 2 + (tx - cx) * zoom,
      y: canvasHeight / 2 - (ty - cy) * zoom,
    };
  }

  /**
   * @brief Transforms screen pixel coordinates back into mathematical coordinates.
   * @param screenX The physical x-coordinate on the screen canvas.
   * @param screenY The physical y-coordinate on the screen canvas.
   * @param canvasWidth The current logical width of the rendering canvas.
   * @param canvasHeight The current logical height of the rendering canvas.
   * @returns A coordinate vector mapped to the mathematical domain.
   */
  screenToMath(
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number } {
    const { x: cx, y: cy, zoom } = this.state;
    const tx = cx + (screenX - canvasWidth / 2) / zoom;
    const ty = cy - (screenY - canvasHeight / 2) / zoom;
    return {
      x: this.invTransform[0][0] * tx + this.invTransform[0][1] * ty,
      y: this.invTransform[1][0] * tx + this.invTransform[1][1] * ty,
    };
  }
}
