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
  lastDt: number = 0;

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
   * @param id:string
   * @param x:number
   * @param y:number
   * @param pinned:boolean
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
   * @param nodeA:string
   * @param nodeB:string
   * @param length:number
   */
  reset() {
    Logger.info("PhysicsEngine", "Resetting all nodes and constraints.");
    this.nodes.clear();
    this.constraints = [];
    this.lastDt = 0;
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
    if (dt <= 0) return;

    // Time-Corrected Verlet (TCV): account for variable delta time safely
    let timeScale = this.lastDt > 0 ? (dt / this.lastDt) : 1.0;
    // Strictly bound timescale to prevent velocity explosion when FPS stutters
    timeScale = Math.min(Math.max(timeScale, 0.8), 1.2);
    this.lastDt = dt;
    
    // Add slight damping to remove accumulated numerical errors
    const damping = 0.999;

    for (const node of this.nodes.values()) {
      if (node.pinned) continue;
      const vx = (node.x - node.oldX) * timeScale * damping;
      const vy = (node.y - node.oldY) * timeScale * damping;
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

    const stiffness = 0.8; // Relaxation factor to prevent explosions in complex overlapping structures

    for (let i = 0; i < iterations; i++) {
      for (const c of this.constraints) {
        const a = this.nodes.get(c.nodeA);
        const b = this.nodes.get(c.nodeB);
        if (!a || !b) continue;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) continue;

        const diff = (c.length - dist) / dist;
        
        const massA = a.pinned ? 0 : 1;
        const massB = b.pinned ? 0 : 1;
        const totalMass = massA + massB;
        
        if (totalMass === 0) continue;

        const ratioA = massA / totalMass;
        const ratioB = massB / totalMass;

        const offsetX = dx * diff * stiffness;
        const offsetY = dy * diff * stiffness;

        if (!a.pinned) {
          a.x -= offsetX * ratioA;
          a.y -= offsetY * ratioA;
        }
        if (!b.pinned) {
          b.x += offsetX * ratioB;
          b.y += offsetY * ratioB;
        }
      }
    }
  }
}

export const physicsEngine = new PhysicsEngine();
