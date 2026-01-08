import { TopFactor } from "@/lib/types";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface TopFactorsProps {
  factors: TopFactor[] | undefined;
  isLoading: boolean;
}

function getInfluenceColor(influence: number): string {
  if (influence >= 20) return "border-destructive bg-destructive/5";
  if (influence >= 10) return "border-warning bg-warning/5";
  return "border-muted bg-muted/50";
}

function getInfluenceIcon(influence: number) {
  if (influence >= 20) return <AlertTriangle className="w-4 h-4 text-destructive" />;
  return <TrendingUp className="w-4 h-4 text-warning" />;
}

export function TopFactors({ factors, isLoading }: TopFactorsProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-soft animate-pulse">
        <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded mb-3"></div>
        ))}
      </div>
    );
  }

  if (!factors || factors.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-foreground mb-4">Top Influential Factors</h3>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-foreground mb-4">Top Influential Factors</h3>
      
      <div className="space-y-3">
        {factors.map((factor, index) => (
          <div
            key={factor.attribute}
            className={`p-4 rounded-lg border-l-4 transition-all animate-fade-in ${getInfluenceColor(factor.influence)}`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {index + 1}
                </span>
                <div>
                  <div className="font-medium text-foreground">{factor.label}</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    P(Disease) = {factor.probability.toFixed(4)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getInfluenceIcon(factor.influence)}
                <span className="text-sm font-semibold text-foreground">
                  +{factor.influence.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Influence shows deviation from baseline (50%). Higher values indicate stronger impact on risk.
        </p>
      </div>
    </div>
  );
}
