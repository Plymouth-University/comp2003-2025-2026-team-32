import os
from google import genai  # <--- NEW LIBRARY IMPORT
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, Any, List
from dotenv import load_dotenv
from src.model_logic import CardioBayesianModel


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

@app.on_event("startup")
def startup_event():
    try:
        bayesian_service.load_and_train()
    except Exception as e:
        print(f"Failed to start model: {e}")

class PredictionRequest(BaseModel):
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
        # 1. Calculate the base risk
        base_probability = bayesian_service.predict_risk(request.evidence)
        final_probability = float(base_probability)

        # 2. NEW: Apply Treatment Reductions before feeding to AI
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

        # 5. The Client Requirement: Force Trend Alignment
        prompt += f"\nCRITICAL INSTRUCTION:\n"
        prompt += f"Our deterministic Bayesian Network has calculated this patient's final risk (after any selected treatments) to be exactly {bn_percentage:.1f}% ({risk_category} Risk).\n"
        prompt += "RULES:\n"
        prompt += "1. NO HALLUCINATING NUMBERS: Do not calculate or state your own risk percentages (e.g., do not reference ASCVD scores).\n"
        prompt += f"2. TREND ALIGNMENT: Your analysis MUST completely align with the {bn_percentage:.1f}% risk figure. Make sure to explicitly mention how their selected treatments helped lower this score if treatments are present.\n"
        prompt += "3. DATA SPARSITY EXPLANATION: If the mathematical risk seems clinically paradoxical (e.g., low risk despite severe factors, or high risk despite healthy factors), explicitly explain that this model is trained on a limited custom dataset (n=303). Explain that highly specific or rare combinations of factors may trigger 'sparse data' fallbacks in the math, leading to statistically accurate but clinically surprising probabilities within this specific dataset.\n"
        prompt += "4. FORMAT: Keep it brief, professional, and under 3 sentences."

        # 6. Call Gemini API
        response = client.models.generate_content(
            model='gemini-2.0-flash',
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
            model='gemini-2.0-flash',
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