import React from 'react';
import BayesianNetwork from './BayesianNetwork';
import RiskCalculator from './RiskCalculator'; // <--- Import it

function App() {
    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>

            {/* --- UPDATED HEADER SECTION --- */}
            <div style={{ textAlign: 'center', margin: '40px 0 50px 0' }}>
                <h1 style={{ color: '#2c3e50', fontSize: '2.8rem', fontWeight: '800', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
                    Cardiovascular Disease Bayesian Network
                </h1>
                <p style={{ color: '#7f8c8d', fontSize: '1.2rem', margin: '0', fontWeight: '400' }}>
                    This graph visualizes the probabilistic dependencies between risk factors.
                </p>
            </div>
            {/* ----------------------------- */}

            {/* 1. The Graph Visualization */}
            <BayesianNetwork />

            <hr style={{ margin: '50px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />

            {/* 2. The Interactive Calculator */}
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ color: '#2c3e50', fontSize: '2rem', margin: '0 0 10px 0' }}>Interactive Risk Calculator</h2>
                <p style={{ color: '#7f8c8d', fontSize: '1.05rem', margin: '0' }}>
                    Select known patient attributes below. The Bayesian Network will update the probability based on the evidence provided.
                </p>
            </div>

            <div className="alert-info text-sm mt-4 p-4 border rounded-lg bg-blue-50 text-blue-800 shadow-sm mb-6 text-center">
                <strong>Note:</strong> This Bayesian Network is trained on a limited educational dataset (~300 records). Highly specific or unusual combinations of symptoms may result in mathematically paradoxical risk scores due to data sparsity.
            </div>

            <RiskCalculator />

            <hr style={{ margin: '50px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />

        </div>
    );
}


export default App;