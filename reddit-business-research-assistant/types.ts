
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface RedditAnalysis {
  painPoints: string[];
  objections: string[];
  desiredFeatures: string[];
  buyingSignals: string[];
  summary: string;
  sources: GroundingSource[];
  marketValue: string;
  opportunityValue: string;
  competitionLevel: string;
}

export interface AnalysisRecord {
  id: string;
  topic: string;
  country: string;
  timestamp: number;
  data: RedditAnalysis;
}
