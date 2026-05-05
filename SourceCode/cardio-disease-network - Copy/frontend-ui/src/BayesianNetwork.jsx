import React, { useEffect, useState } from 'react'; // <-- ADDED useState
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import dagre from 'dagre';

// 1. Import your custom node template
import ProbabilityNode from './ProbabilityNode';

// 2. Register the custom node type for React Flow
const nodeTypes = { probNode: ProbabilityNode };

// --- LAYOUT ENGINE (Auto-arranges nodes) ---
// --- LAYOUT ENGINE (Auto-arranges nodes) ---
// Replaced Dagre with a custom compact grid layout!
const getLayoutedElements = (nodes, edges) => {
    const TARGET_NODE_ID = 'Disease_Target';
    const X_SPACING = 240; // Horizontal gap between nodes
    const Y_SPACING = 280; // Vertical gap between rows
    const MAX_COLS = 5;    // Maximum nodes per row

    const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);
    const childNodes = nodes.filter(n => n.id !== TARGET_NODE_ID);

    const layoutedNodes = [];

    // 1. Place the main Target Node at the top center
    if (targetNode) {
        layoutedNodes.push({
            ...targetNode,
            position: { x: 0, y: 0 },
        });
    }

    // 2. Place all the evidence nodes in a grid below it
    childNodes.forEach((node, index) => {
        const row = Math.floor(index / MAX_COLS);
        const col = index % MAX_COLS;

        // Calculate how many items are in this specific row to center it perfectly
        const itemsInRow = Math.min(MAX_COLS, childNodes.length - (row * MAX_COLS));

        // Math to center the row underneath the parent node
        const offset = col - (itemsInRow - 1) / 2;

        layoutedNodes.push({
            ...node,
            position: {
                x: offset * X_SPACING,
                y: Y_SPACING + (row * Y_SPACING)
            },
        });
    });

    return { nodes: layoutedNodes, edges };
};

// --- NEW LOADING PLACEHOLDER COMPONENT ---
const NetworkLoadingPlaceholder = () => {
    const accentCol = '#2c3e50';
    const textCol = '#7f8c8d';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '40px', justifyContent: 'center' }}>

            {/* Header / Loader Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div style={{ width: '40px', height: '40px', border: '5px solid #e2e8f0', borderTop: `5px solid ${accentCol}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div>
                    <h3 style={{ margin: 0, color: accentCol, fontSize: '1.5rem' }}>
                        Clinical Model Initializing
                    </h3>
                    <p style={{ margin: '5px 0 0 0', color: textCol, fontSize: '1rem' }}>
                        Booting up Bayesian Network and retrieving Probability Tables...
                    </p>
                </div>
            </div>

            {/* Medical Expert Context Row (3 columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div style={placeholderCardStyle}>
                    <div style={iconStyle}>DAG</div>
                    <h4 style={cardTitleStyle}>Structural Model</h4>
                    <p style={cardTextStyle}>Building the Directed Acyclic Graph defining causal dependencies between clinical variables.</p>
                </div>
                <div style={placeholderCardStyle}>
                    <div style={iconStyle}>Bayes</div>
                    <h4 style={cardTitleStyle}>Probabilistic Fitting</h4>
                    <p style={cardTextStyle}>Calculating Conditional Probabilities for all symptom nodes against the final Disease Target.</p>
                </div>
                <div style={placeholderCardStyle}>
                    <div style={iconStyle}>RF</div>
                    <h4 style={cardTitleStyle}>Interactive Rendering</h4>
                    <p style={cardTextStyle}>Computing node positioning and rendering the interactive visualization engine.</p>
                </div>
            </div>

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

// Reusable styling helpers for the placeholder
const placeholderCardStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const iconStyle = { fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: '#f8f9fa', color: '#2c3e50', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #eee' };
const cardTitleStyle = { margin: '0 0 8px 0', color: '#2c3e50', fontSize: '1.1rem' };
const cardTextStyle = { margin: 0, fontSize: '0.9rem', color: '#7f8c8d', lineHeight: '1.5' };


// --- MAIN COMPONENT ---
const BayesianNetwork = ({ evidence = {}, finalRisk = null }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(true);

    // NEW: Store the raw mathematical baseline from the API
    const [baseNetworkData, setBaseNetworkData] = useState(null);

    // 1. Fetch baseline data ONLY ONCE on mount
    useEffect(() => {
        setIsLoading(true);
        axios.get(`${process.env.REACT_APP_API_URL}/advanced-network`)
            .then((response) => setBaseNetworkData(response.data))
            .catch((error) => console.error("Error fetching network:", error))
            .finally(() => setIsLoading(false));
    }, []);

    // 2. Recalculate nodes whenever EVIDENCE or FINAL RISK changes
    useEffect(() => {
        if (!baseNetworkData) return;

        const dynamicNodes = Object.keys(baseNetworkData.nodes).map((nodeId) => {
            let nodeProbs = [...baseNetworkData.nodes[nodeId]];
            let isObserved = false;
            let observedState = null;

            // OVERRIDE A: The final disease calculation
            if (nodeId === 'Disease_Target' && finalRisk !== null) {
                isObserved = true;
                nodeProbs = [
                    { state: 'Negative', prob: 1 - finalRisk, label: `${((1 - finalRisk) * 100).toFixed(1)}%` },
                    { state: 'Positive', prob: finalRisk, label: `${(finalRisk * 100).toFixed(1)}%` }
                ];
            }

            // OVERRIDE B: Clamp evidence to 100% if the user selected it
            if (evidence[nodeId]) {
                isObserved = true;
                observedState = evidence[nodeId];
                nodeProbs = nodeProbs.map(p => ({
                    ...p,
                    prob: p.state === observedState ? 1.0 : 0.0,
                    label: p.state === observedState ? '100%' : '0%'
                }));
            }

            return {
                id: nodeId,
                type: 'probNode',
                data: {
                    label: nodeId.replace('_', ' '),
                    probs: nodeProbs,
                    isObserved,     // Flags the node to turn green
                    observedState   // Tells the node which bar to highlight
                },
                position: { x: 0, y: 0 },
            };
        });

        // Generate edges and lay them out
        const dynamicEdges = baseNetworkData.edges.map((edge, index) => ({
            id: `e${index}`, source: edge[0], target: edge[1],
            type: 'straight', markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#b1b1b7', strokeWidth: 1.5 }
        }));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(dynamicNodes, dynamicEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

    }, [baseNetworkData, evidence, finalRisk, setNodes, setEdges]); // Reruns when props change!

    return (
        <div style={{ height: '800px', border: '1px solid #ddd', borderRadius: '12px', background: '#f8f9fa', overflow: 'hidden' }}>
            {/* 5. CONDITIONAL RENDERING: Show placeholder OR the actual graph */}
            {isLoading ? (
                <NetworkLoadingPlaceholder />
            ) : (
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-right"
                >
                    <Background color="#ccc" gap={16} />
                    <Controls />
                    <MiniMap
                        nodeColor={(node) => '#3498db'}
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                    />
                </ReactFlow>
            )}
        </div>
    );
};

export default BayesianNetwork;