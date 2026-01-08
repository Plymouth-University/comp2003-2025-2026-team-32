import { useRiskCalculation } from "@/hooks/useRiskCalculation";
import { PatientInputPanel } from "@/components/PatientInputPanel";
import { RiskDashboard } from "@/components/RiskDashboard";
import { TopFactors } from "@/components/TopFactors";
import { NetworkVisualization } from "@/components/NetworkVisualization";
import { Heart, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Index = () => {
  const {
    patientData,
    riskResult,
    networkStructure,
    metadata,
    isLoading,
    error,
    updatePatientData,
    resetToBaseline
  } = useRiskCalculation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary py-6 px-4 shadow-medium">
        <div className="container max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-foreground/10 rounded-lg">
              <Heart className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                Cardiovascular Risk Calculator
              </h1>
              <p className="text-primary-foreground/80 text-sm md:text-base">
                Bayesian Network-Based Heart Disease Prediction
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-7xl mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel - Inputs */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <PatientInputPanel
              patientData={patientData}
              metadata={metadata}
              onUpdate={updatePatientData}
              onReset={resetToBaseline}
            />
          </aside>

          {/* Right panel - Results */}
          <section className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Risk Dashboard */}
            <RiskDashboard result={riskResult} isLoading={isLoading} />

            {/* Two columns for factors and network */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TopFactors factors={riskResult?.top_factors} isLoading={isLoading} />
              <NetworkVisualization
                network={networkStructure}
                topFactors={riskResult?.top_factors}
                allProbabilities={riskResult?.all_probabilities}
                diseaseProb={riskResult?.positive_prob}
                isLoading={isLoading}
              />
            </div>

            {/* Info panel */}
            <div className="bg-card rounded-xl p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">About This Calculator</p>
                  <p>
                    This cardiovascular risk assessment tool uses a Bayesian Network model trained on 
                    clinical heart disease data. The model calculates the probability of heart disease 
                    based on 10 parent factors including demographics, clinical measurements, and 
                    exercise test results.
                  </p>
                  <p className="mt-2">
                    <strong>Methodology:</strong> Probabilities are computed using Conditional Probability 
                    Tables (CPTs) learned with Bayesian Estimation (BDeu prior, ESS=10). The weighted 
                    average approach accounts for varying predictive strengths of each factor.
                  </p>
                  <p className="mt-2 text-xs opacity-70">
                    COMP2003 Project • Team 32: Jorjit, Rush, Hussain • Client: Yvonne
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
