import React from 'react';
import { Handle, Position } from 'reactflow';

// This is the custom component for each node in the graph
const ProbabilityNode = ({ data }) => {
    return (
        <div style={styles.nodeBox}>
            {/* The blue title bar */}
            <div style={styles.titleBar}>
                <strong>{data.label}</strong>
            </div>

            {/* The probability table */}
            <div style={styles.content}>
                {data.probs && data.probs.map((item, index) => (
                    <div key={index} style={styles.row}>
                        {/* State Name (e.g., "True", "High") */}
                        <span style={styles.stateName}>{item.state}</span>

                        {/* Probability container with bar chart and percentage */}
                        <div style={styles.probContainer}>
                            {/* The blue progress bar */}
                            <div style={{...styles.bar, width: `${item.prob * 100}%`}}></div>
                            {/* The percentage text positioned on top */}
                            <span style={styles.probText}>{item.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input/Output handles for connections */}
            <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
        </div>
    );
};

const styles = {
    nodeBox: {
        minWidth: '180px',
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
        fontSize: '12px',
        overflow: 'hidden',
    },
    titleBar: {
        background: '#e6f2ff', // Light blue header
        padding: '8px',
        borderBottom: '1px solid #ccc',
        textAlign: 'center',
        color: '#333',
    },
    content: {
        padding: '10px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px',
    },
    stateName: {
        flex: '0 0 40%', // Takes up 40% of the width
        fontWeight: '500',
    },
    probContainer: {
        flex: '1', // Takes remaining space
        position: 'relative',
        height: '18px',
        background: '#f0f0f0',
        borderRadius: '3px',
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        background: '#3498db', // The blue bar color
        transition: 'width 0.3s ease',
    },
    probText: {
        position: 'absolute',
        top: '0',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        textAlign: 'center',
        lineHeight: '18px',
        fontSize: '11px',
        color: '#333',
        fontWeight: 'bold',
        textShadow: '1px 1px 1px rgba(255,255,255,0.8)'
    }
};

export default ProbabilityNode;