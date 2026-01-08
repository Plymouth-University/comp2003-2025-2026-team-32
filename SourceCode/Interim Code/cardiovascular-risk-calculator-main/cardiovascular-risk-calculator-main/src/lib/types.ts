export interface PatientData {
  age: string;
  sex: string;
  bp: string;
  chol: string;
  fbs: string;
  restecg: string;
  thalach: string;
  exang: string;
  oldpeak: string;
  slope: string;
  ca: string;
  thal: string;
  cp: string;
}

export interface TopFactor {
  attribute: string;
  probability: number;
  influence: number;
  label: string;
}

export interface RiskResult {
  disease_probability: number;
  positive_prob: number;
  negative_prob: number;
  confidence: number;
  top_factors: TopFactor[];
  all_probabilities: Record<string, number>;
}

export interface NetworkNode {
  id: string;
  label: string;
  tier: number;
  x: number;
  y: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
}

export interface NetworkStructure {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface AttributeBins {
  [key: string]: string[];
}

export interface Metadata {
  ess_value: number;
  estimation_method: string;
  attribute_bins: AttributeBins;
}

export const DEFAULT_PATIENT_DATA: PatientData = {
  age: "Middle",
  sex: "Male",
  bp: "Normal",
  chol: "Desirable",
  fbs: "Normal_Sugar",
  restecg: "Normal",
  thalach: "Normal_Rate",
  exang: "No",
  oldpeak: "No_Depression",
  slope: "Flat",
  ca: "0.0_Vessels",
  thal: "Normal",
  cp: "Asymptomatic"
};

export const ATTRIBUTE_LABELS: Record<string, string> = {
  age: "Age Group",
  sex: "Biological Sex",
  bp: "Blood Pressure",
  chol: "Cholesterol Level",
  fbs: "Fasting Blood Sugar",
  restecg: "Resting ECG",
  thalach: "Max Heart Rate",
  exang: "Exercise Induced Angina",
  oldpeak: "ST Depression (Oldpeak)",
  slope: "ST Slope",
  ca: "Major Vessels Colored",
  thal: "Thalassemia",
  cp: "Chest Pain Type"
};

export const TIER_COLORS: Record<number, string> = {
  1: "hsl(210, 70%, 55%)",
  2: "hsl(280, 50%, 55%)",
  3: "hsl(0, 70%, 55%)",
  4: "hsl(35, 90%, 55%)",
  5: "hsl(145, 60%, 42%)"
};
