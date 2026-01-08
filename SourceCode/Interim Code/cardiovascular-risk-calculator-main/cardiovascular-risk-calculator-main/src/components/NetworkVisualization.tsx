import { useEffect, useRef } from "react";
import { NetworkStructure, TopFactor, TIER_COLORS } from "@/lib/types";

interface NetworkVisualizationProps {
  network: NetworkStructure | null;
  topFactors: TopFactor[] | undefined;
  allProbabilities: Record<string, number> | undefined;
  diseaseProb: number | undefined;
  isLoading: boolean;
}

const TIER_LABELS: Record<number, string> = {
  1: "Root Causes",
  2: "Clinical Factors",
  3: "Exercise Tests",
  4: "Disease",
  5: "Symptoms"
};

// Function to interpolate color based on probability (moved outside component)
const getProbabilityColor = (prob: number): string => {
  // Green (low risk) -> Yellow (medium) -> Red (high risk)
  if (prob <= 0.5) {
    // Green to Yellow
    const ratio = prob / 0.5;
    const r = Math.round(50 + ratio * 155);
    const g = Math.round(180 - ratio * 30);
    const b = Math.round(80 - ratio * 30);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red
    const ratio = (prob - 0.5) / 0.5;
    const r = Math.round(205 + ratio * 50);
    const g = Math.round(150 - ratio * 100);
    const b = Math.round(50 - ratio * 20);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

export function NetworkVisualization({ network, topFactors, allProbabilities, diseaseProb, isLoading }: NetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!network || !svgRef.current) return;

    const svg = svgRef.current;
    const width = 700;
    const height = 650;

    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Create defs for markers
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    
    // Arrow marker
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
    polygon.setAttribute("fill", "hsl(215, 15%, 75%)");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Draw edges
    network.edges.forEach(edge => {
      const source = network.nodes.find(n => n.id === edge.source);
      const target = network.nodes.find(n => n.id === edge.target);
      
      if (source && target) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(source.x));
        line.setAttribute("y1", String(source.y));
        line.setAttribute("x2", String(target.x));
        line.setAttribute("y2", String(target.y));
        line.setAttribute("stroke", "hsl(215, 15%, 80%)");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("marker-end", "url(#arrowhead)");
        svg.appendChild(line);
      }
    });

    // Highlighted nodes
    const highlightedIds = topFactors?.map(f => f.attribute) || [];

    // Draw nodes
    network.nodes.forEach(node => {
      const isHighlighted = highlightedIds.includes(node.id);
      const tierColor = TIER_COLORS[node.tier];
      
      // Get probability for this node (use disease prob for disease node)
      const nodeProb = node.id === "disease" 
        ? (diseaseProb ?? 0.5) 
        : (allProbabilities?.[node.id] ?? null);
      
      // Determine fill color - use probability color if available
      const fillColor = nodeProb !== null 
        ? getProbabilityColor(nodeProb) 
        : tierColor;

      // Node group
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("transform", `translate(${node.x}, ${node.y})`);

      // Glow effect for highlighted nodes
      if (isHighlighted) {
        const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        glow.setAttribute("r", "50");
        glow.setAttribute("fill", "none");
        glow.setAttribute("stroke", "hsl(35, 90%, 55%)");
        glow.setAttribute("stroke-width", "4");
        glow.setAttribute("opacity", "0.6");
        glow.classList.add("animate-pulse");
        group.appendChild(glow);
      }

      // Main circle
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", node.id === "disease" ? "45" : "38");
      circle.setAttribute("fill", fillColor);
      circle.setAttribute("stroke", isHighlighted ? "hsl(35, 90%, 55%)" : "white");
      circle.setAttribute("stroke-width", isHighlighted ? "4" : "3");
      circle.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.1))";
      circle.style.transition = "fill 0.3s ease";
      group.appendChild(circle);
      
      // Probability label under node
      if (nodeProb !== null) {
        const probText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        probText.setAttribute("text-anchor", "middle");
        probText.setAttribute("y", node.id === "disease" ? "65" : "55");
        probText.setAttribute("fill", "hsl(215, 20%, 40%)");
        probText.setAttribute("font-size", "10");
        probText.setAttribute("font-weight", "500");
        probText.setAttribute("font-family", "Inter, sans-serif");
        probText.textContent = `${Math.round(nodeProb * 100)}%`;
        group.appendChild(probText);
      }

      // Label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dy", "0.35em");
      text.setAttribute("fill", "white");
      text.setAttribute("font-size", node.id === "disease" ? "11" : "10");
      text.setAttribute("font-weight", "600");
      text.setAttribute("font-family", "Inter, sans-serif");
      
      // Wrap long labels
      const words = node.label.split(" ");
      if (words.length > 1 && node.label.length > 10) {
        words.forEach((word, i) => {
          const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          tspan.setAttribute("x", "0");
          tspan.setAttribute("dy", i === 0 ? "-0.5em" : "1.1em");
          tspan.textContent = word;
          text.appendChild(tspan);
        });
      } else {
        text.textContent = node.label;
      }
      
      group.appendChild(text);
      svg.appendChild(group);
    });

  }, [network, topFactors, allProbabilities, diseaseProb]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-soft animate-pulse">
        <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-[600px] bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-soft">
      <h3 className="text-lg font-semibold text-foreground mb-4">Bayesian Network Structure</h3>
      
      <div className="flex justify-center overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox="0 0 700 650"
          className="w-full max-w-[700px] h-auto"
          style={{ minHeight: "500px" }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t border-border">
        {Object.entries(TIER_LABELS).map(([tier, label]) => (
          <div key={tier} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: TIER_COLORS[parseInt(tier)] }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-warning bg-warning/20" />
          <span className="text-xs text-muted-foreground">Highlighted Factor</span>
        </div>
      </div>
    </div>
  );
}
