import React, { useEffect, useState } from 'react';
import axios from 'axios';

const VerificationPanel = ({ evidence, isAnalyzed }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isAnalyzed) return;

        const fetchVerification = async () => {
            setLoading(true);
            try {
                // We send the current evidence to get the baseline calculation
                const response = await axios.post(`${process.env.REACT_APP_API_URL}/verify`, { evidence });
                setMetrics(response.data);
                setError(null);
            } catch (err) {
                console.error("Verification Error:", err);
                setError("Could not load verification metrics.");
            }
            setLoading(false);
        };

        fetchVerification();
    }, [evidence, isAnalyzed]);

    if (!isAnalyzed) return null;

    return (
        <div style={styles.panel}>
            <h3 style={styles.title}>Model Clinical Verification</h3>
            <p style={styles.subtitle}>Standard medical AI performance metrics based on the custom dataset.</p>

            {loading ? (
                <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Calculating clinical metrics...</p>
            ) : error ? (
                <p style={{ color: '#e74c3c' }}>{error}</p>
            ) : metrics && metrics.clinical_metrics ? (
                <div style={styles.grid}>

                    {/* ACCURACY CARD */}
                    <div style={styles.card}>
                        <h4 style={styles.cardTitle}>Overall Accuracy</h4>
                        <p style={styles.cardValue}>{metrics.clinical_metrics.accuracy}%</p>
                        <p style={styles.cardDesc}>How often the model correctly diagnoses both healthy and sick patients.</p>
                    </div>

                    {/* SENSITIVITY CARD */}
                    <div style={styles.card}>
                        <h4 style={styles.cardTitle}>Sensitivity (True Positive)</h4>
                        <p style={styles.cardValue}>{metrics.clinical_metrics.sensitivity}%</p>
                        <p style={styles.cardDesc}>If a patient actually has heart disease, how likely the model is to catch it.</p>
                    </div>

                    {/* SPECIFICITY CARD */}
                    <div style={styles.card}>
                        <h4 style={styles.cardTitle}>Specificity (True Negative)</h4>
                        <p style={styles.cardValue}>{metrics.clinical_metrics.specificity}%</p>
                        <p style={styles.cardDesc}>If a patient is healthy, how good the model is at correctly clearing them.</p>
                    </div>

                </div>
            ) : null}

            <div style={styles.footerNote}>
                <strong>Note:</strong> These metrics are calculated dynamically against the {process.env.REACT_APP_DATASET_SIZE || "~300"}-row training dataset. Because the dataset is small, real-world clinical performance may vary.
            </div>
        </div>
    );
};

const styles = {
    panel: {
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginTop: '20px',
        borderTop: '4px solid #34495e'
    },
    title: { color: '#2c3e50', margin: '0 0 5px 0' },
    subtitle: { fontSize: '0.9rem', color: '#7f8c8d', marginBottom: '20px' },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
    },
    card: {
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        textAlign: 'center'
    },
    cardTitle: { margin: '0 0 10px 0', fontSize: '1rem', color: '#34495e' },
    cardValue: { margin: '0', fontSize: '2rem', fontWeight: 'bold', color: '#2980b9' },
    cardDesc: { margin: '10px 0 0 0', fontSize: '0.8rem', color: '#7f8c8d', lineHeight: '1.4' },
    footerNote: {
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#f0f3f4',
        borderRadius: '5px',
        fontSize: '0.8rem',
        color: '#555'
    }
};

export default VerificationPanel;