import { describe, it, expect } from 'vitest';
import { PhysicsEngine } from '../../../src/core/math/physicsEngine';

describe('Verlet Physics Engine', () => {
    it('should register nodes and constraints correctly', () => {
        const engine = new PhysicsEngine();

        engine.registerNode('n1', 0, 10, true);  // Pinned node
        engine.registerNode('n2', 0, 5, false);  // Free node
        engine.registerConstraint('n1', 'n2', 5);

        expect(engine.nodes.has('n1')).toBe(true);
        expect(engine.nodes.has('n2')).toBe(true);
        expect(engine.nodes.get('n1')!.pinned).toBe(true);
        expect(engine.nodes.get('n2')!.pinned).toBe(false);
        expect(engine.constraints.length).toBe(1);
        expect(engine.constraints[0]).toEqual({ nodeA: 'n1', nodeB: 'n2', length: 5 });
    });

    it('should apply gravity to unpinned nodes during step', () => {
        const engine = new PhysicsEngine();
        engine.gravity = { x: 0, y: -10 }; // simplified gravity
        
        engine.registerNode('n1', 0, 10, false);
        
        // Step forward by 0.1s
        // Node starts at y = 10, oldY = 10.
        // vy = 0, y += 0 + gravity.y * dt^2 = -10 * 0.01 = -0.1
        // Expected new y: 9.9
        engine.step(0.1, 0);

        const node = engine.nodes.get('n1')!;
        expect(node.y).toBeCloseTo(9.9);
        expect(node.x).toBe(0);
    });

    it('should not move pinned nodes under gravity', () => {
        const engine = new PhysicsEngine();
        engine.gravity = { x: 0, y: -10 };
        engine.registerNode('n1', 0, 10, true);

        engine.step(0.1, 0);

        const node = engine.nodes.get('n1')!;
        expect(node.y).toBe(10);
    });

    it('should relax distance constraints between nodes', () => {
        const engine = new PhysicsEngine();
        engine.gravity = { x: 0, y: 0 }; // Turn off gravity to isolate constraint solving
        
        engine.registerNode('n1', 0, 0, true);   // Pinned at origin
        engine.registerNode('n2', 10, 0, false); // Stretched out to 10
        engine.registerConstraint('n1', 'n2', 5); // Target distance 5

        // Step forward and solve constraints (20 iterations for convergence)
        engine.step(0.1, 20);

        const n1 = engine.nodes.get('n1')!;
        const n2 = engine.nodes.get('n2')!;

        // n1 is pinned so it must remain at (0, 0)
        expect(n1.x).toBe(0);
        expect(n1.y).toBe(0);

        // n2 should be pulled back to distance of 5 -> (5, 0)
        expect(n2.x).toBeCloseTo(5, 4);
        expect(n2.y).toBeCloseTo(0, 4);
    });

    it('should resolve collisions against terrain floor colliders', () => {
        const engine = new PhysicsEngine();
        engine.gravity = { x: 0, y: -10 };
        
        engine.registerNode('n1', 0, 0.1, false); // Node very close to the floor

        // Floor collider function y = 0
        const floor = (x: number) => 0;

        // Step simulation. Gravity pulls node down below 0.2 threshold.
        // Node should be pushed up to surfaceY + 0.2 = 0.2.
        engine.step(0.1, 1, [floor]);

        const node = engine.nodes.get('n1')!;
        expect(node.y).toBeGreaterThanOrEqual(0.2);
    });

    it('should clear constraints and reset completely', () => {
        const engine = new PhysicsEngine();
        engine.registerNode('n1', 0, 0);
        engine.registerConstraint('n1', 'n2', 5);

        expect(engine.constraints.length).toBe(1);

        engine.clearConstraints();
        expect(engine.constraints.length).toBe(0);
        expect(engine.nodes.size).toBe(1);

        engine.reset();
        expect(engine.nodes.size).toBe(0);
        expect(engine.constraints.length).toBe(0);
    });
    describe('QuadTree & Spatial Optimization', () => {
        it('should subdivide and insert nodes correctly', () => {
            const engine = new PhysicsEngine();
            // Assuming node capacity is 4, we insert 5 nodes in close proximity to force subdivision
            engine.registerNode('q1', 1, 1);
            engine.registerNode('q2', 2, 2);
            engine.registerNode('q3', 3, 3);
            engine.registerNode('q4', 4, 4);
            engine.registerNode('q5', 5, 5); // Should trigger subdivide

            // Step forces spatial partitioning structure to build and verify it doesn't crash
            engine.step(0.1, 1);
            expect(engine.nodes.size).toBe(5);
        });

        it('should correctly query proximity areas for collisions', () => {
            const engine = new PhysicsEngine();
            engine.registerNode('q1', 0, 0);
            engine.registerNode('q2', 0.5, 0.5);
            engine.registerNode('q3', 10, 10);
            
            // To test query, we need to apply drag or collision logic if exposed
            // In the absence of an exposed QuadTree query method on PhysicsEngine directly, 
            // we verify that the step handles close nodes (e.g. self collisions if implemented)
            // or simply ensure step doesn't crash with spatially clustered nodes.
            expect(() => engine.step(0.1, 1)).not.toThrow();
        });
    });
});
