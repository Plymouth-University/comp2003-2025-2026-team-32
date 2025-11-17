from ucimlrepo import fetch_ucirepo 
import pandas as pd
  
# fetch dataset 
heart_disease = fetch_ucirepo(id=45) 
  
# data (as pandas dataframes) 
X = heart_disease.data.features 
y = heart_disease.data.targets 
  
# --- ADD THESE LINES TO VIEW THE DATA ---

# Print the first 5 rows of the features (X)
print("--- Features (X) ---")
print(X.head()) 
  
# Print the first 5 rows of the targets (y)
print("\n--- Targets (y) ---")
print(y.head())

# --- YOU CAN STILL PRINT THE METADATA ---

# metadata 
print("\n--- Metadata ---")
print(heart_disease.metadata) 
  
# variable information 
print("\n--- Variable Info ---")
print(heart_disease.variables)

 # You'll need to import pandas directly for this

# ... (your existing code to fetch heart_disease, X, and y) ...

# Combine X and y side-by-side into a single DataFrame
# axis=1 tells pandas to join them as new columns
full_dataset = pd.concat([X, y], axis=1)

# --- Now, save this combined DataFrame to a file ---

# Option A: Save to a CSV file (most common)
full_dataset.to_csv('heart_disease_dataset.csv', index=False)
print("Successfully saved data to heart_disease_dataset.csv")

# Option B: Save to an Excel file (requires 'openpyxl' library)
# You might need to run: pip install openpyxl
# full_dataset.to_excel('heart_disease_dataset.xlsx', index=False)
# print("Successfully saved data to heart_disease_dataset.xlsx")