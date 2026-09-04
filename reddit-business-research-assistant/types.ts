
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

export interface ObjectionRebuttal {
  objection: string;
  rebuttal: string;
}

export interface LandingCopy {
  headline: string;
  subhead: string;
}

export interface MarketingAssets {
  positioning: string;
  adHooks: string[];
  objectionRebuttals: ObjectionRebuttal[];
  landingPage: LandingCopy[];
  coldOpeners: string[];
  contentIdeas: string[];
}

export interface AnalysisRecord {
  id: string;
  topic: string;
  country: string;
  timestamp: number;
  data: RedditAnalysis;
  assets?: MarketingAssets | null;
}
