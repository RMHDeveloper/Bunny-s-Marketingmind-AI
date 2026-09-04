
import { GoogleGenAI } from "@google/genai";
import { RedditAnalysis, GroundingSource } from "../types";

export const analyzeMarketTopic = async (topic: string, country: string): Promise<RedditAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Role: You are a Strategic Research AI for the Rabbit Marketing House app. 
    Conduct deep market research on the following topic/product in ${country}.
    TOPIC: ${topic}

    Formatting Constraints (STRICT):
    1. NO MARKDOWN: Never use double asterisks (**), hashtags (#), or underscores (_). 
    2. PLAIN TEXT ONLY: Return all labels and content as plain text only. Do not bold text.
    3. SEPARATION: Use a simple line of dashes (---) to separate sections.

    Output Content Depth:
    - Provide an exhaustive and comprehensive list for every section. 
    - The number of points should depend entirely on the complexity of the topic; do not cap or limit the findings. 
    - Ensure every significant pain point, objection, and signal found in the data is listed.

    Structure your response EXACTLY like this:
    
    MARKET VALUATION
    Value: [Amount/Size]
    [Detailed exhaustive context and data points about the market size]
    ---
    GROWTH POTENTIAL
    Opportunity: [High/Medium/Low]
    [Detailed exhaustive context and explanation for this rating]
    ---
    COMPETITION
    Level: [High/Medium/Low]
    [Detailed exhaustive analysis of the competitive landscape]
    ---
    ANALYSIS SUMMARY
    [Detailed summary paragraph covering all key strategic takeaways]
    ---
    PAIN POINTS
    - [Point]
    - [Point]
    ---
    OBJECTIONS
    - [Point]
    - [Point]
    ---
    DESIRED FEATURES
    - [Point]
    - [Point]
    ---
    BUYING SIGNALS
    - [Point]
    - [Point]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || "";
  
  const sources: GroundingSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  chunks.forEach((chunk: any) => {
    if (chunk.web?.uri) {
      sources.push({
        title: chunk.web.title || "Research Source",
        uri: chunk.web.uri
      });
    }
  });

  const findSection = (keyword: string) => {
    const lines = text.split('\n');
    let content: string[] = [];
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toUpperCase().trim() === keyword.toUpperCase()) {
        found = true;
        continue;
      }
      if (found) {
        if (lines[i].includes('---') || (i < lines.length - 1 && lines[i+1].includes('---'))) {
          if (!lines[i].includes('---')) content.push(lines[i].trim());
          break;
        }
        // If we hit another known section header, stop
        const headers = ["MARKET VALUATION", "GROWTH POTENTIAL", "COMPETITION", "ANALYSIS SUMMARY", "PAIN POINTS", "OBJECTIONS", "DESIRED FEATURES", "BUYING SIGNALS"];
        if (headers.includes(lines[i].toUpperCase().trim())) break;
        
        content.push(lines[i].trim());
      }
    }
    return content.filter(line => line !== "").join('\n').trim();
  };

  const parseList = (sectionText: string) => {
    return sectionText.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.replace(/^-+\s*/, '').replace(/[*#_]+/g, '').trim())
      .filter(Boolean);
  };

  return {
    painPoints: parseList(findSection("PAIN POINTS")),
    objections: parseList(findSection("OBJECTIONS")),
    desiredFeatures: parseList(findSection("DESIRED FEATURES")),
    buyingSignals: parseList(findSection("BUYING SIGNALS")),
    summary: findSection("ANALYSIS SUMMARY").replace(/[*#_]+/g, '').trim() || "No summary provided.",
    marketValue: findSection("MARKET VALUATION").replace(/[*#_]+/g, '').trim() || "N/A",
    opportunityValue: findSection("GROWTH POTENTIAL").replace(/[*#_]+/g, '').trim() || "N/A",
    competitionLevel: findSection("COMPETITION").replace(/[*#_]+/g, '').trim() || "N/A",
    sources: sources.slice(0, 10)
  };
};
