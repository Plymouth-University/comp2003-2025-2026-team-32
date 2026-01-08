import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CPT Tables - Conditional Probability Tables from Bayesian Network
// These represent P(Disease=Positive | ParentValue)
const CPT_TABLES = {
  parents_to_disease: {
    sex_to_disease: {
      "Female": { "Negative": 0.75, "Positive": 0.25 },
      "Male": { "Negative": 0.44, "Positive": 0.56 }
    },
    bp_to_disease: {
      "Normal": { "Negative": 0.58, "Positive": 0.42 },
      "Elevated": { "Negative": 0.52, "Positive": 0.48 },
      "High_BP": { "Negative": 0.48, "Positive": 0.52 }
    },
    chol_to_disease: {
      "Desirable": { "Negative": 0.56, "Positive": 0.44 },
      "Borderline": { "Negative": 0.52, "Positive": 0.48 },
      "High_Chol": { "Negative": 0.48, "Positive": 0.52 }
    },
    hr_to_disease: {
      "Low_Rate": { "Negative": 0.38, "Positive": 0.62 },
      "Normal_Rate": { "Negative": 0.54, "Positive": 0.46 },
      "High_Rate": { "Negative": 0.68, "Positive": 0.32 }
    },
    oldpeak_to_disease: {
      "No_Depression": { "Negative": 0.72, "Positive": 0.28 },
      "Ischemia": { "Negative": 0.35, "Positive": 0.65 },
      "Severe_Ischemia": { "Negative": 0.18, "Positive": 0.82 }
    },
    slope_to_disease: {
      "Upsloping": { "Negative": 0.70, "Positive": 0.30 },
      "Flat": { "Negative": 0.42, "Positive": 0.58 },
      "Downsloping": { "Negative": 0.28, "Positive": 0.72 }
    },
    ca_to_disease: {
      "0.0_Vessels": { "Negative": 0.72, "Positive": 0.28 },
      "1.0_Vessels": { "Negative": 0.35, "Positive": 0.65 },
      "2.0_Vessels": { "Negative": 0.22, "Positive": 0.78 },
      "3.0_Vessels": { "Negative": 0.12, "Positive": 0.88 },
      "nan_Vessels": { "Negative": 0.50, "Positive": 0.50 }
    },
    thal_to_disease: {
      "Normal": { "Negative": 0.74, "Positive": 0.26 },
      "Fixed_Defect": { "Negative": 0.38, "Positive": 0.62 },
      "Reversible_Defect": { "Negative": 0.28, "Positive": 0.72 }
    },
    fbs_to_disease: {
      "Normal_Sugar": { "Negative": 0.55, "Positive": 0.45 },
      "High_Sugar": { "Negative": 0.48, "Positive": 0.52 }
    },
    restecg_to_disease: {
      "Normal": { "Negative": 0.55, "Positive": 0.45 },
      "ST_Abnorm": { "Negative": 0.48, "Positive": 0.52 },
      "LVH": { "Negative": 0.50, "Positive": 0.50 }
    }
  },
  metadata: {
    ess_value: 10,
    estimation_method: "BayesianEstimator with BDeu Prior",
    attribute_bins: {
      age: ["Young", "Middle", "Old"],
      sex: ["Female", "Male"],
      bp: ["Normal", "Elevated", "High_BP"],
      chol: ["Desirable", "Borderline", "High_Chol"],
      fbs: ["Normal_Sugar", "High_Sugar"],
      restecg: ["Normal", "ST_Abnorm", "LVH"],
      thalach: ["Low_Rate", "Normal_Rate", "High_Rate"],
      exang: ["No", "Yes"],
      oldpeak: ["No_Depression", "Ischemia", "Severe_Ischemia"],
      slope: ["Upsloping", "Flat", "Downsloping"],
      ca: ["0.0_Vessels", "1.0_Vessels", "2.0_Vessels", "3.0_Vessels", "nan_Vessels"],
      thal: ["Normal", "Fixed_Defect", "Reversible_Defect"],
      cp: ["Typical_Angina", "Atypical_Angina", "Non_Anginal", "Asymptomatic"],
      disease: ["Negative", "Positive"]
    }
  }
};

interface PatientData {
  age?: string;
  sex?: string;
  bp?: string;
  chol?: string;
  fbs?: string;
  restecg?: string;
  thalach?: string;
  exang?: string;
  oldpeak?: string;
  slope?: string;
  ca?: string;
  thal?: string;
  cp?: string;
}

interface RiskResult {
  disease_probability: number;
  positive_prob: number;
  negative_prob: number;
  confidence: number;
  top_factors: Array<{
    attribute: string;
    probability: number;
    influence: number;
    label: string;
  }>;
  all_probabilities: Record<string, number>;
}

function getAttributeLabel(attr: string): string {
  const labels: Record<string, string> = {
    sex: "Sex",
    bp: "Blood Pressure",
    chol: "Cholesterol",
    thalach: "Max Heart Rate",
    oldpeak: "ST Depression",
    slope: "ST Slope",
    ca: "Vessels Colored",
    thal: "Thalassemia",
    fbs: "Fasting Blood Sugar",
    restecg: "Resting ECG"
  };
  return labels[attr] || attr.toUpperCase();
}

function getProbability(cptDict: Record<string, Record<string, number>>, parentValue: string, childState: string): number {
  try {
    if (parentValue in cptDict) {
      return cptDict[parentValue][childState] ?? 0.0;
    }
    return 0.0;
  } catch (e) {
    console.error(`Error getting probability: ${e}`);
    return 0.0;
  }
}

function calculateDiseaseRisk(patientData: PatientData): RiskResult {
  const sex = patientData.sex ?? "Male";
  const bp = patientData.bp ?? "Normal";
  const chol = patientData.chol ?? "Desirable";
  const fbs = patientData.fbs ?? "Normal_Sugar";
  const restecg = patientData.restecg ?? "Normal";
  const thalach = patientData.thalach ?? "Normal_Rate";
  const oldpeak = patientData.oldpeak ?? "No_Depression";
  const slope = patientData.slope ?? "Flat";
  const ca = patientData.ca ?? "0.0_Vessels";
  const thal = patientData.thal ?? "Normal";

  const parentsCpts = CPT_TABLES.parents_to_disease;
  const probs: Array<[string, number]> = [];

  // Sex -> Disease
  const probSex = getProbability(parentsCpts.sex_to_disease, sex, "Positive");
  probs.push(["sex", probSex]);

  // BP -> Disease
  const probBp = getProbability(parentsCpts.bp_to_disease, bp, "Positive");
  probs.push(["bp", probBp]);

  // Cholesterol -> Disease
  const probChol = getProbability(parentsCpts.chol_to_disease, chol, "Positive");
  probs.push(["chol", probChol]);

  // Heart Rate -> Disease
  const probHr = getProbability(parentsCpts.hr_to_disease, thalach, "Positive");
  probs.push(["thalach", probHr]);

  // Oldpeak -> Disease
  const probOldpeak = getProbability(parentsCpts.oldpeak_to_disease, oldpeak, "Positive");
  probs.push(["oldpeak", probOldpeak]);

  // Slope -> Disease
  const probSlope = getProbability(parentsCpts.slope_to_disease, slope, "Positive");
  probs.push(["slope", probSlope]);

  // CA -> Disease
  const probCa = getProbability(parentsCpts.ca_to_disease, ca, "Positive");
  probs.push(["ca", probCa]);

  // Thal -> Disease
  const probThal = getProbability(parentsCpts.thal_to_disease, thal, "Positive");
  probs.push(["thal", probThal]);

  // FBS -> Disease
  const probFbs = getProbability(parentsCpts.fbs_to_disease, fbs, "Positive");
  probs.push(["fbs", probFbs]);

  // RestECG -> Disease
  const probRestecg = getProbability(parentsCpts.restecg_to_disease, restecg, "Positive");
  probs.push(["restecg", probRestecg]);

  // Calculate weighted average (naive Bayes approximation)
  const weights: Record<string, number> = {
    oldpeak: 1.5,
    ca: 1.4,
    thal: 1.3,
    slope: 1.2,
    thalach: 1.1,
    sex: 1.0,
    bp: 0.9,
    chol: 0.9,
    fbs: 0.7,
    restecg: 0.8
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [attr, prob] of probs) {
    const weight = weights[attr] ?? 1.0;
    weightedSum += prob * weight;
    totalWeight += weight;
  }

  const positiveProb = weightedSum / totalWeight;
  const negativeProb = 1.0 - positiveProb;

  // Identify top 3 influential factors
  const sortedProbs = [...probs].sort((a, b) => Math.abs(b[1] - 0.5) - Math.abs(a[1] - 0.5));
  const topFactors = sortedProbs.slice(0, 3).map(([attr, prob]) => ({
    attribute: attr,
    probability: Math.round(prob * 10000) / 10000,
    influence: Math.round(Math.abs(prob - 0.5) * 1000) / 10,
    label: getAttributeLabel(attr)
  }));

  return {
    disease_probability: Math.round(positiveProb * 10000) / 100,
    positive_prob: Math.round(positiveProb * 10000) / 10000,
    negative_prob: Math.round(negativeProb * 10000) / 10000,
    confidence: Math.round(Math.max(positiveProb, negativeProb) * 10000) / 10000,
    top_factors: topFactors,
    all_probabilities: Object.fromEntries(probs.map(([attr, prob]) => [attr, Math.round(prob * 10000) / 10000]))
  };
}

// Network structure for visualization
const NETWORK_STRUCTURE = {
  nodes: [
    { id: "age", label: "Age", tier: 1, x: 200, y: 50 },
    { id: "sex", label: "Sex", tier: 1, x: 400, y: 50 },
    { id: "bp", label: "Blood Pressure", tier: 2, x: 100, y: 150 },
    { id: "chol", label: "Cholesterol", tier: 2, x: 250, y: 150 },
    { id: "fbs", label: "Fasting Blood Sugar", tier: 2, x: 400, y: 200 },
    { id: "restecg", label: "Resting ECG", tier: 2, x: 550, y: 200 },
    { id: "thal", label: "Thalassemia", tier: 2, x: 500, y: 150 },
    { id: "thalach", label: "Max Heart Rate", tier: 3, x: 150, y: 300 },
    { id: "oldpeak", label: "ST Depression", tier: 3, x: 300, y: 300 },
    { id: "slope", label: "Slope", tier: 3, x: 450, y: 300 },
    { id: "ca", label: "Vessels Colored", tier: 3, x: 600, y: 300 },
    { id: "disease", label: "Heart Disease", tier: 4, x: 350, y: 450 },
    { id: "cp", label: "Chest Pain", tier: 5, x: 250, y: 600 },
    { id: "exang", label: "Exercise Angina", tier: 5, x: 450, y: 600 }
  ],
  edges: [
    { source: "sex", target: "bp" },
    { source: "age", target: "bp" },
    { source: "sex", target: "chol" },
    { source: "age", target: "chol" },
    { source: "age", target: "thalach" },
    { source: "age", target: "ca" },
    { source: "chol", target: "ca" },
    { source: "thalach", target: "ca" },
    { source: "sex", target: "disease" },
    { source: "bp", target: "disease" },
    { source: "chol", target: "disease" },
    { source: "thalach", target: "disease" },
    { source: "oldpeak", target: "disease" },
    { source: "slope", target: "disease" },
    { source: "ca", target: "disease" },
    { source: "thal", target: "disease" },
    { source: "fbs", target: "disease" },
    { source: "restecg", target: "disease" },
    { source: "disease", target: "cp" },
    { source: "disease", target: "exang" }
  ]
};

serve(async (req) => {
  console.log("Received request:", req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "POST" && path === "calculate-risk") {
      const patientData: PatientData = await req.json();
      console.log("Calculating risk for patient data:", patientData);
      const result = calculateDiseaseRisk(patientData);
      console.log("Risk calculation result:", result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && path === "calculate-risk") {
      // Return network structure and metadata
      return new Response(JSON.stringify({
        network: NETWORK_STRUCTURE,
        metadata: CPT_TABLES.metadata
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
