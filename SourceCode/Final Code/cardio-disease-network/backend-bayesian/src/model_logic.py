import pandas as pd
import numpy as np
from pgmpy.models import DiscreteBayesianNetwork
from pgmpy.estimators import BayesianEstimator
from pgmpy.inference import VariableElimination
import os
import pickle

# Define the paths to your dataset and the new saved model file
DATASET_PATH = os.path.join(os.path.dirname(__file__), 'heart_disease_dataset.csv')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'saved_model.pkl')

class CardioBayesianModel:
    def __init__(self):
        self.model = None
        self.infer = None
        self.training_data = None

    def load_and_train(self):
        """Loads data, discretizes it, defines Naive Bayes structure, and trains (or loads) the model."""

        # --- FIX 1: SOLVING THE 5-MINUTE LOAD TIME ---
        if os.path.exists(MODEL_PATH):
            print("Loading pre-trained model from disk...")
            with open(MODEL_PATH, 'rb') as f:
                saved_data = pickle.load(f)
                self.model = saved_data['model']
                self.infer = saved_data['infer']
                self.training_data = saved_data['training_data']
            print("Model loaded instantly!")
            return

        # If no saved model exists, train from scratch
        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(f"Dataset not found at {DATASET_PATH}")

        print(f"Loading dataset from: {DATASET_PATH}")
        df = pd.read_csv(DATASET_PATH)

        # Process the data
        formatted_df = self._discretize_heart_data(df)
        self.training_data = formatted_df

        if formatted_df.empty:
            raise ValueError("CRITICAL ERROR: Dataset is empty after processing.")

        print(f"--- Processed Data Info ({len(formatted_df)} rows) ---")

        # --- FIX 2: NAIVE BAYES DAG STRUCTURE ---
        # Disease_Target is now the parent of ALL evidence nodes.
        # This prevents the "35% max risk" curse of dimensionality on small datasets.
        self.model = DiscreteBayesianNetwork([
            ('Disease_Target', 'Age_Bin'),
            ('Disease_Target', 'Sex_Label'),
            ('Disease_Target', 'CP_Label'),
            ('Disease_Target', 'BP_Bin'),
            ('Disease_Target', 'Chol_Bin'),
            ('Disease_Target', 'FBS_Label'),
            ('Disease_Target', 'ECG_Label'),
            ('Disease_Target', 'HR_Bin'),
            ('Disease_Target', 'Exang_Label'),
            ('Disease_Target', 'Oldpeak_Bin'),
            ('Disease_Target', 'Slope_Label'),
            ('Disease_Target', 'Thal_Label'),
            ('Disease_Target', 'CA_Label')
        ])

        print("Fitting model...")
        # Lowered equivalent_sample_size to 1 to reduce mathematical dilution of severe cases
        self.model.fit(formatted_df, estimator=BayesianEstimator, prior_type='BDeu', equivalent_sample_size=1)
        self.infer = VariableElimination(self.model)

        # Save the model so we never have to run this heavy math again
        print("Saving trained model to disk...")
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'infer': self.infer,
                'training_data': self.training_data
            }, f)

        print("Model trained and saved successfully.")

    def predict_risk(self, evidence):
        try:
            # Clean the evidence to ensure we don't pass empty/null values to pgmpy
            valid_evidence = {k: v for k, v in evidence.items() if v and v != "-- Select --"}

            result = self.infer.query(variables=['Disease_Target'], evidence=valid_evidence)
            if 'Positive' in result.state_names['Disease_Target']:
                pos_idx = result.name_to_no['Disease_Target']['Positive']
                return result.values[pos_idx]
            else:
                return 0.0
        except Exception as e:
            print(f"Prediction Error: {e}")
            return None

    def calculate_feature_impacts(self, evidence):
        """
        Calculates how much each individual piece of evidence impacts the final risk
        using the Leave-One-Out method.
        """
        if not self.infer:
            return []

        # Clean the evidence
        valid_evidence = {k: v for k, v in evidence.items() if v and v != "-- Select --"}
        if not valid_evidence:
            return []

        TARGET_COLUMN = 'Disease_Target'
        POSITIVE_VAL = 'Positive'
        impacts = []

        try:
            # 1. Get the baseline risk WITH all evidence
            base_q = self.infer.query(variables=[TARGET_COLUMN], evidence=valid_evidence)
            states = list(base_q.state_names[TARGET_COLUMN])
            pos_idx = states.index(POSITIVE_VAL)
            full_risk = base_q.values[pos_idx]

            # 2. Leave-One-Out Loop
            for feature, value in valid_evidence.items():
                # Create a hypothetical patient missing THIS specific feature
                evidence_without = {k: v for k, v in valid_evidence.items() if k != feature}

                if evidence_without:
                    q_without = self.infer.query(variables=[TARGET_COLUMN], evidence=evidence_without)
                    risk_without = q_without.values[pos_idx]
                else:
                    # If this was the ONLY piece of evidence, compare it to the absolute background prior
                    q_prior = self.infer.query(variables=[TARGET_COLUMN])
                    risk_without = q_prior.values[pos_idx]

                # 3. Calculate the delta (Impact)
                impact_val = full_risk - risk_without

                # Determine human-readable label
                if impact_val > 0.01:
                    category = "Danger"
                elif impact_val < -0.01:
                    category = "Protective"
                else:
                    category = "Neutral"

                impacts.append({
                    "feature": feature,
                    "value": value,
                    "impact_percentage": round(float(impact_val * 100), 2),
                    "category": category
                })

            # Sort the list so the biggest impacts (positive or negative) are at the top
            impacts.sort(key=lambda x: abs(x["impact_percentage"]), reverse=True)
            return impacts

        except Exception as e:
            print(f"Error calculating feature impacts: {e}")
            return []

    def get_structure(self):
        return {
            "nodes": list(self.model.nodes()),
            "edges": list(self.model.edges())
        }

    def _calculate_clinical_metrics(self):
        """Calculates standard medical AI metrics: Accuracy, Sensitivity, Specificity."""
        try:
            # 1. Drop the answers (Disease_Target) and ask the model to predict them
            predict_data = self.training_data.drop(columns=['Disease_Target'])
            predictions = self.model.predict(predict_data)

            # 2. Compare the model's guesses to the real clinical answers
            actuals = self.training_data['Disease_Target'].tolist()
            preds = predictions['Disease_Target'].tolist()

            tp = sum(1 for a, p in zip(actuals, preds) if a == 'Positive' and p == 'Positive')
            tn = sum(1 for a, p in zip(actuals, preds) if a == 'Negative' and p == 'Negative')
            fp = sum(1 for a, p in zip(actuals, preds) if a == 'Negative' and p == 'Positive')
            fn = sum(1 for a, p in zip(actuals, preds) if a == 'Positive' and p == 'Negative')

            accuracy = (tp + tn) / len(actuals) if len(actuals) > 0 else 0
            sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0

            return {
                "accuracy": round(accuracy * 100, 1),
                "sensitivity": round(sensitivity * 100, 1),
                "specificity": round(specificity * 100, 1)
            }
        except Exception as e:
            print(f"Metrics calculation error: {e}")
            return {"accuracy": 0, "sensitivity": 0, "specificity": 0}

    def verify_model_performance(self, patient_data: dict = None):
        """Returns the real clinical metrics and the dynamic baseline scenario."""
        if self.infer is None or getattr(self, 'training_data', None) is None:
            return {"error": "Model not trained"}

        results = {}
        TARGET_COLUMN = 'Disease_Target'
        POSITIVE_VAL = 'Positive'

        # 1. Get the real clinical metrics
        results['clinical_metrics'] = self._calculate_clinical_metrics()

        # 2. Get the Dynamic Clinical Scenario (Pre-Treatment Baseline)
        try:
            clean_evidence = {k: v for k, v in (patient_data or {}).items() if v and v != "-- Select --"}
            valid_evidence = {k: v for k, v in clean_evidence.items() if k in self.model.nodes()}

            if valid_evidence:
                clinical_q = self.infer.query(variables=[TARGET_COLUMN], evidence=valid_evidence)
                clin_states = list(clinical_q.state_names[TARGET_COLUMN])
                clin_pos_idx = clin_states.index(POSITIVE_VAL)
                results['clinical_scenario'] = float(clinical_q.values[clin_pos_idx])
            else:
                results['clinical_scenario'] = 0.0
        except Exception as e:
            print(f"Error in Clinical Scenario: {e}")
            results['clinical_scenario'] = 0.0

        return results

    def get_full_network_data(self):
        """Returns the network structure (edges) AND the base probabilities for each node."""
        if self.infer is None:
            return {"error": "Model not trained"}

        edges = [list(edge) for edge in self.model.edges()]

        node_data = {}
        for node in self.model.nodes():
            try:
                prob_obj = self.infer.query(variables=[node])
                states = prob_obj.state_names[node]
                values = prob_obj.values

                node_probs = []
                for i, state in enumerate(states):
                    node_probs.append({
                        "state": str(state),
                        "prob": float(values[i]),
                        "label": f"{float(values[i])*100:.1f}%"
                    })
                node_data[node] = node_probs
            except Exception as e:
                node_data[node] = []

        return {
            "edges": edges,
            "nodes": node_data
        }

    def _discretize_heart_data(self, df):
        df_bin = df.copy()

        # 1. Ensure numeric columns are actually numeric
        numeric_cols = ['age', 'trestbps', 'chol', 'thalach', 'oldpeak', 'ca', 'num']
        for col in numeric_cols:
            if col in df_bin.columns:
                df_bin[col] = pd.to_numeric(df_bin[col], errors='coerce')

        # 2. Continuous Binning
        df_bin['Age_Bin'] = pd.cut(df_bin['age'], bins=[0, 45, 60, 120], labels=['Young', 'Middle', 'Old'])
        df_bin['BP_Bin'] = pd.cut(df_bin['trestbps'], bins=[0, 120, 140, 300], labels=['Normal', 'Elevated', 'High_BP'], right=False)
        df_bin['Chol_Bin'] = pd.cut(df_bin['chol'], bins=[0, 200, 240, 600], labels=['Desirable', 'Borderline', 'High_Chol'], right=False)
        df_bin['HR_Bin'] = pd.cut(df_bin['thalach'], bins=[0, 110, 150, 250], labels=['Low_Rate', 'Normal_Rate', 'High_Rate'])
        df_bin['Oldpeak_Bin'] = pd.cut(df_bin['oldpeak'], bins=[-1, 0, 2.0, 10], labels=['No_Depression', 'Ischemia', 'Severe_Ischemia'])

        # 3. Mappings
        df_bin['Sex_Label'] = df_bin['sex'].map({1: 'Male', 0: 'Female'})
        df_bin['CA_Label'] = df_bin['ca'].apply(lambda x: f"{x}_Vessels" if pd.notnull(x) else None)
        df_bin['CP_Label'] = df_bin['cp'].map({1: 'Typical_Angina', 2: 'Atypical_Angina', 3: 'Non_Anginal', 4: 'Asymptomatic'})
        df_bin['FBS_Label'] = df_bin['fbs'].map({1: 'High_Sugar', 0: 'Normal_Sugar'})
        df_bin['ECG_Label'] = df_bin['restecg'].map({0: 'Normal', 1: 'ST_Abnorm', 2: 'LVH'})
        df_bin['Exang_Label'] = df_bin['exang'].map({1: 'Yes', 0: 'No'})
        df_bin['Slope_Label'] = df_bin['slope'].map({1: 'Upsloping', 2: 'Flat', 3: 'Downsloping'})
        df_bin['Thal_Label'] = df_bin['thal'].map({3: 'Normal', 6: 'Fixed_Defect', 7: 'Reversible_Defect'})
        df_bin['Disease_Target'] = df_bin['num'].apply(lambda x: 'Positive' if x > 0 else 'Negative')

        cols_to_keep = ['Age_Bin', 'Sex_Label', 'CP_Label', 'BP_Bin', 'Chol_Bin',
                        'FBS_Label', 'ECG_Label', 'HR_Bin', 'Exang_Label',
                        'Oldpeak_Bin', 'Slope_Label', 'Thal_Label', 'CA_Label', 'Disease_Target']

        # 4. Filter and Drop NaNs
        df_subset = df_bin[cols_to_keep].dropna()

        # 5. FINAL FIXES:
        df_subset = df_subset.reset_index(drop=True)
        df_final = df_subset.astype(object)

        return df_final