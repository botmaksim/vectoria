/**
 * @file toolRegistry.ts
 * @brief Centralized registry for all application tools and actions.
 * @details This registry allows extending the CAS panel, GeoGebra tool panel, Expression list actions, and Data Table tools dynamically.
 * It also supports creating custom tools based on existing mathematical expressions.
 */
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { expressions } from './store';
import { get } from 'svelte/store';

/**
 * @interface ToolDefinition
 * @brief Base definition for a tool in the user interface.
 */
export interface ToolDefinition {
    /** @brief Unique identifier for the tool. */
    id: string;
    /** @brief Icon representation (emoji or SVG key). */
    icon?: string;
    /** @brief Display label for the tool. */
    label: string;
    /** @brief Tooltip or long description. */
    description?: string;
    /** @brief Action to execute when the tool is triggered. If undefined, it may just change state (like ToolMode). */
    action?: (context?: any) => void;

    /** @brief Custom user-defined flag for serialization */
    isCustom?: boolean;
    /** @brief Math string or text to execute when resolving logic */
    macroTemplate?: string;
    /** @brief Original target panel when exported */
    targetPanel?: 'cas' | 'geometry' | 'expression' | 'table';
}

/** @brief Typings for specific tool locations */
export interface CasMode extends ToolDefinition {}
export interface GeometryTool extends ToolDefinition {}
export interface ExpressionAction extends ToolDefinition {}
export interface TableAction extends ToolDefinition {}

/**
 * @class ToolRegistry
 * @brief Singleton registry managing the lifecycle and categorization of tools.
 * @details Provides reactive stores for toolbars across the UI, enabling easy dynamic additions, 
 * including custom user-generated tools based on expression states.
 */
export class ToolRegistry {
    private casModes: Writable<CasMode[]> = writable([]);
    private geometryTools: Writable<GeometryTool[]> = writable([]);
    private expressionActions: Writable<ExpressionAction[]> = writable([]);
    private tableActions: Writable<TableAction[]> = writable([]);

    /**
     * @brief Constructor for the ToolRegistry. Initializes default functional toolsets.
     */
    constructor() {
        this.initializeDefaults();
    }

    private initializeDefaults() {
        // CAS Modes
        this.registerCasMode({ id: 'simplify', label: 'Simplify', description: 'Simplify expression' });
        this.registerCasMode({ id: 'expand', label: 'Expand', description: 'Expand expression' });
        this.registerCasMode({ id: 'solve', label: 'Solve(x)', description: 'Solve for x' });
        this.registerCasMode({ id: 'derivative', label: 'd/dx', description: 'Derivative with respect to x' });
        this.registerCasMode({ id: 'integrate', label: '∫ dx', description: 'Integrate with respect to x' });

        // Geometry Tools
        this.registerGeometryTool({ id: 'move', icon: '👆', label: 'tool_move', description: 'tool_move_desc' });
        this.registerGeometryTool({ id: 'point', icon: '📍', label: 'tool_point', description: 'tool_point_desc' });
        this.registerGeometryTool({ id: 'intersect', icon: '✖', label: 'tool_intersect', description: 'tool_intersect_desc' });
        this.registerGeometryTool({ id: 'segment', icon: '📏', label: 'tool_segment', description: 'tool_segment_desc' });
        this.registerGeometryTool({ id: 'line', icon: '➖', label: 'tool_line', description: 'tool_line_desc' });
        this.registerGeometryTool({ id: 'polygon', icon: '🔺', label: 'tool_polygon', description: 'tool_polygon_desc' });
        this.registerGeometryTool({ id: 'circle', icon: '⭕', label: 'tool_circle', description: 'tool_circle_desc' });
        this.registerGeometryTool({ id: 'circle3pts', icon: '⨀', label: 'tool_circle3pts', description: 'tool_circle3pts_desc' });
        this.registerGeometryTool({ id: 'midpoint', icon: '⨁', label: 'tool_midpoint', description: 'tool_midpoint_desc' });
        this.registerGeometryTool({ id: 'perpBisector', icon: '⟂', label: 'tool_perp_bisect', description: 'tool_perp_bisect_desc' });
        this.registerGeometryTool({ id: 'perpendicular', icon: '⊾', label: 'tool_perpendicular', description: 'tool_perpendicular_desc' });
        this.registerGeometryTool({ id: 'parallel', icon: '∥', label: 'tool_parallel', description: 'tool_parallel_desc' });
        this.registerGeometryTool({ id: 'conic', icon: '⬭', label: 'tool_conic', description: 'tool_conic_desc' });
        this.registerGeometryTool({ id: 'angleBisector', icon: '⦜', label: 'tool_angle_bisect', description: 'tool_angle_bisect_desc' });
        this.registerGeometryTool({ id: 'tangent', icon: '↗', label: 'tool_tangent', description: 'tool_tangent_desc' });

        this.registerGeometryTool({ id: 'delete', icon: '🗑️', label: 'tool_delete', description: 'tool_delete_desc' });

        // Expression Actions
        this.registerExpressionAction({ id: 'add_expression', icon: 'add_svg', label: 'Expression' });
        this.registerExpressionAction({ id: 'add_text', icon: '📝', label: 'Text' });
        this.registerExpressionAction({ id: 'add_table', icon: 'table_svg', label: 'Table' });
        this.registerExpressionAction({ id: 'add_folder', icon: '📁', label: 'Folder' });

        // Table Actions
        this.registerTableAction({ id: 'add_column', icon: '+', label: 'Add Column' });
        this.registerTableAction({ id: 'clear_data', icon: '🗑', label: 'Clear' });
        this.registerTableAction({ id: 'fit_linear', icon: '', label: 'Fit Line' });
        this.registerTableAction({ id: 'fit_quad', icon: '', label: 'Fit Quad' });
        this.registerTableAction({ id: 'fit_exp', icon: '', label: 'Fit Exp' });
        this.registerTableAction({ id: 'fourier', icon: '', label: 'Fourier' });
        this.registerTableAction({ id: 'voronoi', icon: '', label: 'Voronoi' });
        this.registerTableAction({ id: 'delaunay', icon: '', label: 'Delaunay' });

    }

    public getCasModes() { return this.casModes; }
    public getGeometryTools() { return this.geometryTools; }
    public getExpressionActions() { return this.expressionActions; }
    public getTableActions() { return this.tableActions; }

    /**
     * @brief Registers a new mode in the CAS panel.
     */
    public registerCasMode(mode: CasMode) {
        this.casModes.update(modes => [...modes, mode]);
    }

    /**
     * @brief Registers a new tool in the Geometry/Physics (GeoGebra) panel.
     */
    public registerGeometryTool(tool: GeometryTool) {
        this.geometryTools.update(tools => [...tools, tool]);
    }

    /**
     * @brief Registers a new action in the Expression (Functions) panel.
     */
    public registerExpressionAction(action: ExpressionAction) {
        this.expressionActions.update(actions => [...actions, action]);
    }

    /**
     * @brief Registers a new action in the Table tools.
     */
    public registerTableAction(action: TableAction) {
        this.tableActions.update(actions => [...actions, action]);
    }
    /**
     * @brief Creates a custom action tool derived from an existing mathematical expression.
     * @details For example, if expression has text 'f(x) = sin(x)', this will create a tool that pastes or uses 'f(x)'.
     * @param targetPanel The panel to append the tool to ('cas', 'geometry', 'expression', 'table').
     * @param expressionId The ID of the existing expression to base this tool on.
     * @param customLabel An optional label overriding the expression's text.
     */
    public createCustomToolFromExpression(targetPanel: 'cas' | 'geometry' | 'expression' | 'table', expressionId: string, customLabel?: string) {
        const allExprs = get(expressions);
        const sourceExpr = allExprs.find(e => e.id === expressionId);
        if (!sourceExpr || !sourceExpr.text) return;

        const label = customLabel || `Use: ${sourceExpr.text.split('=')[0] || sourceExpr.text.substring(0, 5)}`;
        
        let macro = '';
        const funcNameMatch = sourceExpr.text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\(/);
        if (funcNameMatch) {
            macro = `${funcNameMatch[1]}(x)`;
        } else {
            macro = `(${sourceExpr.text})`;
        }

        const toolTemplate: ToolDefinition = {
            id: `custom_tool_${Date.now()}`,
            icon: '🔧',
            label: label,
            description: `Auto-generated custom function mapping to: ${sourceExpr.text}`,
            isCustom: true,
            macroTemplate: macro,
            targetPanel: targetPanel,
            action: (context?: any) => {
                expressions.addExpression(macro);
            }
        };

        this.addToolToPanel(targetPanel, toolTemplate);
    }

    private addToolToPanel(targetPanel: 'cas' | 'geometry' | 'expression' | 'table', toolTemplate: ToolDefinition) {
        switch (targetPanel) {
            case 'cas': this.registerCasMode(toolTemplate); break;
            case 'geometry': this.registerGeometryTool(toolTemplate); break;
            case 'expression': this.registerExpressionAction(toolTemplate); break;
            case 'table': this.registerTableAction(toolTemplate); break;
        }
    }

    /**
     * @brief Serializes all custom tools to a JSON string.
     */
    public exportCustomTools(): string {
        const allCustomTools: ToolDefinition[] = [];
        const extractCustom = (tools: ToolDefinition[]) => tools.filter(t => t.isCustom);
        
        allCustomTools.push(...extractCustom(get(this.casModes)));
        allCustomTools.push(...extractCustom(get(this.geometryTools)));
        allCustomTools.push(...extractCustom(get(this.expressionActions)));
        allCustomTools.push(...extractCustom(get(this.tableActions)));

        // Remove the transient action function for serialization
        const serialized = allCustomTools.map(t => ({...t, action: undefined}));
        return JSON.stringify(serialized, null, 2);
    }

    /**
     * @brief Loads custom tools from a JSON string and maps them back into UI panels.
     */
    public importCustomTools(jsonStr: string) {
        try {
            const tools: ToolDefinition[] = JSON.parse(jsonStr);
            tools.forEach(tool => {
                if (!tool.isCustom || !tool.macroTemplate || !tool.targetPanel) return;

                // Restore action logic
                tool.action = () => {
                    expressions.addExpression(tool.macroTemplate!);
                };

                // Prevent duplicates
                const targetStore = this.getStoreForPanel(tool.targetPanel);
                if (!get(targetStore).find(t => t.id === tool.id)) {
                    this.addToolToPanel(tool.targetPanel, tool);
                }
            });
        } catch (e) {
            console.error('Failed to import custom tools:', e);
        }
    }

    private getStoreForPanel(panel: 'cas' | 'geometry' | 'expression' | 'table') {
        switch(panel) {
            case 'cas': return this.casModes;
            case 'geometry': return this.geometryTools;
            case 'expression': return this.expressionActions;
            case 'table': return this.tableActions;
        }
    }
}

export const toolsRegistry = new ToolRegistry();
