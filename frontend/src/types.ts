export interface DOKItem {
  index: number;
  content: string;
  children: string[];
}

export interface DOKSection {
  raw: string;
  items: DOKItem[];
}

export interface BrainLiftSections {
  owners: string;
  purpose: string;
  experts: string;
  dok2_knowledge_tree: DOKSection | null;
  dok3_insights: DOKSection | null;
  dok4_spov: DOKSection | null;
}

export interface Connection {
  source_index: number;
  target_index: number;
  type: "supports" | "contradicts";
  score: number;
  reasoning: string;
}

export interface ConnectionAnalysis {
  dok2_to_dok3: Connection[];
  dok3_to_dok4: Connection[];
}

export interface BrainLiftSummary {
  id: string;
  name: string;
  created_at: string;
}

export interface ExtractResponse {
  success: boolean;
  brainlift_id: string | null;
  brainlift_name: string | null;
  sections: BrainLiftSections | null;
  error: string | null;
  raw_markdown: string;
}

export interface SavedBrainLift {
  id: string;
  name: string;
  url: string;
  created_at: string;
  sections: BrainLiftSections;
  connections: ConnectionAnalysis | null;
}

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";
