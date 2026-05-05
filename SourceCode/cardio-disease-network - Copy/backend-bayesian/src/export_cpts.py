import pickle
import os

# Path to your saved model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'saved_model.pkl')

def generate_cpt_document():
    if not os.path.exists(MODEL_PATH):
        print("Error: saved_model.pkl not found. Run your main app first to train it!")
        return

    # Load the trained model
    with open(MODEL_PATH, 'rb') as f:
        loaded_obj = pickle.load(f)

    # Handle both new (dict) and old (direct model) pickle formats for robustness.
    if isinstance(loaded_obj, dict):
        # New format: The pickle file is a dictionary {'model': ..., 'infer': ...}
        model = loaded_obj.get('model')
        if model is None:
            print("Error: The saved_model.pkl dictionary is missing the 'model' key.")
            return
    else:
        # Old format: The pickle file is the pgmpy model object itself.
        model = loaded_obj

    output_filename = "Model_CPTs_For_Client_Review.txt"

    with open(output_filename, "w") as doc:
        doc.write("=========================================================\n")
        doc.write("   NAIVE BAYES CONDITIONAL PROBABILITY TABLES (CPTs)\n")
        doc.write("=========================================================\n")
        doc.write("Use this document to cross-reference the model's internal\n")
        doc.write("math against the manual Exploratory Data Analysis (EDA).\n\n")

        # Loop through every node and print its probability table
        for cpd in model.get_cpds():
            doc.write(f"--- Node: {cpd.variable} ---\n")
            doc.write(str(cpd))
            doc.write("\n\n")

    print(f"Success! I have generated the file: {output_filename}")

if __name__ == "__main__":
    generate_cpt_document()