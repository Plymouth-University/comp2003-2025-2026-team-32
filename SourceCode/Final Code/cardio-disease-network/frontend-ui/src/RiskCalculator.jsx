import React, { useState } from 'react';
import axios from 'axios';
import VerificationPanel from './VerificationPanel';


const RiskCalculator = () => {
    const [evidence, setEvidence] = useState({});
    const [treatments, setTreatments] = useState({ statin: 'None', bp_med: 'None', pci: 'None' });

    // Results
    const [bayesResult, setBayesResult] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleEvidenceChange = (e) => {
        const { name, value } = e.target;
        const newEvidence = { ...evidence };
        if (value === "") delete newEvidence[name];
        else newEvidence[name] = value;
        setEvidence(newEvidence);
    };

    const handleTreatmentChange = (e) => {
        const { name, value } = e.target;
        setTreatments(prev => ({ ...prev, [name]: value }));
    };

    const calculateRisk = async () => {
        setLoading(true);
        setError(null);
        setBayesResult(null);
        setChatHistory([]);

        const payload = { evidence, treatments };

        try {
            // 1. Call Bayesian Model
            const bayesReq = axios.post(`${process.env.REACT_APP_API_URL}/predict`, payload);

            // 2. Call AI Wrapper (Run in parallel!)
            const aiReq = axios.post(`${process.env.REACT_APP_API_URL}/ask-ai`, payload);

            const [bayesRes, aiRes] = await Promise.all([bayesReq, aiReq]);

            setBayesResult(bayesRes.data);
            setChatHistory([{ role: 'model', content: aiRes.data.ai_response }]);

        } catch (err) {
            console.error(err);
            setError("Calculation failed. Check backend/API Key.");
        }
        setLoading(false);
    };

    const handleReset = () => {
        setEvidence({});
        setTreatments({ statin: 'None', bp_med: 'None', pci: 'None' });
        setBayesResult(null);
        setChatHistory([]);
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = { role: 'user', content: chatInput };
        const updatedHistory = [...chatHistory, userMsg];
        setChatHistory(updatedHistory);
        setChatInput("");
        setAiLoading(true);

        try {
            const payload = {
                evidence,
                treatments,
                message: chatInput,
                history: chatHistory // Send the prior conversation context
            };

            const res = await axios.post(`${process.env.REACT_APP_API_URL}/chat-ai`, payload);
            setChatHistory(prev => [...prev, { role: 'model', content: res.data.reply }]);
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'model', content: "Sorry, I lost connection to the server." }]);
        }
        setAiLoading(false);
    };



    // 1. Explicitly list all 9 patient data attributes from your form
    const requiredFields = [
        "Age_Bin", "Sex_Label", "BP_Bin", "Chol_Bin",
        "HR_Bin", "CP_Label", "FBS_Label", "CA_Label", "Thal_Label"
    ];

    // 2. Check that every single required field exists in 'evidence' and isn't the default value
    const isFormValid = requiredFields.every(field => {
        const val = evidence[field];
        return val !== undefined && val !== "" && val !== "-- Select --";
    });

    return (
        <div style={styles.container}>

            <div style={styles.topRow}>






                {/* --- COLUMN 1: INPUT FORM --- */}
                <div style={styles.inputPanel}>
                    <div style={styles.header}>
                        <h2>Patient Data</h2>
                        <button onClick={handleReset} style={styles.resetBtn}>Reset</button>
                    </div>

                    <div style={styles.scrollableForm}>
                        {/* 1. AGE: Based on bins [0, 45, 60, 120] */}
                        <FormSelect label="Age Group" name="Age_Bin" value={evidence.Age_Bin} onChange={handleEvidenceChange}>
                            <option value="Young">Young (&lt; 45 years)</option>
                            <option value="Middle">Middle (45 - 60 years)</option>
                            <option value="Old">Old (&gt; 60 years)</option>
                        </FormSelect>

                        <FormSelect label="Sex" name="Sex_Label" value={evidence.Sex_Label} onChange={handleEvidenceChange}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </FormSelect>

                        {/* 2. BLOOD PRESSURE: Based on bins [0, 120, 140, 300] */}
                        <FormSelect label="Blood Pressure (Resting)" name="BP_Bin" value={evidence.BP_Bin} onChange={handleEvidenceChange}>
                            <option value="Normal">Normal (&lt; 120 mmHg)</option>
                            <option value="Elevated">Elevated (120 - 139 mmHg)</option>
                            <option value="High_BP">High (≥ 140 mmHg)</option>
                        </FormSelect>

                        {/* 3. CHOLESTEROL: Based on bins [0, 200, 240, 600] */}
                        <FormSelect label="Cholesterol" name="Chol_Bin" value={evidence.Chol_Bin} onChange={handleEvidenceChange}>
                            <option value="Desirable">Desirable (&lt; 200 mg/dL)</option>
                            <option value="Borderline">Borderline (200 - 239 mg/dL)</option>
                            <option value="High_Chol">High (≥ 240 mg/dL)</option>
                        </FormSelect>

                        {/* 4. HEART RATE: Based on bins [0, 110, 150, 250] */}
                        <FormSelect label="Max Heart Rate" name="HR_Bin" value={evidence.HR_Bin} onChange={handleEvidenceChange}>
                            <option value="Low_Rate">Low (&lt; 110 bpm)</option>
                            <option value="Normal_Rate">Normal (110 - 150 bpm)</option>
                            <option value="High_Rate">High (&gt; 150 bpm)</option>
                        </FormSelect>

                        <FormSelect label="Chest Pain Type" name="CP_Label" value={evidence.CP_Label} onChange={handleEvidenceChange}>
                            <option value="Typical_Angina">Typical Angina</option>
                            <option value="Atypical_Angina">Atypical Angina</option>
                            <option value="Non_Anginal">Non-Anginal Pain</option>
                            <option value="Asymptomatic">Asymptomatic</option>
                        </FormSelect>

                        {/* 5. FASTING BLOOD SUGAR: Based on > 120 threshold */}
                        <FormSelect label="Fasting Blood Sugar" name="FBS_Label" value={evidence.FBS_Label} onChange={handleEvidenceChange}>
                            <option value="Normal_Sugar">Normal (&lt; 120 mg/dL)</option>
                            <option value="High_Sugar">High (&gt; 120 mg/dL)</option>
                        </FormSelect>

                        <FormSelect label="Blocked Vessels (Fluoroscopy)" name="CA_Label" value={evidence.CA_Label} onChange={handleEvidenceChange}>
                            <option value="0.0_Vessels">0 Vessels</option>
                            <option value="1.0_Vessels">1 Vessel</option>
                            <option value="2.0_Vessels">2 Vessels</option>
                            <option value="3.0_Vessels">3 Vessels</option>
                        </FormSelect>

                        <FormSelect label="Thalassemia" name="Thal_Label" value={evidence.Thal_Label} onChange={handleEvidenceChange}>
                            <option value="Normal">Normal</option>
                            <option value="Fixed_Defect">Fixed Defect (Permanent)</option>
                            <option value="Reversible_Defect">Reversible Defect (Blood Flow Issue)</option>
                        </FormSelect>

                        <h4 style={{marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px'}}>Interventions</h4>

                        <FormSelect label="Statin Therapy" name="statin" value={treatments.statin} onChange={handleTreatmentChange}>
                            <option value="None">None</option>
                            <option value="Moderate">Moderate Intensity (30% reduction)</option>
                            <option value="High">High Intensity (50% reduction)</option>
                        </FormSelect>

                        <FormSelect label="BP Medication" name="bp_med" value={treatments.bp_med} onChange={handleTreatmentChange}>
                            <option value="None">None</option>
                            <option value="Monotherapy">Monotherapy (Standard)</option>
                            <option value="Dual">Dual-Combination (Aggressive)</option>
                        </FormSelect>
                        <FormSelect label="History of PCI / Stents" name="pci" value={treatments.pci} onChange={handleTreatmentChange}>
                            <option value="None">No History</option>
                            <option value="Yes">Yes (Previous Procedure)</option>
                        </FormSelect>
                    </div>

                    <button
                        onClick={calculateRisk}
                        style={{
                            ...styles.calcBtn,
                            opacity: (loading || !isFormValid) ? 0.6 : 1,
                            cursor: (loading || !isFormValid) ? 'not-allowed' : 'pointer'
                        }}
                        disabled={loading || !isFormValid}
                    >
                        {loading ? "Analyzing..." : (isFormValid ? "Analyze Risk" : "Fill all patient data")}
                    </button>
                    {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                </div>



                {/* --- COLUMN 2: BAYESIAN RESULT --- */}
                <div style={styles.resultPanel}>
                    <h3 style={{color: '#2c3e50'}}>Bayesian Network</h3>
                    <p style={{fontSize: '0.8rem', color: '#7f8c8d'}}>Deterministic Math Model</p>

                    {bayesResult ? (
                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <h1 style={{ fontSize: '3.5rem', margin: '10px 0', color: bayesResult.disease_probability > 0.5 ? '#e74c3c' : '#2ecc71' }}>
                                {(bayesResult.disease_probability * 100).toFixed(1)}%
                            </h1>
                            <div style={{
                                padding: '8px 16px', borderRadius: '20px', display: 'inline-block',
                                backgroundColor: bayesResult.disease_probability > 0.5 ? '#e74c3c' : '#2ecc71',
                                color: 'white', fontWeight: 'bold'
                            }}>
                                {bayesResult.disease_probability > 0.5 ? "High Risk" : "Low Risk"}
                            </div>
                            <p style={{marginTop: '20px', fontSize: '0.9rem'}}>Calculated purely from dataset probabilities.</p>
                        </div>
                    ) : (
                        <div style={styles.placeholder}>Waiting for data...</div>
                    )}
                </div>

                {/* --- COLUMN 3: AI WRAPPER RESULT --- */}
                <div style={{...styles.resultPanel, borderLeft: '4px solid #8e44ad', display: 'flex', flexDirection: 'column'}}>
                    <h3 style={{color: '#8e44ad', marginTop: 0}}>Interactive AI Doctor</h3>
                    <p style={{fontSize: '0.8rem', color: '#7f8c8d'}}>Ask "What-If" treatment scenarios</p>

                    <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px', height: '250px' }}>
                        {chatHistory.length === 0 ? (
                            <div style={styles.placeholder}>Waiting for data...</div>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div key={i} style={{
                                    padding: '10px', borderRadius: '8px',
                                    backgroundColor: msg.role === 'user' ? '#8e44ad' : '#f0e6f5',
                                    color: msg.role === 'user' ? '#fff' : '#2c3e50',
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '90%'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                </div>
                            ))
                        )}
                        {aiLoading && <div style={{ alignSelf: 'flex-start', color: '#8e44ad', fontSize: '0.85rem', fontStyle: 'italic' }}>Calculating scenarios...</div>}
                    </div>

                    {/* Chat Input Field */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="e.g. 'What if I start a High Statin?'"
                            style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                            disabled={chatHistory.length === 0 || aiLoading}
                        />
                        <button
                            onClick={sendChatMessage}
                            style={{ padding: '10px 15px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '5px', cursor: (chatHistory.length === 0 || aiLoading) ? 'not-allowed' : 'pointer', opacity: (chatHistory.length === 0 || aiLoading) ? 0.6 : 1 }}
                            disabled={chatHistory.length === 0 || aiLoading}
                        >
                            Ask
                        </button>
                    </div>
                </div>



            </div>

            {/* --- NEW ROW: RISK FACTOR BREAKDOWN --- */}
            {bayesResult && bayesResult.factor_breakdown && bayesResult.factor_breakdown.length > 0 && (
                <div style={styles.breakdownPanel}>
                    <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>
                        Risk Factor Breakdown
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: '#7f8c8d', marginBottom: '15px' }}>
                        Here is exactly how your specific profile impacted the mathematical baseline:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                        {bayesResult.factor_breakdown.map((factor, index) => {
                            const isDanger = factor.category === 'Danger';
                            const isProtective = factor.category === 'Protective';

                            // Cap the visual bar width at 100%
                            const barWidth = Math.min(Math.abs(factor.impact_percentage), 100);

                            // Clean up the variable names
                            const cleanFeatureName = factor.feature.replace('_Label', '').replace('_Bin', '');
                            const barColor = isDanger ? '#e74c3c' : isProtective ? '#2ecc71' : '#95a5a6';

                            return (
                                <div key={index} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                        <span><strong>{cleanFeatureName}:</strong> {factor.value}</span>
                                        <span style={{ fontWeight: 'bold', color: barColor }}>
                                            {factor.impact_percentage > 0 ? '+' : ''}{factor.impact_percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                                        <div style={{ width: `${barWidth}%`, backgroundColor: barColor, height: '100%', borderRadius: '10px', transition: 'width 0.5s' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {/* --- END RISK FACTOR BREAKDOWN --- */}




            <VerificationPanel evidence={evidence} isAnalyzed={true} />

        </div>
    );
};

// ... Helper Components ...
const FormSelect = ({ label, name, value, onChange, children }) => (
    <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>{label}</label>
        <select name={name} value={value || ""} onChange={onChange} style={{ width: '100%', padding: '6px', borderRadius: '4px' }}>
            <option value="">-- Select --</option>
            {children}
        </select>
    </div>
);

const styles = {
    container: { display: 'flex',flexDirection: 'column', gap: '30px', marginTop: '30px', height: '600px', fontFamily: 'Arial, sans-serif' },
    topRow: {display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'stretch'},
    inputPanel: { flex: '1', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' },
    scrollableForm: { flex: '1', overflowY: 'auto', paddingRight: '10px' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    resultPanel: { flex: '1', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    calcBtn: { width: '100%', padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' },
    resetBtn: { background: 'none', border: '1px solid #ccc', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' },
    placeholder: { marginTop: '100px', color: '#ccc', fontStyle: 'italic' },
    breakdownPanel: { backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' }
};

export default RiskCalculator;