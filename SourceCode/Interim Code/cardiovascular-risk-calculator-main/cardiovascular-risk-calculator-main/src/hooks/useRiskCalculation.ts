import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PatientData, RiskResult, NetworkStructure, Metadata, DEFAULT_PATIENT_DATA } from "@/lib/types";

export function useRiskCalculation() {
  const [patientData, setPatientData] = useState<PatientData>(DEFAULT_PATIENT_DATA);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [networkStructure, setNetworkStructure] = useState<NetworkStructure | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworkData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("calculate-risk", {
        method: "GET"
      });
      
      if (error) throw error;
      
      setNetworkStructure(data.network);
      setMetadata(data.metadata);
    } catch (err) {
      console.error("Error fetching network data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch network data");
    }
  }, []);

  const calculateRisk = useCallback(async (data: PatientData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: result, error } = await supabase.functions.invoke("calculate-risk", {
        body: data
      });
      
      if (error) throw error;
      
      setRiskResult(result);
    } catch (err) {
      console.error("Error calculating risk:", err);
      setError(err instanceof Error ? err.message : "Failed to calculate risk");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePatientData = useCallback((key: keyof PatientData, value: string) => {
    setPatientData(prev => {
      const updated = { ...prev, [key]: value };
      calculateRisk(updated);
      return updated;
    });
  }, [calculateRisk]);

  const resetToBaseline = useCallback(() => {
    setPatientData(DEFAULT_PATIENT_DATA);
    calculateRisk(DEFAULT_PATIENT_DATA);
  }, [calculateRisk]);

  useEffect(() => {
    fetchNetworkData();
    calculateRisk(DEFAULT_PATIENT_DATA);
  }, [fetchNetworkData, calculateRisk]);

  return {
    patientData,
    riskResult,
    networkStructure,
    metadata,
    isLoading,
    error,
    updatePatientData,
    resetToBaseline
  };
}
