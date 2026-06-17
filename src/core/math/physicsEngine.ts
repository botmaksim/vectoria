/**
 * @file physicsEngine.ts
 * @brief Continuous Verlet integration constraint-based physics engine.
 * @details Solves spatial position constraints for kinematic structures. Extremely useful for rigid linkages and pendulums.
 */
import { Logger } from "../../utils/logger";

/**
 * @interface VerletNode
 * @brief Represents a point mass in the physics simulation.
 */
export interface VerletNode {
  id: string; /**< Unique identifier for the node. */
  x: number; /**< Current X position. */
  y: number; /**< Current Y position. */
  oldX: number; /**< Previous X position for Verlet velocity calculation. */
  oldY: number; /**< Previous Y position for Verlet velocity calculation. */
  pinned: boolean; /**< Indicates if the node is statically fixed in space. */
}

/**
 * @interface VerletConstraint
 * @brief Represents a distance constraint between two nodes.
 */
export interface VerletConstraint {
  nodeA: string; /**< Identifier of the first node. */
  nodeB: string; /**< Identifier of the second node. */
  length: number; /**< Rest length to maintain between the two nodes. */
}

/**
 * @class PhysicsEngine
 * @brief Manages the Verlet integration simulation of nodes and constraints.
 */
export class PhysicsEngine {
  nodes = new Map<string, VerletNode>();
  constraints: VerletConstraint[] = [];
  gravity = { x: 0, y: -9.81 };

  /**
   * @brief Registers or updates a node in the physics engine.
   * @param id Unique identifier.
   * @param x Initial X position.
   * @param y Initial Y position.
   * @param pinned Whether the node is fixed.
   */
  registerNode(id: string, x: number, y: number, pinned: boolean = false) {
    if (!this.nodes.has(id)) {
      Logger.debug("PhysicsEngine", `Registering new node: ${id}`);
      this.nodes.set(id, { id, x, y, oldX: x, oldY: y, pinned });
    } else if (pinned) {
      const node = this.nodes.get(id)!;
      node.x = x;
      node.y = y;
      node.pinned = true;
    }
  }

  /**
   * @brief Registers a new constraint between two nodes.
   * @param nodeA First node ID.
   * @param nodeB Second node ID.
   * @param length Distance to maintain.
   */
  registerConstraint(nodeA: string, nodeB: string, length: number) {
    const id1 = nodeA;
    const id2 = nodeB;
    if (
      !this.constraints.find(
        (c) =>
          (c.nodeA === id1 && c.nodeB === id2) ||
          (c.nodeA === id2 && c.nodeB === id1),
      )
    ) {
      Logger.debug(
        "PhysicsEngine",
        `Registering constraint between ${nodeA} and ${nodeB}`,
      );
      this.constraints.push({ nodeA, nodeB, length });
    }
  }

  /**
   * @brief Clears all constraints from the simulation.
   */
  clearConstraints() {
    this.constraints = [];
  }

  /**
   * @brief Resets the physics engine by clearing all nodes and constraints.
   */
  reset() {
    Logger.info("PhysicsEngine", "Resetting all nodes and constraints.");
    this.nodes.clear();
    this.constraints = [];
  }

  /**
   * @brief Steps the physics simulation forward by a given time step.
   * @param dt Time delta (in seconds).
   * @param iterations Number of constraint relaxation iterations.
   * @param colliders Array of math functions determining terrain floors.
   */
  step(
    dt: number,
    iterations: number = 5,
    colliders: ((x: number) => number)[] = [],
  ) {
    if (dt > 0.1) dt = 0.1;

    for (const node of this.nodes.values()) {
      if (node.pinned) continue;
      const vx = node.x - node.oldX;
      const vy = node.y - node.oldY;
      node.oldX = node.x;
      node.oldY = node.y;
      node.x += vx + this.gravity.x * dt * dt;
      node.y += vy + this.gravity.y * dt * dt;

      for (const col of colliders) {
        try {
          const surfaceY = col(node.x);
          if (node.y < surfaceY + 0.2) {
            node.y = surfaceY + 0.2;

            const bounce = 0.3;
            const friction = 0.8;
            const currentVy = node.y - node.oldY;
            const currentVx = node.x - node.oldX;

            node.oldY = node.y + currentVy * bounce;
            node.oldX = node.x - currentVx * friction;
          }
        } catch {}
      }
    }

    for (let i = 0; i < iterations; i++) {
      for (const c of this.constraints) {
        const a = this.nodes.get(c.nodeA);
        const b = this.nodes.get(c.nodeB);
        if (!a || !b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;

        const diff = (c.length - dist) / dist;
        const offsetX = dx * 0.5 * diff;
        const offsetY = dy * 0.5 * diff;

        if (!a.pinned) {
          a.x -= offsetX;
          a.y -= offsetY;
        }
        if (!b.pinned) {
          b.x += offsetX;
          b.y += offsetY;
        }
      }
    }
  }
}

export const physicsEngine = new PhysicsEngine();
