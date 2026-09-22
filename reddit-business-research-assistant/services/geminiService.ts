
import { RedditAnalysis, GroundingSource, MarketingAssets } from "../types";

/* -------------------------------------------------------------------------- */
/*  Client                                                                     */
/* -------------------------------------------------------------------------- */

// The Gemini call and its API key now live server-side, proxied through the
// shared dashboard proxy (see api/proxy.ts) - calling Gemini directly from the
// browser used to ship the API key in the public JS bundle.
const API_ROUTE = "/api/proxy";

/** POST a Gemini REST generateContent body to this app's own /api/proxy route. */
async function callProxy(body: Record<string, unknown>): Promise<any> {
  const response = await fetch(API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini request failed with status ${response.status}: ${errorText}`);
  }
  return response.json();
}

/* -------------------------------------------------------------------------- */
/*  Research prompt + parser                                                   */
/* -------------------------------------------------------------------------- */

const RESEARCH_PROMPT = (topic: string, country: string) => `
    Role: You are a Strategic Research AI for the Rabbit Marketing House app.
    Conduct deep market research on the following topic/product in ${country}.
    TOPIC: ${topic}

    Formatting Constraints (STRICT):
    1. NO MARKDOWN: Never use asterisks (*), hashtags (#), underscores (_), or backticks. Do not bold, italicize, or add heading symbols. Section titles must appear as plain uppercase text on their own line.
    2. SEPARATION: Use a single line containing only three dashes (---) between sections.
    3. READABLE PROSE: For MARKET VALUATION, GROWTH POTENTIAL, COMPETITION and ANALYSIS SUMMARY, write in short, clear paragraphs (2-4 sentences each). Separate paragraphs with a blank line. Lead with the key number or rating, then explain it. Avoid run-on sentences and dense jargon walls.
    4. LISTS: For PAIN POINTS, OBJECTIONS, DESIRED FEATURES and BUYING SIGNALS, use one hyphen (-) per line. Keep each point to a single crisp sentence a busy founder can scan.

    Output Content Depth:
    - Be comprehensive: list every significant pain point, objection, desired feature and buying signal found in the data.
    - Let the number of points follow the complexity of the topic; do not artificially cap the findings.
    - Prefer specific, evidence-backed statements over vague generalities.

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

const HEADERS = [
  "MARKET VALUATION",
  "GROWTH POTENTIAL",
  "COMPETITION",
  "ANALYSIS SUMMARY",
  "PAIN POINTS",
  "OBJECTIONS",
  "DESIRED FEATURES",
  "BUYING SIGNALS",
];

// Normalize a line for header matching: drop markdown decoration + punctuation.
const asHeader = (line: string) =>
  line.replace(/[#*_>`\-:]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

const findSection = (text: string, keyword: string) => {
  const lines = text.split("\n");
  const content: string[] = [];
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (!found) {
      if (asHeader(lines[i]) === keyword.toUpperCase()) found = true;
      continue;
    }
    if (lines[i].trim().replace(/[*_\s]/g, "").startsWith("---")) break;
    if (HEADERS.includes(asHeader(lines[i]))) break;
    content.push(lines[i].trim());
  }
  return content.filter((line) => line !== "").join("\n").trim();
};

const parseList = (sectionText: string) =>
  sectionText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+[.)])\s+/.test(line))
    .map((line) =>
      line
        .replace(/^([-*•]|\d+[.)])\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/[*#_`]+/g, "")
        .trim()
    )
    .filter(Boolean);

/** Parse the (possibly partial) research text into a structured analysis. */
export const parseAnalysis = (text: string, sources: GroundingSource[]): RedditAnalysis => ({
  painPoints: parseList(findSection(text, "PAIN POINTS")),
  objections: parseList(findSection(text, "OBJECTIONS")),
  desiredFeatures: parseList(findSection(text, "DESIRED FEATURES")),
  buyingSignals: parseList(findSection(text, "BUYING SIGNALS")),
  summary: findSection(text, "ANALYSIS SUMMARY").replace(/[*#_]+/g, "").trim() || "",
  marketValue: findSection(text, "MARKET VALUATION").replace(/[*#_]+/g, "").trim() || "",
  opportunityValue: findSection(text, "GROWTH POTENTIAL").replace(/[*#_]+/g, "").trim() || "",
  competitionLevel: findSection(text, "COMPETITION").replace(/[*#_]+/g, "").trim() || "",
  sources: sources.slice(0, 10),
});

/* -------------------------------------------------------------------------- */
/*  Streaming market research                                                  */
/* -------------------------------------------------------------------------- */

export type AnalysisUpdate = (partial: RedditAnalysis, rawText: string) => void;

const extractSources = (chunk: any): GroundingSource[] => {
  const gc = chunk?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return gc
    .filter((c: any) => c?.web?.uri)
    .map((c: any) => ({ title: c.web.title || "Research Source", uri: c.web.uri }));
};

/**
 * Run the market research request. Streaming now happens server-side through
 * the shared dashboard proxy (which returns a single raw JSON response), so
 * this resolves in one shot and fires `onUpdate` once with the final result
 * rather than incrementally.
 */
export const analyzeMarketTopicStream = async (
  topic: string,
  country: string,
  onUpdate?: AnalysisUpdate
): Promise<RedditAnalysis> => {
  let data: any;
  try {
    data = await callProxy({
      contents: [{ role: "user", parts: [{ text: RESEARCH_PROMPT(topic, country) }] }],
      generationConfig: {},
      tools: [{ googleSearch: {} }],
    });
  } catch (err: any) {
    throw new Error(`Gemini request failed: ${err?.message || String(err)}`);
  }

  const fullText: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
  const sources: GroundingSource[] = extractSources(data);

  if (!fullText.trim()) {
    throw new Error("Gemini returned an empty response. Try again or switch the model in .env.local.");
  }

  const final = parseAnalysis(fullText, sources);
  onUpdate?.(final, fullText);
  return final;
};

/** Non-streaming convenience wrapper (used by Compare mode). */
export const analyzeMarketTopic = (topic: string, country: string): Promise<RedditAnalysis> =>
  analyzeMarketTopicStream(topic, country);

/* -------------------------------------------------------------------------- */
/*  Marketing assets                                                           */
/* -------------------------------------------------------------------------- */

const ASSET_SCHEMA = {
  type: "OBJECT",
  properties: {
    positioning: { type: "STRING" },
    adHooks: { type: "ARRAY", items: { type: "STRING" } },
    objectionRebuttals: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          objection: { type: "STRING" },
          rebuttal: { type: "STRING" },
        },
        required: ["objection", "rebuttal"],
      },
    },
    landingPage: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          headline: { type: "STRING" },
          subhead: { type: "STRING" },
        },
        required: ["headline", "subhead"],
      },
    },
    coldOpeners: { type: "ARRAY", items: { type: "STRING" } },
    contentIdeas: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["positioning", "adHooks", "objectionRebuttals", "landingPage", "coldOpeners", "contentIdeas"],
};

const bullets = (arr: string[]) => (arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- (none found)");

/**
 * Turn a completed research analysis into ready-to-use marketing assets.
 * Uses JSON mode (no search tool) for reliable parsing.
 */
export const generateMarketingAssets = async (
  topic: string,
  country: string,
  analysis: RedditAnalysis
): Promise<MarketingAssets> => {
  const context = `TOPIC: ${topic}
MARKET: ${country}

ANALYSIS SUMMARY:
${analysis.summary || "(none)"}

PAIN POINTS:
${bullets(analysis.painPoints)}

OBJECTIONS:
${bullets(analysis.objections)}

DESIRED FEATURES:
${bullets(analysis.desiredFeatures)}

BUYING SIGNALS:
${bullets(analysis.buyingSignals)}`;

  const prompt = `You are a senior direct-response copywriter at Rabbit Marketing House.
Using ONLY the research below, produce ready-to-use marketing assets for "${topic}" in ${country}.

${context}

Rules:
- Ground every asset in the specific pain points, objections and buying signals above. Do not invent product features that contradict the research.
- Plain text only. No markdown, no emojis, no hashtags.
- positioning: one sharp positioning statement (1-2 sentences).
- adHooks: exactly 6 scroll-stopping ad hooks, max ~15 words each.
- objectionRebuttals: cover the 4-5 strongest objections; each rebuttal is 1-2 confident sentences.
- landingPage: exactly 3 headline + subhead pairs, each taking a distinctly different angle.
- coldOpeners: exactly 3 opening lines for a cold email or DM, each referencing a real pain point or buying signal.
- contentIdeas: exactly 6 content or SEO ideas mapped to buyer intent.`;

  let data: any;
  try {
    data = await callProxy({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ASSET_SCHEMA,
        temperature: 0.9,
      },
    });
  } catch (err: any) {
    throw new Error(`Marketing asset generation failed: ${err?.message || String(err)}`);
  }

  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse((text || "{}").trim());
  } catch {
    throw new Error("Could not parse the marketing assets response. Try regenerating.");
  }

  const strArray = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  return {
    positioning: typeof parsed.positioning === "string" ? parsed.positioning.trim() : "",
    adHooks: strArray(parsed.adHooks),
    objectionRebuttals: Array.isArray(parsed.objectionRebuttals)
      ? parsed.objectionRebuttals
          .filter((o: any) => o && (o.objection || o.rebuttal))
          .map((o: any) => ({
            objection: String(o.objection || "").trim(),
            rebuttal: String(o.rebuttal || "").trim(),
          }))
      : [],
    landingPage: Array.isArray(parsed.landingPage)
      ? parsed.landingPage
          .filter((l: any) => l && (l.headline || l.subhead))
          .map((l: any) => ({
            headline: String(l.headline || "").trim(),
            subhead: String(l.subhead || "").trim(),
          }))
      : [],
    coldOpeners: strArray(parsed.coldOpeners),
    contentIdeas: strArray(parsed.contentIdeas),
  };
};
