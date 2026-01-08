import { RiskResult } from "@/lib/types";
import { Heart, TrendingUp } from "lucide-react";

interface RiskDashboardProps {
  result: RiskResult | null;
  isLoading: boolean;
}

function getRiskLevel(probability: number): { label: string; colorClass: string; bgClass: string } {
  if (probability < 40) {
    return { label: "Low Risk", colorClass: "text-success", bgClass: "bg-success" };
  } else if (probability < 60) {
    return { label: "Moderate Risk", colorClass: "text-warning", bgClass: "bg-warning" };
  } else {
    return { label: "High Risk", colorClass: "text-destructive", bgClass: "bg-destructive" };
  }
}

export function RiskDashboard({ result, isLoading }: RiskDashboardProps) {
  if (isLoading || !result) {
    return (
      <div className="gradient-primary rounded-xl p-8 text-primary-foreground shadow-medium animate-pulse">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Heart className="w-6 h-6 opacity-50" />
          <span className="text-lg font-medium opacity-50">Calculating...</span>
        </div>
        <div className="h-24 bg-primary-foreground/10 rounded-lg mb-6"></div>
        <div className="h-12 bg-primary-foreground/10 rounded-full"></div>
      </div>
    );
  }

  const { label, colorClass, bgClass } = getRiskLevel(result.disease_probability);

  return (
    <div className="gradient-primary rounded-xl p-8 text-primary-foreground shadow-medium shadow-glow-primary">
      <div className="flex items-center justify-center gap-3 mb-2">
        <Heart className="w-6 h-6" />
        <span className="text-lg font-medium">Heart Disease Risk Assessment</span>
      </div>
      
      <div className="text-center my-6">
        <div className="text-7xl font-bold tracking-tight animate-fade-in">
          {result.disease_probability}%
        </div>
        <div className={`inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full ${bgClass} bg-opacity-20 border border-current/20`}>
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
      </div>

      {/* Probability bars */}
      <div className="space-y-3 mt-8">
        <div className="relative">
          <div className="flex h-10 rounded-full overflow-hidden bg-primary-foreground/10">
            <div 
              className="bg-destructive flex items-center justify-center transition-all duration-500 ease-out"
              style={{ width: `${result.disease_probability}%` }}
            >
              {result.disease_probability >= 20 && (
                <span className="text-xs font-semibold text-destructive-foreground">
                  Positive
                </span>
              )}
            </div>
            <div 
              className="bg-success flex items-center justify-center transition-all duration-500 ease-out"
              style={{ width: `${100 - result.disease_probability}%` }}
            >
              {result.disease_probability <= 80 && (
                <span className="text-xs font-semibold text-success-foreground">
                  Negative
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-between text-sm opacity-80">
          <span>Disease Positive: {result.disease_probability}%</span>
          <span>Disease Negative: {(100 - result.disease_probability).toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
