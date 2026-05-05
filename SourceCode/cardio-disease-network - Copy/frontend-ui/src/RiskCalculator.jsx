import React, { useState } from 'react';
import axios from 'axios';
import VerificationPanel from './VerificationPanel';
import BayesianNetwork from './BayesianNetwork';
import ReactFlowPlaceholder from './graph_static.png';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";


const RiskCalculator = () => {
    const [patientName, setPatientName] = useState("");
    const [evidence, setEvidence] = useState({});
    const [treatments, setTreatments] = useState({ statin: 'None', bp_med: 'None', pci: 'None' });

    // Results
    const [bayesResult, setBayesResult] = useState(null);
    const [aiResult, setAiResult] = useState(null); // <-- ADD THIS LINE BACK!
    const [generalAiResult, setGeneralAiResult] = useState(null);
    const [generalAiPercentage, setGeneralAiPercentage] = useState(null);
    const [globalStats, setGlobalStats] = useState({ total_records: 0, avg_bn: 0, avg_ai: 0 });


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


    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const calculateRisk = async () => {
        setLoading(true);
        setError(null);
        setGeneralAiResult(null);
        setGeneralAiPercentage(null);
        setAiResult(null);

        // Include patient_name in the payload
        const payload = {
            patient_name: patientName,
            evidence,
            treatments
        };

        try {
            // STEP 1: Get the Mathematical Bayesian Network Result
            const bnRes = await axios.post(`${process.env.REACT_APP_API_URL}/predict`, payload);
            setBayesResult(bnRes.data);


            const currentBnScore = bnRes.data.disease_probability * 100;

            const alignedRes = await axios.post(`${process.env.REACT_APP_API_URL}/ask-ai`, payload);
            setAiResult(alignedRes.data.ai_response);

            const generalRes = await axios.post(`${process.env.REACT_APP_API_URL}/ask-ai-general`, payload);
            setGeneralAiResult(generalRes.data.ai_response);
            setGeneralAiPercentage(generalRes.data.ai_percentage);

            // Extract the AI score directly from the response
            const currentAiScore = generalRes.data.ai_percentage;

            // STEP 3: Save the record to the SQLite database
            if (patientName.trim() !== "") {
                await axios.post(`${process.env.REACT_APP_API_URL}/save-record`, {
                    patient_name: patientName,
                    bn_score: currentBnScore,
                    ai_score: currentAiScore
                });
            }

            // STEP 4: Fetch the updated Global Database Averages to update the Correlation Graph
            const statsRes = await axios.get(`${process.env.REACT_APP_API_URL}/global-stats`);
            setGlobalStats(statsRes.data);

        } catch (err) {
            console.error("Analysis Error:", err);
            setError("Failed to calculate risk. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setPatientName("");
        setEvidence({});
        setTreatments({ statin: 'None', bp_med: 'None', pci: 'None' });

        // Clear everything
        setBayesResult(null);
        setAiResult(null);        // <-- Added this here too
        setChatHistory([]);
        setGeneralAiResult(null);
    };

    // --- NEW PDF EXPORT FUNCTION ---
    const [isExporting, setIsExporting] = useState(false);

    const exportToPDF = async () => {
        setIsExporting(true);
        try {
            // Create a new A4 PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth() - 20; // 10mm margin on left and right

            // A helper function to take a picture of a specific ID and drop it on the PDF
            const addPanelToPdf = async (elementId, yPosition) => {
                const element = document.getElementById(elementId);
                if (!element) return yPosition;

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', 10, yPosition, pdfWidth, pdfHeight);
                return yPosition + pdfHeight + 10; // Returns the starting Y position for the NEXT image
            };

            // --- PAGE 1: Interactive Engine & Breakdown ---
            pdf.setFontSize(16);
            pdf.text("Patient Risk Report - Visual Analysis", 10, 15);
            let nextY = await addPanelToPdf('pdf-interactive-graph', 25);
            await addPanelToPdf('pdf-risk-breakdown', nextY);

            // --- PAGE 2: Patient Data, AI Results & Static Baseline ---
            pdf.addPage();
            pdf.setFontSize(16);
            pdf.text("Patient Risk Report - Clinical Details", 10, 15);
            nextY = await addPanelToPdf('pdf-top-row', 25);
            await addPanelToPdf('pdf-static-graph', nextY);

            pdf.save(`Patient_Risk_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("PDF Export failed:", err);
            alert("Failed to export PDF. Please try again.");
        }
        setIsExporting(false);
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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
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

    // --- FAQ STATE & DATA ---
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const toggleFaq = (index) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    const faqData = [
        {
            question: "What AI models are powering this dashboard?",
            answer: "Our Interactive Chat and AI Opinion engines are powered by Google's state-of-the-art Gemini 2.5 Flash model. It is specifically optimized for high-speed, logical reasoning and complex medical context alignment. The underlying mathematical percentages are generated by a deterministic, non-LLM Naive Bayes statistical algorithm."
        },
        {
            question: "Does having blocked blood vessels mean someone 100% has cardiovascular disease?",
            answer: "In medicine, yes—if an artery is narrowed by 50% or more, doctors officially call that coronary artery disease.\n" +
                "\n" +
                "However, our tool works a little differently. Instead of a strict \"yes\" or \"no,\" it looks at past medical records to see how often these blockages actually resulted in a doctor's diagnosis. Because it calculates probabilities based on real-world data, it shows the likelihood of having the disease rather than a 100% guarantee."
        },
        {
            question: "Why does the model sometimes show a low risk even with 2 or 3 blocked vessels?",
            answer: "This happens because of a quirk in the historical medical records our tool learned from. In those old records, a \"blocked vessel\" just meant a scan showed some calcium buildup.\n" +
                "\n" +
                "Sometimes, patients had this buildup in multiple vessels but weren't actually in danger. Their bodies might have adapted by growing new \"detour\" blood vessels, or the buildup wasn't actually stopping blood flow. Because they were fine, doctors at the time recorded their diagnosis as \"negative\" for heart disease. Our math formula strictly follows that old data, which can lead to confusing results. That’s exactly why we included the \"General AI Opinion\" feature—to catch these weird historical quirks and give you a better explanation!"
        }
    ];

    return (
        <div style={styles.container}>

            {/* --- THE PDF WRAPPER --- */}
            <div id="report-container" style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '12px' }}>

                {/* --- REARRANGED: INPUTS & RESULTS NOW AT THE TOP --- */}
                <div id="pdf-top-row" style={{ ...styles.topRow, marginBottom: '40px' }}>

                    {/* --- COLUMN 1: INPUT FORM --- */}
                    <div style={styles.inputPanel}>
                        <div style={styles.header}>
                            <h2>Patient Data</h2>

                            <div>
                                <button onClick={handleReset} style={styles.resetBtn}>Reset</button>
                                {bayesResult && (
                                    <button
                                        onClick={exportToPDF}
                                        style={{
                                            ...styles.resetBtn, backgroundColor: '#27ae60', color: 'white', marginLeft: '10px', border: 'none', opacity: isExporting ? 0.6 : 1
                                        }}
                                        disabled={isExporting}
                                    >
                                        {isExporting ? "Generating..." : "📄 Export PDF"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={styles.scrollableForm}>
                            {/* --- NEW: PATIENT NAME INPUT --- */}
                            <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '2px dashed #eee' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '5px' }}>Patient Name (For Database Record)</label>
                                <input
                                    type="text"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                    placeholder="e.g., John Doe"
                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                                />
                            </div>

                            {/* ... ALL EXISTING DROPDOWNS GO HERE (Age, Sex, BP, etc.) ... */}
                            <FormSelect label="Age Group" name="Age_Bin" value={evidence.Age_Bin} onChange={handleEvidenceChange}>
                                <option value="Young">Young (&lt; 45 years)</option>
                                <option value="Middle">Middle (45 - 60 years)</option>
                                <option value="Old">Old (&gt; 60 years)</option>
                            </FormSelect>
                            <FormSelect label="Sex" name="Sex_Label" value={evidence.Sex_Label} onChange={handleEvidenceChange}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </FormSelect>
                            <FormSelect label="Blood Pressure (Resting)" name="BP_Bin" value={evidence.BP_Bin} onChange={handleEvidenceChange}>
                                <option value="Normal">Normal (&lt; 120 mmHg)</option>
                                <option value="Elevated">Elevated (120 - 139 mmHg)</option>
                                <option value="High_BP">High (≥ 140 mmHg)</option>
                            </FormSelect>
                            <FormSelect label="Cholesterol" name="Chol_Bin" value={evidence.Chol_Bin} onChange={handleEvidenceChange}>
                                <option value="Desirable">Desirable (&lt; 200 mg/dL)</option>
                                <option value="Borderline">Borderline (200 - 239 mg/dL)</option>
                                <option value="High_Chol">High (≥ 240 mg/dL)</option>
                            </FormSelect>
                            <FormSelect label="Max Heart Rate (During Stress Test)" name="HR_Bin" value={evidence.HR_Bin} onChange={handleEvidenceChange}>
                                <option value="Low_Rate">Low Peak (&lt; 110 bpm)</option>
                                <option value="Normal_Rate">Sub-optimal Peak (110 - 150 bpm)</option>
                                <option value="High_Rate">Healthy Peak (&gt; 150 bpm)</option>
                            </FormSelect>
                            <FormSelect label="Chest Pain Type" name="CP_Label" value={evidence.CP_Label} onChange={handleEvidenceChange}>
                                <option value="Typical_Angina">Typical Angina</option>
                                <option value="Atypical_Angina">Atypical Angina</option>
                                <option value="Non_Anginal">Non-Anginal Pain</option>
                                <option value="Asymptomatic">Asymptomatic (Silent Ischemia Risk)</option>
                            </FormSelect>
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
                                opacity: (loading || !isFormValid || !patientName.trim()) ? 0.6 : 1, // Require name to click
                                cursor: (loading || !isFormValid || !patientName.trim()) ? 'not-allowed' : 'pointer'
                            }}
                            disabled={loading || !isFormValid || !patientName.trim()}
                        >
                            {loading ? "Analyzing..." : (!patientName.trim() ? "Enter Patient Name" : (isFormValid ? "Analyze & Save Record" : "Fill all patient data"))}
                        </button>
                        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                    </div>


                    {/* --- COLUMN 2: BAYESIAN NETWORK + ALIGNED AI --- */}
                    <div style={{ ...styles.resultPanel, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* ... (Your existing Math and Aligned AI HTML here) ... */}
                        <div style={{ borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
                            <h3 style={{color: '#2c3e50', margin: 0}}>Bayesian Network</h3>
                            <p style={{fontSize: '0.8rem', color: '#7f8c8d'}}>Deterministic Math Model</p>
                            {bayesResult ? (
                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                    <h1 style={{ fontSize: '3.5rem', margin: '10px 0', color: bayesResult.disease_probability > 0.5 ? '#e74c3c' : '#2ecc71' }}>
                                        {(bayesResult.disease_probability * 100).toFixed(1)}%
                                    </h1>
                                    <div style={{ padding: '8px 16px', borderRadius: '20px', display: 'inline-block', backgroundColor: bayesResult.disease_probability > 0.5 ? '#e74c3c' : '#2ecc71', color: 'white', fontWeight: 'bold' }}>
                                        {bayesResult.disease_probability > 0.5 ? "High Risk" : "Low Risk"}
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.placeholder}>Waiting for data...</div>
                            )}
                        </div>

                        {/*Aligned with AI*/}
                        <div>
                            <h3 style={{color: '#8e44ad', margin: 0}}>Aligned AI Explainer</h3>
                            <p style={{fontSize: '0.8rem', color: '#7f8c8d'}}>Grounded strictly in the BN Math</p>
                            {aiResult ? (
                                <div style={{ marginTop: '10px', textAlign: 'left' }}><p style={{whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.95rem', color: '#333'}}>{aiResult}</p></div>
                            ) : (
                                <div style={{...styles.placeholder, marginTop: '20px'}}>Waiting for data...</div>
                            )}
                        </div>
                    </div>

                    {/* --- COLUMN 3: GENERAL AI OPINION --- */}
                    <div style={{...styles.resultPanel, borderLeft: '4px solid #2980b9'}}>
                        {/* ... (Your existing General AI Opinion HTML here) ... */}
                        <h3 style={{color: '#2980b9', margin: 0}}>General AI Opinion</h3>
                        <p style={{fontSize: '0.8rem', color: '#7f8c8d'}}>Independent Clinical Judgment (No BN Access)</p>
                        {generalAiResult ? (
                            <div style={{ marginTop: '20px', textAlign: 'left' }}>
                                <p style={{whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.95rem', color: '#333'}}>{generalAiResult}</p>
                                <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#eaf2f8', borderRadius: '5px', fontSize: '0.8rem', color: '#2980b9'}}>
                                    <strong>Note:</strong> This assessment is generated purely from standard LLM training data and may differ from the statistical dataset model.
                                </div>
                            </div>
                        ) : ( <div style={styles.placeholder}>Waiting for data...</div> )}
                    </div>
                </div>
                {/* --- END TOP ROW --- */}

                {/* --- CORRELATION GRAPH --- */}
                {bayesResult && generalAiPercentage !== null && (
                    <div style={{ ...styles.resultPanel, marginBottom: '40px', backgroundColor: '#fdfefe', border: '1px solid #d5dbdb' }}>
                        <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ color: '#2c3e50', margin: '0', fontSize: '1.2rem' }}>Model Consensus & Correlation</h3>
                            <span style={{ fontSize: '0.85rem', color: '#95a5a6' }}>Comparing the deterministic math against the LLM's clinical literature review.</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'row', gap: '40px' }}>

                            {/* COLUMN 1: Current Patient */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <h4 style={{ margin: 0, color: '#7f8c8d', fontSize: '0.9rem', textTransform: 'uppercase' }}>Current Patient: {patientName}</h4>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        <span style={{ color: '#2ecc71' }}>Bayesian Network (Math)</span>
                                        <span>{(bayesResult.disease_probability * 100).toFixed(1)}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '12px' }}>
                                        <div style={{ width: `${bayesResult.disease_probability * 100}%`, backgroundColor: '#2ecc71', height: '100%', borderRadius: '10px', transition: 'width 1s ease-out' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        <span style={{ color: '#2980b9' }}>General AI (Clinical Review)</span>
                                        <span>{generalAiPercentage}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '12px' }}>
                                        <div style={{ width: `${generalAiPercentage}%`, backgroundColor: '#2980b9', height: '100%', borderRadius: '10px', transition: 'width 1s ease-out' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMN 2: Global Database Average */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', borderLeft: '1px solid #eee', paddingLeft: '40px' }}>
                                <h4 style={{ margin: 0, color: '#7f8c8d', fontSize: '0.9rem', textTransform: 'uppercase' }}>Global Database Average (n={globalStats.total_records})</h4>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        <span style={{ color: '#27ae60', opacity: 0.7 }}>Avg. BN Math</span>
                                        <span style={{ opacity: 0.7 }}>{globalStats.avg_bn}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '12px' }}>
                                        <div style={{ width: `${globalStats.avg_bn}%`, backgroundColor: '#27ae60', opacity: 0.4, height: '100%', borderRadius: '10px', transition: 'width 1s ease-out' }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                        <span style={{ color: '#2980b9', opacity: 0.7 }}>Avg. General AI</span>
                                        <span style={{ opacity: 0.7 }}>{globalStats.avg_ai}%</span>
                                    </div>
                                    <div style={{ width: '100%', backgroundColor: '#ecf0f1', borderRadius: '10px', height: '12px' }}>
                                        <div style={{ width: `${globalStats.avg_ai}%`, backgroundColor: '#2980b9', opacity: 0.4, height: '100%', borderRadius: '10px', transition: 'width 1s ease-out' }}></div>
                                    </div>
                                </div>
                            </div>


                        </div>
                        {/* --- NEW: SCATTER PLOT CORRELATION GRAPH --- */}
                        {globalStats.data_points && globalStats.data_points.length > 0 && (
                            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px dashed #d5dbdb' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50', textAlign: 'center' }}>Global Patient Distribution (Math vs. AI)</h4>
                                <p style={{ fontSize: '0.8rem', color: '#7f8c8d', textAlign: 'center', marginBottom: '20px' }}>
                                    Dots below the diagonal line indicate the AI was more conservative than the raw math. Hover over a dot to see the patient.
                                </p>

                                <div style={{ width: '100%', height: '350px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.5} />

                                            {/* X Axis: The Math */}
                                            <XAxis
                                                type="number"
                                                dataKey="bn"
                                                name="Bayesian Network"
                                                unit="%"
                                                domain={[0, 100]}
                                                label={{ value: "Bayesian Network Math Score (%)", position: "insideBottom", offset: -10 }}
                                            />

                                            {/* Y Axis: The AI */}
                                            <YAxis
                                                type="number"
                                                dataKey="ai"
                                                name="General AI"
                                                unit="%"
                                                domain={[0, 100]}
                                                label={{ value: "General AI Score (%)", angle: -90, position: "insideLeft" }}
                                            />

                                            {/* The Tooltip (Shows patient name on hover!) */}
                                            <Tooltip
                                                cursor={{ strokeDasharray: '3 3' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
                                                                <p style={{ margin: 0, fontWeight: 'bold' }}>{data.name}</p>
                                                                <p style={{ margin: 0, color: '#2ecc71' }}>Math: {data.bn}%</p>
                                                                <p style={{ margin: 0, color: '#2980b9' }}>AI: {data.ai}%</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />

                                            {/* The Line of Perfect Agreement */}
                                            <ReferenceLine
                                                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                                                stroke="#e74c3c"
                                                strokeDasharray="3 3"
                                                opacity={0.8}
                                            />

                                            {/* The Data Points */}
                                            <Scatter name="Patients" data={globalStats.data_points} fill="#3498db" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                        {/* --- END SCATTER PLOT --- */}
                    </div>
                )}
                {/* --- END CORRELATION GRAPH --- */}

                {/* --- REARRANGED: GRAPHS ARE NOW STACKED VERTICALLY --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', marginBottom: '40px' }}> {/* <-- Changed to column! */}

                    {/* TOP GRAPH: Dynamic React Flow Graph */}
                    <div id="pdf-interactive-graph" style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ color: '#3498db', margin: '0', fontSize: '1.2rem' }}>Interactive Engine</h3>
                            <span style={{ fontSize: '0.85rem', color: '#95a5a6' }}>Real-time probability updates</span>
                            <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '10px', lineHeight: '1.5', backgroundColor: '#eaf2f8', padding: '10px', borderRadius: '6px' }}>
                                <strong>How to use:</strong> When you select options in the "Patient Data" form above, this engine updates instantly. Watch the colored bars shift as the model calculates your specific patient's unique risk profile in real-time.
                            </p>
                        </div>
                        <div style={{ width: '100%', minHeight: '600px', position: 'relative' }}>
                            <BayesianNetwork evidence={evidence} finalRisk={bayesResult ? bayesResult.disease_probability : null} />
                        </div>
                    </div>

                    {/* BOTTOM GRAPH: Static Reference Image */}
                    <div id="pdf-static-graph" style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '15px' }}>
                            <h3 style={{ color: '#2c3e50', margin: '0', fontSize: '1.2rem' }}>Static Dataset Baseline</h3>
                            <span style={{ fontSize: '0.85rem', color: '#95a5a6' }}>Original DAG Layout (Dagre)</span>
                            <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '10px', lineHeight: '1.5', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '6px' }}>
                                <strong>What is this?</strong> This diagram shows the "blueprint" of our AI. It reveals how factors like age, cholesterol, and chest pain mathematically connect to heart disease based on averages from hundreds of past patients.
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', overflow: 'hidden', padding: '20px' }}>
                            <img src={ReactFlowPlaceholder} alt="Static Bayesian Network" style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }} />
                        </div>
                    </div>

                </div>
                {/* --- END STACKED SHOWCASE --- */}


                {/* --- RISK FACTOR BREAKDOWN --- */}
                {bayesResult && bayesResult.factor_breakdown && bayesResult.factor_breakdown.length > 0 && (
                    <div id="pdf-risk-breakdown" style={styles.breakdownPanel}>
                        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>
                            Risk Factor Breakdown
                        </h3>

                        {/* --- EXPLANATION FOR THE CLIENT --- */}
                        <div style={{ fontSize: '0.9rem', color: '#34495e', marginBottom: '20px', backgroundColor: '#f4f6f7', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #2c3e50' }}>
                            <strong>How the math works:</strong> This model uses Naive Bayes Log-Odds. It starts at an average baseline risk, and evaluates each of your patient's symptoms independently. Green bars indicate protective factors that pull your risk down mathematically, while red bars indicate dangerous factors that push your risk up based on the historical dataset frequencies.
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {/* --- THE RESTORED MAPPING CODE --- */}
                            {bayesResult.factor_breakdown.map((factor, index) => {
                                const isDanger = factor.category === 'Danger';
                                const isProtective = factor.category === 'Protective';

                                // Cap the visual bar width at 100%
                                const barWidth = Math.min(Math.abs(factor.impact_percentage), 100);

                                // Clean up the variable names
                                const cleanFeatureName = factor.feature.replace('_Label', '').replace('_Bin', '');
                                const barColor = isDanger ? '#e74c3c' : isProtective ? '#2ecc71' : '#95a5a6';

                                let displayValue = factor.value;
                                if (factor.feature === 'HR_Bin') {
                                    if (factor.value === 'Normal_Rate') displayValue = 'Sub-optimal Peak';
                                    if (factor.value === 'High_Rate') displayValue = 'Healthy Peak';
                                    if (factor.value === 'Low_Rate') displayValue = 'Low Peak';
                                }
                                if (factor.feature === 'CP_Label' && factor.value === 'Asymptomatic') {
                                    displayValue = 'Asymptomatic (Silent Risk)';
                                }

                                return (
                                    <div key={index} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                            <span><strong>{cleanFeatureName}:</strong> {
                                                factor.value === 'Normal_Rate' ? 'Sub-optimal Peak' :
                                                    factor.value === 'High_Rate' ? 'Healthy Peak' :
                                                        factor.value === 'Asymptomatic' ? 'Asymptomatic (Silent Risk)' :
                                                            factor.value
                                            }
                                            </span>
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

            </div>
            {/* --- END OF REPORT WRAPPER --- */}

            {/* --- INTERACTIVE AI CHAT --- */}
            {bayesResult && (
                <div style={styles.chatContainer}>
                    <div style={styles.chatHeader}>
                        <h3 style={{ margin: 0, color: '#fff' }}>Consult AI Doctor</h3>
                        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Ask "what-if" questions about treatments</span>
                    </div>

                    <div style={styles.chatHistoryBox}>
                        {chatHistory.length === 0 ? (
                            <div style={styles.chatPlaceholder}>
                                Ask how starting a High-Intensity Statin or BP Medication would change this patient's exact risk score.
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div key={idx} style={msg.role === 'user' ? styles.userMsg : styles.modelMsg}>
                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', opacity: 0.7 }}>
                                        {msg.role === 'user' ? 'You' : 'AI Cardiologist'}
                                    </strong>
                                    {msg.content}
                                </div>
                            ))
                        )}
                        {aiLoading && (
                            <div style={styles.modelMsg}>
                                <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Analyzing medical data...</span>
                            </div>
                        )}
                    </div>

                    <div style={styles.chatInputRow}>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your clinical question here..."
                            style={styles.chatInput}
                            disabled={aiLoading}
                        />
                        <button
                            onClick={sendChatMessage}
                            style={{...styles.sendBtn, opacity: aiLoading || !chatInput.trim() ? 0.5 : 1}}
                            disabled={aiLoading || !chatInput.trim()}
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}

            {/* --- NEW: VERIFICATION EXPLANATION --- */}
            <div style={{ marginTop: '40px', padding: '15px', backgroundColor: '#e8f8f5', borderRadius: '8px', border: '1px solid #d1f2eb', color: '#117a65' }}>
                <strong>Clinical Verification Panel:</strong> The panel below stress-tests our mathematical model against known clinical scenarios. It injects "textbook" patient profiles into the algorithm to verify that the model correctly flags highly dangerous patients and clears healthy patients, proving its baseline accuracy.
            </div>
            <VerificationPanel evidence={evidence} isAnalyzed={true} />

            {/* --- NEW ROW: FREQUENTLY ASKED QUESTIONS (ACCORDION) --- */}
            <div style={{ ...styles.resultPanel, marginTop: '40px', backgroundColor: '#f8f9fa', border: '1px solid #e2e8f0' }}>
                <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px', textAlign: 'center' }}>
                    <h2 style={{ color: '#2c3e50', margin: '0', fontSize: '1.5rem' }}>Frequently Asked Questions</h2>
                    <span style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>Understanding the models, the data, and the math.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {faqData.map((faq, index) => (
                        <div key={index} style={{ border: '1px solid #dcdde1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                            <button
                                onClick={() => toggleFaq(index)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '15px 20px',
                                    backgroundColor: openFaqIndex === index ? '#f1f5f9' : '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontSize: '1.05rem',
                                    color: '#2980b9',
                                    fontWeight: 'bold',
                                    transition: 'background-color 0.2s ease'
                                }}
                            >
                                {faq.question}

                                {/* The dropdown arrow that flips when clicked */}
                                <span style={{
                                    fontSize: '1.2rem',
                                    color: '#7f8c8d',
                                    transform: openFaqIndex === index ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s ease'
                                }}>
                                ▼
                            </span>
                            </button>

                            {/* The answer box that expands */}
                            {openFaqIndex === index && (
                                <div style={{ padding: '15px 20px', borderTop: '1px solid #f1f2f6', color: '#34495e', fontSize: '0.95rem', lineHeight: '1.6', backgroundColor: '#fff' }}>
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {/* --- END FAQ --- */}

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
    container: { display: 'flex',flexDirection: 'column', gap: '30px', marginTop: '30px', minHeight: '600px', fontFamily: 'Arial, sans-serif' },
    topRow: {display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'stretch'},
    inputPanel: { flex: '1', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' },
    scrollableForm: { flex: '1', overflowY: 'auto', paddingRight: '10px' },
    header: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
    resultPanel: { flex: '1', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '10px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    calcBtn: { width: '100%', padding: '12px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px' },
    resetBtn: {
            backgroundColor: '#e74c3c', // Give it a red warning color
            color: 'white',
            border: 'none',
            padding: '8px 16px', // Double the padding so it's clickable
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
        },
    placeholder: { marginTop: '100px', color: '#ccc', fontStyle: 'italic' },
    breakdownPanel: { backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginTop: '20px' },
    chatContainer: {
        backgroundColor: '#fff',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        marginTop: '20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e2e8f0'
    },
    chatHeader: {
        backgroundColor: '#8e44ad', // Purple to match the "Aligned AI" theme
        padding: '15px 20px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    chatHistoryBox: {
        padding: '20px',
        height: '250px',
        overflowY: 'auto',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    chatPlaceholder: {
        color: '#95a5a6',
        textAlign: 'center',
        marginTop: 'auto',
        marginBottom: 'auto',
        fontStyle: 'italic',
        fontSize: '0.95rem'
    },
    userMsg: {
        alignSelf: 'flex-end',
        backgroundColor: '#3498db',
        color: 'white',
        padding: '10px 15px',
        borderRadius: '15px 15px 0 15px',
        maxWidth: '75%',
        fontSize: '0.95rem',
        lineHeight: '1.4'
    },
    modelMsg: {
        alignSelf: 'flex-start',
        backgroundColor: '#eaf2f8',
        color: '#2c3e50',
        border: '1px solid #d6eaf8',
        padding: '10px 15px',
        borderRadius: '15px 15px 15px 0',
        maxWidth: '75%',
        fontSize: '0.95rem',
        lineHeight: '1.4'
    },
    chatInputRow: {
        display: 'flex',
        padding: '15px',
        borderTop: '1px solid #eee',
        backgroundColor: '#fff'
    },
    chatInput: {
        flex: '1',
        padding: '12px 15px',
        border: '1px solid #ccc',
        borderRadius: '25px',
        fontSize: '1rem',
        outline: 'none'
    },
    sendBtn: {
        backgroundColor: '#8e44ad',
        color: 'white',
        border: 'none',
        borderRadius: '25px',
        padding: '0 20px',
        marginLeft: '10px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background-color 0.2s'
    }
};

export default RiskCalculator;