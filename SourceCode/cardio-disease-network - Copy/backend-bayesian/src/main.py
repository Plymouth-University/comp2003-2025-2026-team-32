import os
from google import genai  # <--- NEW LIBRARY IMPORT
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
from dotenv import load_dotenv
from src.model_logic import CardioBayesianModel
import json
import sqlite3
import psycopg2

DB_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    return psycopg2.connect(DB_URL)

def init_db():
    if not DB_URL:
        print("Warning: No DATABASE_URL found.")
        return

    # --- ALL OF THIS MUST BE INDENTED INSIDE THE FUNCTION ---
    conn = get_db_connection()
    cursor = conn.cursor()
    # Note: Postgres uses SERIAL instead of AUTOINCREMENT
    cursor.execute('''
                   CREATE TABLE IF NOT EXISTS records (
                                                          id SERIAL PRIMARY KEY,
                                                          patient_name TEXT,
                                                          bn_score REAL,
                                                          ai_score INTEGER,
                                                          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                   )
                   ''')
    conn.commit()
    conn.close()
    # --------------------------------------------------------

# Run this once when the server boots
init_db()
# 1. Load API Key
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# 2. Configure the New Google Client
# The new library uses a client instance rather than global configuration
client = genai.Client(api_key=API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bayesian_service = CardioBayesianModel()


# 1. New Data Models for Chat
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    evidence: Dict[str, str]
    treatments: Optional[Dict[str, str]] = None
    message: str
    history: List[ChatMessage] = []

# 2. The Interactive Chat Endpoint
from google.genai import types




# ----------------------

# We also need a new Pydantic model for saving data
class SaveRecordRequest(BaseModel):
    patient_name: str
    bn_score: float
    ai_score: int

@app.on_event("startup")
def startup_event():
    try:
        bayesian_service.load_and_train()
    except Exception as e:
        print(f"Failed to start model: {e}")

class PredictionRequest(BaseModel):
    patient_name: Optional[str] = None
    evidence: Dict[str, str]
    treatments: Optional[Dict[str, str]] = None

@app.get("/")
def read_root():
    return {"status": "Bayesian Backend is running"}

@app.get("/network-structure")
def get_graph():
    return bayesian_service.get_structure()

@app.get("/advanced-network")
def get_advanced_network_visual():
    """Returns structure and probabilities for the advanced graph visualization."""
    if not bayesian_service.model:
        raise HTTPException(status_code=503, detail="Model not trained")
    return bayesian_service.get_full_network_data()

@app.post("/verify")
def verify_model_dynamic(request: PredictionRequest): # Changed parameter to match PredictionRequest
    """Returns dynamic statistical and clinical verification metrics based on user input."""
    if not bayesian_service.infer:
        raise HTTPException(status_code=503, detail="Model not trained")

    try:
        # Get base verification stats
        results = bayesian_service.verify_model_performance(request.evidence)

        # Apply treatments to the clinical scenario check so the UI matches
        if request.treatments and 'clinical_scenario' in results:
            final_clin_prob = results['clinical_scenario']
            t = request.treatments
            if t.get('statin') == 'High': final_clin_prob *= 0.57
            elif t.get('statin') == 'Moderate': final_clin_prob *= 0.70
            if t.get('bp_med') == 'Dual': final_clin_prob *= 0.43
            elif t.get('bp_med') == 'Monotherapy': final_clin_prob *= 0.65
            if t.get('pci') == 'Yes': final_clin_prob *= 0.80

            results['clinical_scenario'] = final_clin_prob

        return results
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
def predict_heart_disease(request: PredictionRequest):
    if not bayesian_service.infer:
        raise HTTPException(status_code=503, detail="Model not trained")

    base_probability = bayesian_service.predict_risk(request.evidence)
    final_probability = float(base_probability)

    # Apply Treatment Reductions
    if request.treatments:
        t = request.treatments
        if t.get('statin') == 'High': final_probability *= 0.57
        elif t.get('statin') == 'Moderate': final_probability *= 0.70
        if t.get('bp_med') == 'Dual': final_probability *= 0.43
        elif t.get('bp_med') == 'Monotherapy': final_probability *= 0.65
        if t.get('pci') == 'Yes': final_probability *= 0.80

    feature_breakdown = bayesian_service.calculate_feature_impacts(request.evidence)

    if request.patient_name:
        print(f"Saving patient {request.patient_name} to database...")
        # Example: db.execute("INSERT INTO patients (name, risk_score, data) VALUES (?, ?, ?)",
        # (request.patient_name, final_probability, str(request.evidence)))

    return {
        "base_probability": float(base_probability),
        "disease_probability": round(final_probability, 4),
        "risk_level": "High" if final_probability > 0.5 else "Low",
        "factor_breakdown": feature_breakdown
    }

# --- NEW GENAI ENDPOINT ---
@app.post("/ask-ai")
def ask_ai_doctor(request: PredictionRequest):
    try:
        # 1. Calculate the base risk AND the feature breakdown
        base_probability = bayesian_service.predict_risk(request.evidence)
        final_probability = float(base_probability)

        # NEW: Fetch the mathematical breakdown so the AI can see the "why"
        feature_breakdown = bayesian_service.calculate_feature_impacts(request.evidence)

        # 2. Apply Treatment Reductions before feeding to AI
        if request.treatments:
            t = request.treatments
            if t.get('statin') == 'High': final_probability *= 0.57
            elif t.get('statin') == 'Moderate': final_probability *= 0.70
            if t.get('bp_med') == 'Dual': final_probability *= 0.43
            elif t.get('bp_med') == 'Monotherapy': final_probability *= 0.65
            if t.get('pci') == 'Yes': final_probability *= 0.80

        # 3. Use the POST-TREATMENT probability for the prompt
        bn_percentage = final_probability * 100
        risk_category = "High" if final_probability > 0.5 else "Low"

        # 4. Construct the strict Prompt Grounding
        prompt = (
            "You are an AI medical assistant explaining a cardiovascular risk assessment. "
            "You MUST align your explanation with the provided mathematical model's result.\n\n"
            "Patient Profile:\n"
        )

        for key, value in request.evidence.items():
            prompt += f"- {key}: {value}\n"

        if request.treatments:
            prompt += "Treatments:\n"
            for key, value in request.treatments.items():
                prompt += f"- {key}: {value}\n"

        # 5. Feed the Naive Bayes mathematical breakdown directly to the AI
        prompt += "\nMathematical Risk Factor Breakdown (Naive Bayes Weights):\n"
        if feature_breakdown:
            for factor in feature_breakdown:
                sign = "+" if factor['impact_percentage'] > 0 else ""
                prompt += f"- {factor['feature']} ({factor['value']}): {sign}{factor['impact_percentage']:.1f}% impact\n"
        else:
            prompt += "- No specific feature breakdown available.\n"

        # --- NEW: HARDCODED DATASET CONTEXT ---
        prompt += "\nDATASET CONTEXT:\n"
        prompt += "For context, the Naive Bayes model was trained on the UCI Heart Disease dataset. "
        prompt += "It contains exactly 303 patient records. The dataset heavily skews toward older patients, "
        prompt += "and the presence of 'asymptomatic' chest pain in this specific dataset historically correlated heavily with confirmed disease via angiography. "
        prompt += "Use this context to explain any mathematical quirks. CRITICAL: The raw dataset label 'Normal_Rate' for heart rate actually means a 'Sub-optimal Peak' during a stress test. You MUST refer to it as a 'Sub-optimal Peak', not a normal heart rate, to avoid confusing the patient.\n"
        # --------------------------------------

        # 6. RULES: Force the AI to explain the Naive Bayes logic
        prompt += f"\nCRITICAL INSTRUCTION:\n"
        prompt += f"Our Naive Bayes model calculated this patient's final risk to be exactly {bn_percentage:.1f}% ({risk_category} Risk).\n"
        prompt += "RULES:\n"
        prompt += "1. EXPLAIN THE MATH: Use the 'Mathematical Risk Factor Breakdown' provided above to explicitly explain *why* the model reached this conclusion. Name the top 1 or 2 specific features that drove the score up or down.\n"
        prompt += "2. NAIVE BAYES CONTEXT: Briefly explain that this model uses Naive Bayes logic (weighing each factor independently based on a small 300-row dataset), which is why its mathematical output might differ from standard general clinical intuition. Use the 'DATASET CONTEXT' to explain why things like 'Asymptomatic' or 'Normal' heart rates might mathematically raise the risk.\n"
        prompt += "3. TREND ALIGNMENT: Your analysis MUST completely align with the mathematical result. Do NOT calculate your own score. Mention how treatments helped lower the score if present.\n"
        prompt += "4. FORMAT: Keep it professional, concise, and under 4 sentences."

        # 7. Call Gemini API
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )

        return {"ai_response": response.text}

    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {"ai_response": f"**[AI UNAVAILABLE - Error: {str(e)}]**"}



@app.post("/chat-ai")
def chat_ai_doctor(request: ChatRequest):
    try:
        # A. DEFINE THE TOOL: This is the function Gemini is allowed to use!
        def simulate_treatment(statin: str = "None", bp_med: str = "None", pci: str = "None") -> str:
            """Calculates the new cardiovascular risk percentage if the patient changes their treatments.
            Args:
                statin: 'None', 'Moderate', or 'High'
                bp_med: 'None', 'Monotherapy', or 'Dual'
                pci: 'None' or 'Yes'
            """
            base_prob = bayesian_service.predict_risk(request.evidence)
            final_prob = float(base_prob)
            if statin == 'High': final_prob *= 0.57
            elif statin == 'Moderate': final_prob *= 0.70
            if bp_med == 'Dual': final_prob *= 0.43
            elif bp_med == 'Monotherapy': final_prob *= 0.65
            if pci == 'Yes': final_prob *= 0.80
            return f"The exact mathematical risk with these new treatments is {final_prob * 100:.1f}%"

        # B. Calculate the patient's current baseline for context
        base_prob = bayesian_service.predict_risk(request.evidence)
        current_prob = float(base_prob)
        if request.treatments:
            t = request.treatments
            if t.get('statin') == 'High': current_prob *= 0.57
            elif t.get('statin') == 'Moderate': current_prob *= 0.70
            if t.get('bp_med') == 'Dual': current_prob *= 0.43
            elif t.get('bp_med') == 'Monotherapy': current_prob *= 0.65
            if t.get('pci') == 'Yes': current_prob *= 0.80

        # C. Strictly Instruct the AI
        sys_instruct = (
            f"You are an AI cardiologist assistant. The patient's CURRENT calculated risk is {current_prob * 100:.1f}%. "
            "You MUST use the `simulate_treatment` tool to answer 'what-if' questions about starting medications (statins, BP meds, or PCI). "
            "Never calculate the math yourself. Always call the tool, then explain the result to the user naturally and concisely."
        )

        # D. Format the previous conversation history for the SDK
        formatted_history = []
        for msg in request.history:
            role = "user" if msg.role == "user" else "model"
            formatted_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
            )

        # E. Create the stateful chat session and attach the tool
        chat = client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=sys_instruct,
                tools=[simulate_treatment], # <-- Handing the tool to Gemini!
                temperature=0.2
            ),
            history=formatted_history
        )

        # F. Send the user's newest message
        response = chat.send_message(request.message)

        return {"reply": response.text}

    except Exception as e:
        print(f"Chat API Error: {e}")
        return {"reply": f"**[System Error]** Could not reach the AI: {str(e)}"}



@app.post("/ask-ai-general")
def ask_ai_general(request: PredictionRequest):
    """An independent AI that acts as a clinical reviewer to the BN math."""
    try:
        base_probability = bayesian_service.predict_risk(request.evidence)
        final_probability = float(base_probability)

        if request.treatments:
            t = request.treatments
            if t.get('statin') == 'High': final_probability *= 0.57
            elif t.get('statin') == 'Moderate': final_probability *= 0.70
            if t.get('bp_med') == 'Dual': final_probability *= 0.43
            elif t.get('bp_med') == 'Monotherapy': final_probability *= 0.65
            if t.get('pci') == 'Yes': final_probability *= 0.80

        bn_percentage = final_probability * 100

        prompt = (
            "You are an AI medical assistant evaluating cardiovascular risk. "
            "Review the following patient profile.\n\n"
        )
        for key, value in request.evidence.items():
            prompt += f"- {key}: {value}\n"
        if request.treatments:
            prompt += "Treatments:\n"
            for key, value in request.treatments.items():
                prompt += f"- {key}: {value}\n"

        prompt += "\nRULES:\n"
        prompt += "1. INDEPENDENT CLINICAL ASSESSMENT: Ignore the deterministic math model for your calculation. Rely purely on standard modern cardiovascular risk assessment intuition to evaluate this specific patient profile. Calculate your own independent risk percentage based on the clinical severity of these inputs.\n"
        prompt += f"2. THE CONTRADICTION CHECK: For your awareness, the mathematical Bayesian Network calculated a {bn_percentage:.1f}% risk. If your independent clinical estimate differs significantly from this math, briefly explain *why* the mathematical model might be flawed in this specific case (e.g., statistical dataset quirks, over-penalizing age, or misinterpreting asymptomatic presentation).\n"
        prompt += "3. JSON FORMAT: You MUST return your answer as a raw JSON object with exactly two keys:\n"
        prompt += "   - 'ai_percentage': An integer representing your independent clinical risk score (e.g., 25).\n"
        prompt += "   - 'explanation': A 3-sentence explanation of your clinical assessment. You MUST explicitly state your independent percentage within this text, and note how it compares to the mathematical model.\n"

        prompt += "Do not wrap the JSON in markdown blocks.\n"

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        # Safely parse the JSON response
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()

        ai_data = json.loads(raw_text)

        return {
            "ai_response": ai_data.get("explanation", "Could not generate explanation."),
            "ai_percentage": ai_data.get("ai_percentage", int(bn_percentage))
        }

    except Exception as e:
        print(f"General AI API Error: {e}")
        return {"ai_response": f"**[AI UNAVAILABLE]**", "ai_percentage": 0}


@app.post("/save-record")
def save_record(request: SaveRecordRequest):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Note: Postgres uses %s instead of ?
        cursor.execute(
            "INSERT INTO records (patient_name, bn_score, ai_score) VALUES (%s, %s, %s)",
            (request.patient_name, request.bn_score, request.ai_score)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Record saved to database."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

#hello
@app.get("/global-stats")
def get_global_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT bn_score, ai_score, patient_name FROM records")
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return {"total_records": 0, "avg_bn": 0, "avg_ai": 0, "data_points": []}

        avg_bn = sum(row[0] for row in rows) / len(rows)
        avg_ai = sum(row[1] for row in rows) / len(rows)

        # Format all historical patients into a list for the scatter plot
        data_points = [{"name": row[2], "bn": round(row[0], 1), "ai": row[1]} for row in rows]

        return {
            "total_records": len(rows),
            "avg_bn": round(avg_bn, 1),
            "avg_ai": round(avg_ai, 1),
            "data_points": data_points
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}