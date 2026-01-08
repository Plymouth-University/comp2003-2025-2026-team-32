import { PatientData, Metadata, ATTRIBUTE_LABELS } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface PatientInputPanelProps {
  patientData: PatientData;
  metadata: Metadata | null;
  onUpdate: (key: keyof PatientData, value: string) => void;
  onReset: () => void;
}

const TIER_CONFIG: Record<string, { tier: number; label: string }> = {
  age: { tier: 1, label: "Demographics" },
  sex: { tier: 1, label: "Demographics" },
  bp: { tier: 2, label: "Clinical Factors" },
  chol: { tier: 2, label: "Clinical Factors" },
  fbs: { tier: 2, label: "Clinical Factors" },
  restecg: { tier: 2, label: "Clinical Factors" },
  thal: { tier: 2, label: "Clinical Factors" },
  thalach: { tier: 3, label: "Exercise Test Results" },
  oldpeak: { tier: 3, label: "Exercise Test Results" },
  slope: { tier: 3, label: "Exercise Test Results" },
  ca: { tier: 3, label: "Exercise Test Results" },
  exang: { tier: 5, label: "Symptoms" },
  cp: { tier: 5, label: "Symptoms" }
};

function formatOptionLabel(option: string): string {
  return option.replace(/_/g, " ").replace(/\./g, "");
}

export function PatientInputPanel({ patientData, metadata, onUpdate, onReset }: PatientInputPanelProps) {
  if (!metadata) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-soft animate-pulse">
        <div className="h-8 bg-muted rounded w-3/4 mb-6"></div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="mb-4">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const groupedAttributes = Object.entries(TIER_CONFIG).reduce((acc, [attr, config]) => {
    if (!acc[config.label]) {
      acc[config.label] = [];
    }
    if (metadata.attribute_bins[attr]) {
      acc[config.label].push(attr);
    }
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft overflow-y-auto max-h-[calc(100vh-180px)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Patient Attributes</h2>
        <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {Object.entries(groupedAttributes).map(([group, attributes]) => (
        <div key={group} className="mb-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
            <span className="text-sm font-medium text-primary">{group}</span>
          </div>
          
          <div className="space-y-4">
            {attributes.map((attr) => (
              <div key={attr} className="space-y-2">
                <Label htmlFor={attr} className="text-sm font-medium text-muted-foreground">
                  {ATTRIBUTE_LABELS[attr] || attr}
                </Label>
                <Select
                  value={patientData[attr as keyof PatientData]}
                  onValueChange={(value) => onUpdate(attr as keyof PatientData, value)}
                >
                  <SelectTrigger id={attr} className="w-full bg-background">
                    <SelectValue placeholder={`Select ${ATTRIBUTE_LABELS[attr]}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata.attribute_bins[attr]?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
