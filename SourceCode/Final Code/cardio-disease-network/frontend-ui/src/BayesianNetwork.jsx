import React, { useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import dagre from 'dagre';

// 1. Import your new custom node template
import ProbabilityNode from './ProbabilityNode';

// 2. Register the custom node type for React Flow
const nodeTypes = { probNode: ProbabilityNode };

// --- LAYOUT ENGINE (Auto-arranges nodes) ---
const getLayoutedElements = (nodes, edges) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 }); // Added extra spacing

    // --- CRITICAL FIX: Create empty objects for edges so dagre doesn't crash ---
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
        // UPDATED SIZING: The new probability nodes are much larger,
        // so we tell dagre to reserve a 250x150 box for each one.
        dagreGraph.setNode(node.id, { width: 250, height: 150 });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate the layout
    dagre.layout(dagreGraph);

    // Apply the calculated positions to the React Flow nodes
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
            ...node,
            targetPosition: 'top',
            sourcePosition: 'bottom',
            position: {
                x: nodeWithPosition.x - 125, // Shift by half the new width (250/2)
                y: nodeWithPosition.y - 75,  // Shift by half the new height (150/2)
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

const BayesianNetwork = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        // 3. Fetch from the NEW Python endpoint that includes the probabilities
        axios.get(`${process.env.REACT_APP_API_URL}/advanced-network`)
            .then((response) => {
                const rawData = response.data;

                // 4. Convert Python object dictionary into React Flow nodes
                const initialNodes = Object.keys(rawData.nodes).map((nodeId) => ({
                    id: nodeId,
                    type: 'probNode', // Use the custom component
                    data: {
                        label: nodeId.replace('_', ' '), // Clean up the title
                        probs: rawData.nodes[nodeId]     // Pass the probability array
                    },
                    position: { x: 0, y: 0 }, // Position will be fixed by dagre
                }));

                const initialEdges = rawData.edges.map((edge, index) => ({
                    id: `e${index}`,
                    source: edge[0],
                    target: edge[1],
                    type: 'smoothstep',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#b1b1b7', strokeWidth: 1.5 }
                }));

                // Apply Auto-Layout
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    initialNodes,
                    initialEdges
                );

                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
            })
            .catch((error) => console.error("Error fetching network:", error));
    }, [setNodes, setEdges]);

    return (
        // Increased height to 800px to accommodate the taller graph
        <div style={{ height: '800px', border: '1px solid #ddd', borderRadius: '8px', background: '#f8f9fa' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes} // 5. Inject custom nodes here
                fitView
                attributionPosition="bottom-right"
            >
                <Background color="#ccc" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default BayesianNetwork;