import React, { useState } from 'react';
import RiskCalculator from './RiskCalculator';
import Login from './Login';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const handleLogin = () => {
        setIsLoggedIn(true);
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '90%', margin: '0 auto' }}>
            {!isLoggedIn ? (
                <Login onLogin={handleLogin} />
            ) : (
                <>
                    {/* --- UPDATED HEADER SECTION --- */}
                    <div style={{ textAlign: 'center', margin: '50px 0 40px 0', padding: '0 20px' }}>
                        <h1 style={{
                            fontSize: '3.2rem',
                            fontWeight: '900',
                            background: 'linear-gradient(90deg, #2c3e50, #3498db)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            margin: '0 0 15px 0',
                            letterSpacing: '-1px'
                        }}>
                            Cardiovascular Disease Bayesian Network
                        </h1>
                        <p style={{ color: '#7f8c8d', fontSize: '1.15rem', maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
                            Explore the probabilistic dependencies between cardiovascular risk factors. Compare our static dataset baseline against the dynamic, interactive model below.
                        </p>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h2 style={{ color: '#2c3e50', fontSize: '2rem', margin: '0 0 10px 0' }}>Interactive Risk Calculator</h2>
                        <p style={{ color: '#7f8c8d', fontSize: '1.05rem', margin: '0' }}>
                            Select known patient attributes below. The Bayesian Network will update the probability based on the evidence provided.
                        </p>
                    </div>

                    <div style={{ padding: '15px', border: '1px solid #bce8f1', borderRadius: '8px', backgroundColor: '#d9edf7', color: '#31708f', marginBottom: '25px', textAlign: 'center', fontSize: '0.9rem' }}>
                        <strong>Note:</strong> This Bayesian Network is trained on a limited educational dataset (~300 records). Highly specific or unusual combinations of symptoms may result in mathematically paradoxical risk scores due to data sparsity.
                    </div>

                    {/* THE ENTIRE UI (Graphs + Form) IS NOW INSIDE HERE */}
                    <RiskCalculator />

                    <hr style={{ margin: '50px 0', border: '0', borderTop: '1px solid #e2e8f0' }} />
                </>
            )}
        </div>
    );
}

export default App;