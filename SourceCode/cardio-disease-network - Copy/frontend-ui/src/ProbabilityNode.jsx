import React from 'react';
import { Handle, Position } from 'reactflow';

const ProbabilityNode = ({ data }) => {
    // Determine header color based on whether this node has active evidence
    const headerBg = data.isObserved ? '#d4edda' : '#e6f2ff'; // Green if observed, Blue if default
    const headerColor = data.isObserved ? '#155724' : '#333';

    return (
        <div style={{...styles.nodeBox, border: data.isObserved ? '2px solid #2ecc71' : '1px solid #ccc'}}>
            <div style={{...styles.titleBar, background: headerBg, color: headerColor}}>
                <strong>{data.label}</strong>
            </div>

            <div style={styles.content}>
                {data.probs && data.probs.map((item, index) => {
                    // If evidence is provided, fade out the unselected rows
                    const isSelected = data.observedState === item.state;
                    const rowOpacity = (data.observedState && !isSelected) ? 0.3 : 1;

                    // Change bar color if it's the target disease node
                    let barColor = '#3498db'; // Default Blue
                    if (data.isObserved && data.observedState) barColor = isSelected ? '#2ecc71' : '#ccc'; // Green if selected
                    if (data.label === 'Disease Target') barColor = item.state === 'Positive' ? '#e74c3c' : '#2ecc71'; // Red for risk, Green for safe

                    return (
                        <div key={index} style={{...styles.row, opacity: rowOpacity}}>
                            <span style={styles.stateName}>{item.state}</span>
                            <div style={styles.probContainer}>
                                <div style={{...styles.bar, width: `${item.prob * 100}%`, background: barColor}}></div>
                                <span style={styles.probText}>{item.label}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
        </div>
    );
};

const styles = {
    // ... keep your exact same styles from before down here ...
    nodeBox: { minWidth: '180px', background: '#fff', borderRadius: '4px', boxShadow: '2px 2px 5px rgba(0,0,0,0.1)', fontSize: '12px', overflow: 'hidden' },
    titleBar: { padding: '8px', borderBottom: '1px solid #ccc', textAlign: 'center' },
    content: { padding: '10px' },
    row: { display: 'flex', alignItems: 'center', marginBottom: '6px' },
    stateName: { flex: '0 0 40%', fontWeight: '500' },
    probContainer: { flex: '1', position: 'relative', height: '18px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' },
    bar: { height: '100%', transition: 'all 0.5s ease' }, // Added smooth transition
    probText: { position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '100%', textAlign: 'center', lineHeight: '18px', fontSize: '11px', color: '#333', fontWeight: 'bold' }
};

export default ProbabilityNode;