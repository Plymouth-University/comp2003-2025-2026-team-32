# Cardiovascular Disease Risk Calculator


A web-based clinical decision support tool that uses a Bayesian Network to predict the risk of cardiovascular disease. The application provides real-time risk assessment based on patient attributes and visualizes both the network structure and the influence of various factors.

## Features

- **Real-Time Risk Calculation**: Instantly calculates and displays the probability of heart disease as patient attributes are updated.
- **Bayesian Network Model**: Utilizes a 5-tier Bayesian Network trained on the UCI Heart Disease dataset to model probabilistic relationships between clinical factors.
- **Interactive Visualization**: Dynamically renders the Bayesian Network, coloring nodes based on their calculated probabilities to provide an intuitive understanding of the model's state.
- **Top Risk Factors**: Identifies and highlights the top three most influential factors contributing to the current risk assessment.
- **Detailed Insights**: Provides probabilities for each individual factor, showing how it contributes to the final risk score.
- **Responsive UI**: Built with React, Tailwind CSS, and shadcn/ui for a modern and responsive user experience.

## How It Works

The application's core is a Bayesian Network model whose structure and Conditional Probability Tables (CPTs) were derived from a Jupyter Notebook using the `pgmpy` library. This model logic has been ported to a TypeScript-based Supabase Edge Function for scalable, serverless execution.

1.  **Data Input**: The user inputs 13 different patient attributes (e.g., Age, Blood Pressure, Cholesterol) through a series of dropdowns on the web interface.
2.  **API Call**: Each change in the input data triggers an API call to a Supabase Edge Function, sending the complete patient profile.
3.  **Backend Inference**: The Supabase function takes the patient data and applies it to the pre-computed Conditional Probability Tables (CPTs). It calculates `P(Disease | Factor)` for 10 parent factors.
4.  **Risk Aggregation**: A weighted average of these individual probabilities is computed to produce a final, aggregated risk score. This method serves as a fast approximation of full Bayesian inference.
5.  **Result Generation**: The function returns a JSON object containing the final disease probability, the probabilities contributed by each factor, and the top three most influential factors.
6.  **UI Update**: The React frontend receives the results and dynamically updates the UI components:
    - The **Risk Dashboard** shows the main probability percentage.
    - The **Top Factors** panel lists the key contributors.
    - The **Network Visualization** colors each node based on its probability and adds a glowing border to the most influential nodes.

## Technology Stack

-   **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui
-   **Backend**: Supabase Edge Functions (Deno/TypeScript)
-   **Data Visualization**: Recharts, SVG
-   **Data Analysis & Modeling**: Python, Jupyter, Pandas, `pgmpy`

## Data Source

The model was trained on the **Heart Disease Data Set** from the UCI Machine Learning Repository. Initial data exploration and preprocessing were performed in the `SourceCode/Jorjit/jupyter/eda.ipynb` notebook. The dataset was binned into categorical values as detailed in `SourceCode/Jorjit/jupyter/Data_Binning.ipynb`.

## Getting Started

To run this project locally, you will need Node.js and npm installed.

### 1. Clone the Repository

```bash
git clone https://github.com/jorjitdasoria/cardiovascular-disease-calculator.git
cd cardiovascular-disease-calculator
```

### 2. Navigate to the Application Directory

The main application code is located in the `Interim Code` folder.

```bash
cd "SourceCode/Interim Code/cardiovascular-risk-calculator-main/cardiovascular-risk-calculator-main/"
```

### 3. Set Up Environment Variables

Create a `.env` file in the root of the application directory and add your Supabase project credentials. You can use the existing values if you do not have your own Supabase project.

```env
VITE_SUPABASE_PROJECT_ID="vywbtotrjwbdfgiqosnb"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5d2J0b3RyandiZGZnaXFvc25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTA3NzEsImV4cCI6MjA4MzE4Njc3MX0.Es7SkCsjIGT_YKu5RGUONfqkfLBVj7-Ds_RCrRs2s8A"
VITE_SUPABASE_URL="https://vywbtotrjwbdfgiqosnb.supabase.co"
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Development Server

This will start the Vite development server, typically on `http://localhost:8080`.

```bash
npm run dev
```

### 6. Deploying the Supabase Function

The backend logic resides in a Supabase Edge Function. To deploy it, you will need the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# Link your local repository to your Supabase project (if you created one)
# supabase link --project-ref <your-project-id>

# Deploy the function
supabase functions deploy calculate-risk --no-verify-jwt
