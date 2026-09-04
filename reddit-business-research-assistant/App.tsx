
import React, { useState, useEffect } from 'react';
import {
  analyzeMarketTopic,
  analyzeMarketTopicStream,
  generateMarketingAssets,
} from './services/geminiService';
import { RedditAnalysis, AnalysisRecord, MarketingAssets } from './types';
import InsightCard from './components/InsightCard';
import {
  Search,
  Globe,
  TrendingUp,
  ShieldAlert,
  Frown,
  Lightbulb,
  FileText,
  BarChart3,
  Rocket,
  Swords,
  ChevronRight,
  Activity,
  ExternalLink,
  Link as LinkIcon,
  Megaphone,
  Copy,
  Check,
  Plus,
  X,
  Sparkles,
  Target,
  Mail,
  PenLine,
  Quote,
  Columns3,
} from 'lucide-react';

const COUNTRIES = [
  'Global', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Japan', 'Brazil', 'China', 'Singapore', 'UAE', 'Mexico', 'Italy'
];

const EMPTY_ANALYSIS: RedditAnalysis = {
  painPoints: [],
  objections: [],
  desiredFeatures: [],
  buyingSignals: [],
  summary: '',
  marketValue: '',
  opportunityValue: '',
  competitionLevel: '',
  sources: [],
};

const analysisHasContent = (a: RedditAnalysis | null): boolean =>
  !!a && !!(
    a.summary ||
    a.marketValue ||
    a.opportunityValue ||
    a.competitionLevel ||
    a.painPoints.length ||
    a.objections.length ||
    a.desiredFeatures.length ||
    a.buyingSignals.length
  );

/* -------------------------------------------------------------------------- */
/*  Text formatting helpers                                                    */
/* -------------------------------------------------------------------------- */

// Strip markdown noise the model sometimes emits despite instructions.
export const cleanText = (raw: string): string =>
  (raw || '')
    .replace(/```[\s\S]*?```/g, '')       // code fences
    .replace(/^#{1,6}\s*/gm, '')           // heading markers
    .replace(/^\s*[-*•]\s+/gm, '')         // stray bullet markers
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/(?<!\w)[_*](?=\S)(.+?)(?<=\S)[_*](?!\w)/g, '$1') // italics
    .replace(/[*#`]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Split cleaned text into readable paragraphs.
export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const clean = cleanText(text);
  if (!clean) return null;

  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  return (
    <>
      {paragraphs.map((para, i) => (
        <span key={i} className="block mb-4 last:mb-0">
          {para.split('\n').map((ln, j) => (
            <React.Fragment key={j}>
              {j > 0 && <br />}
              {ln.trim()}
            </React.Fragment>
          ))}
        </span>
      ))}
    </>
  );
};

// The three headline cards: pull "Value:/Opportunity:/Level:" into a lead line.
const LEAD_LABEL = /^(Value|Opportunity|Level)\s*:\s*(.+)$/i;

// First meaningful line of a section, with any "Value:/Opportunity:/Level:" prefix removed.
export const leadLine = (text: string): string => {
  const clean = cleanText(text);
  const first = clean.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
  const m = first.match(LEAD_LABEL);
  return (m ? m[2] : first).trim();
};

export const MetricBlock: React.FC<{ text: string }> = ({ text }) => {
  const clean = cleanText(text);
  if (!clean) return <span className="text-zinc-300 text-sm">Analyzing...</span>;

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  let lead = '';
  let body = lines;

  const m = lines[0]?.match(LEAD_LABEL);
  if (m) {
    lead = m[2].trim();
    body = lines.slice(1);
  }

  return (
    <div>
      {lead && (
        <p className="text-[15px] md:text-base font-bold text-black leading-snug mb-4">
          {lead}
        </p>
      )}
      <div className="text-[13.5px] leading-6 text-zinc-600">
        <FormattedText text={body.join('\n')} />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Copy button                                                                */
/* -------------------------------------------------------------------------- */

const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className }) => {
  const [copied, setCopied] = useState(false);
  const showLabel = label !== '';
  const restLabel = label === undefined ? 'Copy' : label;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        'inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-black transition-colors'
      }
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {showLabel && <span>{copied ? 'Copied' : restLabel}</span>}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/*  Marketing Arsenal                                                          */
/* -------------------------------------------------------------------------- */

const assetsToText = (a: MarketingAssets, topic: string): string => {
  const out: string[] = [`MARKETING ARSENAL — ${topic.toUpperCase()}`, ''];
  out.push('POSITIONING', a.positioning, '');
  out.push('AD HOOKS', ...a.adHooks.map(h => `- ${h}`), '');
  out.push('OBJECTION REBUTTALS');
  a.objectionRebuttals.forEach(o => {
    out.push(`Objection: ${o.objection}`, `Rebuttal: ${o.rebuttal}`, '');
  });
  out.push('LANDING PAGE ANGLES');
  a.landingPage.forEach(l => out.push(l.headline, l.subhead, ''));
  out.push('COLD OPENERS', ...a.coldOpeners.map(c => `- ${c}`), '');
  out.push('CONTENT IDEAS', ...a.contentIdeas.map(c => `- ${c}`));
  return out.join('\n');
};

const AssetGroup: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div>
    <div className="flex items-center gap-2.5 mb-5">
      <span className="text-zinc-400">{icon}</span>
      <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">{title}</h4>
    </div>
    {children}
  </div>
);

const MarketingArsenal: React.FC<{
  topic: string;
  assets: MarketingAssets | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
}> = ({ topic, assets, loading, error, onRegenerate }) => {
  return (
    <div className="bg-white border-2 border-black rounded-[2.5rem] p-10 md:p-14">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <Megaphone className="w-6 h-6 text-black" />
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Marketing Arsenal</h3>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 mt-1">Assets built from the research above</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {assets && !loading && (
            <>
              <CopyButton text={assetsToText(assets, topic)} label="Copy all" />
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-black transition-colors"
              >
                <Sparkles size={13} /> Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-10">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black" />
          </span>
          <span className="text-[12px] font-black uppercase tracking-[0.3em] text-zinc-500">
            Writing campaign assets from the findings...
          </span>
        </div>
      )}

      {!loading && error && (
        <div className="py-8">
          <p className="text-sm font-semibold text-black mb-4 break-words">{error}</p>
          <button
            type="button"
            onClick={onRegenerate}
            className="px-6 py-3 bg-black text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-xl hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && assets && (
        <div className="space-y-12">
          {assets.positioning && (
            <AssetGroup icon={<Target size={15} />} title="Positioning Statement">
              <div className="bg-black text-white rounded-2xl p-8 flex items-start justify-between gap-6">
                <p className="text-lg md:text-xl font-medium leading-relaxed text-zinc-100">{assets.positioning}</p>
                <CopyButton
                  text={assets.positioning}
                  className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 hover:text-white transition-colors"
                />
              </div>
            </AssetGroup>
          )}

          {assets.adHooks.length > 0 && (
            <AssetGroup icon={<Sparkles size={15} />} title="Ad Hooks">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assets.adHooks.map((hook, i) => (
                  <div key={i} className="group flex items-start justify-between gap-4 p-5 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-black transition-colors">
                    <p className="text-[15px] font-semibold leading-snug text-black">{hook}</p>
                    <CopyButton text={hook} label="" className="shrink-0 mt-0.5 text-zinc-300 group-hover:text-black transition-colors" />
                  </div>
                ))}
              </div>
            </AssetGroup>
          )}

          {assets.objectionRebuttals.length > 0 && (
            <AssetGroup icon={<ShieldAlert size={15} />} title="Objection Rebuttals">
              <ul className="space-y-5">
                {assets.objectionRebuttals.map((o, i) => (
                  <li key={i} className="p-6 rounded-2xl border border-zinc-100 bg-white">
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-400 mb-2">Objection</p>
                    <p className="text-[15px] font-semibold text-zinc-500 mb-4 leading-snug">{o.objection}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-400 mb-2">Rebuttal</p>
                    <p className="text-[15px] text-black leading-relaxed">{o.rebuttal}</p>
                  </li>
                ))}
              </ul>
            </AssetGroup>
          )}

          {assets.landingPage.length > 0 && (
            <AssetGroup icon={<PenLine size={15} />} title="Landing Page Angles">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assets.landingPage.map((l, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex flex-col">
                    <p className="text-lg font-black tracking-tight leading-tight text-black mb-3">{l.headline}</p>
                    <p className="text-[13.5px] text-zinc-600 leading-6 flex-grow">{l.subhead}</p>
                    <CopyButton text={`${l.headline}\n${l.subhead}`} className="mt-4 self-start inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-black transition-colors" />
                  </div>
                ))}
              </div>
            </AssetGroup>
          )}

          {assets.coldOpeners.length > 0 && (
            <AssetGroup icon={<Mail size={15} />} title="Cold Openers">
              <ul className="space-y-3">
                {assets.coldOpeners.map((c, i) => (
                  <li key={i} className="group flex items-start justify-between gap-4 p-5 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-start gap-3">
                      <Quote size={15} className="text-zinc-300 shrink-0 mt-1" />
                      <p className="text-[15px] text-black leading-relaxed">{c}</p>
                    </div>
                    <CopyButton text={c} label="" className="shrink-0 mt-1 text-zinc-300 group-hover:text-black transition-colors" />
                  </li>
                ))}
              </ul>
            </AssetGroup>
          )}

          {assets.contentIdeas.length > 0 && (
            <AssetGroup icon={<PenLine size={15} />} title="Content & SEO Ideas">
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                {assets.contentIdeas.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 mt-[9px] shrink-0" />
                    <p className="text-[15px] text-zinc-700 leading-7">{c}</p>
                  </li>
                ))}
              </ul>
            </AssetGroup>
          )}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Compare table                                                              */
/* -------------------------------------------------------------------------- */

const CompareTable: React.FC<{ results: { topic: string; data: RedditAnalysis }[] }> = ({ results }) => {
  const rows: { label: string; get: (a: RedditAnalysis) => string }[] = [
    { label: 'Market valuation', get: a => leadLine(a.marketValue) || '—' },
    { label: 'Growth potential', get: a => leadLine(a.opportunityValue) || '—' },
    { label: 'Competition', get: a => leadLine(a.competitionLevel) || '—' },
    { label: 'Pain points found', get: a => String(a.painPoints.length) },
    { label: 'Objections found', get: a => String(a.objections.length) },
    { label: 'Buying signals found', get: a => String(a.buyingSignals.length) },
    { label: 'Top pain point', get: a => a.painPoints[0] || '—' },
    { label: 'Top buying signal', get: a => a.buyingSignals[0] || '—' },
  ];

  const colWidth = results.length === 2 ? 'w-[38%]' : 'w-[28%]';

  return (
    <div className="overflow-x-auto rounded-[2rem] border border-zinc-200">
      <table className="w-full border-collapse min-w-[680px]">
        <thead>
          <tr className="bg-black text-white">
            <th className="text-left p-5 text-[10px] font-black uppercase tracking-[0.2em] w-[24%]">Metric</th>
            {results.map((r, i) => (
              <th key={i} className={`text-left p-5 text-sm font-black uppercase tracking-tight ${colWidth}`}>{r.topic}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 ? 'bg-zinc-50' : 'bg-white'}>
              <td className="p-5 align-top text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 border-t border-zinc-100">
                {row.label}
              </td>
              {results.map((r, ci) => (
                <td key={ci} className="p-5 align-top text-[13.5px] leading-6 text-zinc-800 border-t border-zinc-100">
                  {row.get(r.data)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  App                                                                        */
/* -------------------------------------------------------------------------- */

const App: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'compare'>('single');

  // Single research
  const [topic, setTopic] = useState('');
  const [country, setCountry] = useState('Global');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<RedditAnalysis | null>(null);
  const [reportTopic, setReportTopic] = useState('');
  const [reportCountry, setReportCountry] = useState('Global');
  const [currentRecId, setCurrentRecId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Marketing assets
  const [assets, setAssets] = useState<MarketingAssets | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // Compare
  const [compareTopics, setCompareTopics] = useState<string[]>(['', '']);
  const [compareResults, setCompareResults] = useState<{ topic: string; data: RedditAnalysis }[] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const [history, setHistory] = useState<AnalysisRecord[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('market_research_v5');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('market_research_v5', JSON.stringify(history));
  }, [history]);

  /* ---- Marketing assets ------------------------------------------------- */

  const runAssets = async (t: string, c: string, analysis: RedditAnalysis, recId?: string | null) => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const a = await generateMarketingAssets(t, c, analysis);
      setAssets(a);
      if (recId) {
        setHistory(prev => prev.map(r => (r.id === recId ? { ...r, assets: a } : r)));
      }
    } catch (err: any) {
      setAssetsError(err?.message || 'Could not generate marketing assets.');
    } finally {
      setAssetsLoading(false);
    }
  };

  const regenerateAssets = () => {
    if (!currentAnalysis || !reportTopic) return;
    runAssets(reportTopic, reportCountry, currentAnalysis, currentRecId);
  };

  /* ---- Single research (streaming) ------------------------------------- */

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t || isAnalyzing) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    setCurrentAnalysis(EMPTY_ANALYSIS);
    setAssets(null);
    setAssetsError(null);
    setAssetsLoading(false);
    setStreamingText('');
    setCompareResults(null);
    setReportTopic(t);
    setReportCountry(country);
    setCurrentRecId(null);

    try {
      const result = await analyzeMarketTopicStream(t, country, (partial, raw) => {
        setCurrentAnalysis(partial);
        setStreamingText(raw);
      });

      setCurrentAnalysis(result);
      setIsAnalyzing(false);

      const recId = Date.now().toString();
      setCurrentRecId(recId);
      const rec: AnalysisRecord = { id: recId, topic: t, country, timestamp: Date.now(), data: result };
      setHistory(prev => [rec, ...prev].slice(0, 15));

      runAssets(t, country, result, recId);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Analysis failed. Please try again.');
      setIsAnalyzing(false);
      setCurrentAnalysis(null);
    }
  };

  /* ---- Compare -------------------------------------------------------- */

  const setCompareTopic = (idx: number, val: string) => {
    setCompareTopics(prev => prev.map((t, i) => (i === idx ? val : t)));
  };

  const addCompareTopic = () => {
    setCompareTopics(prev => (prev.length >= 3 ? prev : [...prev, '']));
  };

  const removeCompareTopic = (idx: number) => {
    setCompareTopics(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (compareLoading) return;

    const topics: string[] = Array.from(
      new Set(compareTopics.map(t => t.trim()).filter((t): t is string => t.length > 0))
    );
    if (topics.length < 2) {
      setErrorMsg('Enter at least two different topics to compare.');
      return;
    }

    setCompareLoading(true);
    setCompareResults(null);
    setErrorMsg(null);
    setCurrentAnalysis(null);
    setAssets(null);
    setAssetsError(null);

    try {
      const results = await Promise.all(
        topics.map(async (t) => ({ topic: t, data: await analyzeMarketTopic(t, country) }))
      );
      setCompareResults(results);

      const now = Date.now();
      setHistory(prev => [
        ...results.map((r, i) => ({
          id: `${now}-${i}`,
          topic: r.topic,
          country,
          timestamp: now,
          data: r.data,
        })),
        ...prev,
      ].slice(0, 15));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Comparison failed. Please try again.');
    } finally {
      setCompareLoading(false);
    }
  };

  /* ---- History ------------------------------------------------------- */

  const recall = (record: AnalysisRecord) => {
    setMode('single');
    setTopic(record.topic);
    setCountry(record.country);
    setReportTopic(record.topic);
    setReportCountry(record.country);
    setCurrentAnalysis(record.data);
    setCurrentRecId(record.id);
    setAssets(record.assets || null);
    setAssetsError(null);
    setAssetsLoading(false);
    setCompareResults(null);
    setStreamingText('');
    setErrorMsg(null);
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  /* ---- Derived ------------------------------------------------------- */

  const showReport = mode === 'single' && currentAnalysis && (isAnalyzing || analysisHasContent(currentAnalysis));
  const showCompare = mode === 'compare' && (compareLoading || compareResults);
  const busy = isAnalyzing || compareLoading;
  const streamingHeadStart = isAnalyzing && !analysisHasContent(currentAnalysis);

  return (
    <div className="min-h-screen bg-white text-black selection:bg-zinc-100 font-['Inter']">
      <header className="border-b border-zinc-100 py-5 px-6 sticky top-0 bg-white/80 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 overflow-hidden rounded-lg shadow-sm border border-zinc-100">
              <img
                src="https://i.ibb.co/67sBsgTs/Bunny-market-research.png"
                alt="Bunny's MarketMind AI Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">Bunny's MarketMind <span className="text-zinc-400">AI</span></h1>
          </div>
          <button onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })} className="text-[11px] font-black uppercase tracking-widest hover:text-zinc-500">Archive</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        <div id="report-capture">
          <section className="text-center mb-24 max-w-4xl mx-auto">
            <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter leading-[0.95] text-black uppercase">
              Strategic Research <br /><span className="text-zinc-300">On-Demand.</span>
            </h2>

            {/* Mode toggle */}
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-full mt-6 mb-2">
              <button
                type="button"
                onClick={() => setMode('single')}
                disabled={busy}
                className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-50 ${mode === 'single' ? 'bg-black text-white' : 'text-zinc-500 hover:text-black'}`}
              >
                <Search size={13} className="inline mr-2 -mt-0.5" />Single
              </button>
              <button
                type="button"
                onClick={() => setMode('compare')}
                disabled={busy}
                className={`px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.15em] transition-colors disabled:opacity-50 ${mode === 'compare' ? 'bg-black text-white' : 'text-zinc-500 hover:text-black'}`}
              >
                <Columns3 size={13} className="inline mr-2 -mt-0.5" />Compare
              </button>
            </div>

            {mode === 'single' ? (
              <form onSubmit={handleSearch} className="mt-8">
                <div className="flex flex-col md:flex-row gap-0 bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-200 focus-within:border-black transition-all shadow-xl">
                  <div className="flex-grow flex items-center px-6 py-5">
                    <Search className="w-5 h-5 text-zinc-400 mr-4" />
                    <input
                      type="text"
                      placeholder="Analyze a product, niche, or competitor..."
                      className="bg-transparent border-none outline-none w-full text-lg font-semibold text-black"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={isAnalyzing}
                    />
                  </div>
                  <div className="flex items-center px-6 py-5 border-l border-zinc-200 bg-white">
                    <Globe className="w-4 h-4 text-zinc-400 mr-3" />
                    <select
                      className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-black"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={isAnalyzing}
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isAnalyzing || !topic.trim()}
                    className="px-12 py-5 font-black text-sm uppercase tracking-[0.2em] bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-200 min-w-[180px] flex items-center justify-center"
                  >
                    {isAnalyzing ? <Activity className="w-5 h-5 animate-pulse" /> : <span>Execute</span>}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompare} className="mt-8 max-w-3xl mx-auto">
                <div className="bg-zinc-50 rounded-2xl border border-zinc-200 shadow-xl p-4 md:p-5 space-y-3">
                  {compareTopics.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-xl border border-zinc-200 focus-within:border-black transition-colors px-4">
                      <span className="text-[11px] font-black text-zinc-300">{String.fromCharCode(65 + idx)}</span>
                      <input
                        type="text"
                        placeholder={idx === 0 ? 'First product / niche / competitor...' : 'Compare against...'}
                        className="bg-transparent border-none outline-none w-full text-base font-semibold text-black py-4"
                        value={val}
                        onChange={(e) => setCompareTopic(idx, e.target.value)}
                        disabled={compareLoading}
                      />
                      {compareTopics.length > 2 && (
                        <button type="button" onClick={() => removeCompareTopic(idx)} disabled={compareLoading} className="text-zinc-300 hover:text-black shrink-0">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    {compareTopics.length < 3 && (
                      <button
                        type="button"
                        onClick={addCompareTopic}
                        disabled={compareLoading}
                        className="inline-flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-zinc-500 hover:text-black transition-colors px-4 py-3"
                      >
                        <Plus size={14} /> Add topic
                      </button>
                    )}
                    <div className="flex items-center px-4 py-3 border border-zinc-200 rounded-xl bg-white sm:ml-auto">
                      <Globe className="w-4 h-4 text-zinc-400 mr-3" />
                      <select
                        className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-black"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        disabled={compareLoading}
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={compareLoading || compareTopics.filter(t => t.trim()).length < 2}
                      className="px-10 py-4 font-black text-sm uppercase tracking-[0.2em] bg-black text-white rounded-xl hover:bg-zinc-800 disabled:bg-zinc-200 flex items-center justify-center min-w-[160px]"
                    >
                      {compareLoading ? <Activity className="w-5 h-5 animate-pulse" /> : <span>Compare</span>}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          {errorMsg && !busy && (
            <div className="max-w-3xl mx-auto mb-16 border-2 border-black rounded-2xl p-6 bg-zinc-50">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">Request Failed</p>
              <p className="text-sm font-semibold text-black break-words">{errorMsg}</p>
            </div>
          )}

          {/* -------- Compare results -------- */}
          {showCompare && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">Side-by-Side</p>
                <h3 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">
                  {compareResults ? compareResults.map(r => r.topic).join('  vs  ') : 'Comparing markets...'}
                </h3>
              </div>

              {compareLoading && (
                <div className="flex items-center justify-center gap-3 py-16">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black" />
                  </span>
                  <span className="text-[12px] font-black uppercase tracking-[0.3em] text-zinc-500">
                    Researching {compareTopics.filter(t => t.trim()).length} markets in parallel...
                  </span>
                </div>
              )}

              {compareResults && (
                <>
                  <CompareTable results={compareResults} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {compareResults.map((r, i) => (
                      <div key={i} className="p-7 rounded-3xl border border-zinc-100 bg-white shadow-sm">
                        <h4 className="text-lg font-black uppercase tracking-tighter mb-3">{r.topic}</h4>
                        <p className="text-[13.5px] leading-6 text-zinc-600 line-clamp-6">
                          {leadLine(r.data.summary) || 'No summary available.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* -------- Single report -------- */}
          {showReport && currentAnalysis && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {isAnalyzing && (
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-40" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-black" />
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500">
                      Streaming live research{streamingText ? ` · ${streamingText.length.toLocaleString()} chars` : ''}
                    </span>
                  </div>
                  {streamingHeadStart && streamingText && (
                    <div className="text-[11px] leading-5 text-zinc-400 whitespace-pre-wrap break-words max-h-40 overflow-hidden font-mono border border-zinc-100 rounded-xl p-4 bg-zinc-50">
                      {streamingText.slice(-600)}
                    </div>
                  )}
                </div>
              )}

              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">Research Topic</p>
                <h3 className="text-4xl font-black tracking-tighter uppercase">{reportTopic}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <BarChart3 className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Market Valuation</span>
                  <MetricBlock text={currentAnalysis.marketValue} />
                </div>
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <Rocket className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Growth Potential</span>
                  <MetricBlock text={currentAnalysis.opportunityValue} />
                </div>
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <Swords className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">Competition</span>
                  <MetricBlock text={currentAnalysis.competitionLevel} />
                </div>
              </div>

              {(currentAnalysis.summary || isAnalyzing) && (
                <div className="w-full bg-black text-white rounded-[2.5rem] p-12 md:p-16">
                  <div className="max-w-4xl mx-auto">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6">Analysis Summary</p>
                    <div className="text-lg md:text-xl font-medium leading-relaxed text-zinc-200">
                      {currentAnalysis.summary
                        ? <FormattedText text={currentAnalysis.summary} />
                        : <span className="text-zinc-500">Synthesizing strategic takeaways...</span>}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InsightCard title="PAIN POINTS" items={currentAnalysis.painPoints} icon={<Frown />} />
                <InsightCard title="OBJECTIONS" items={currentAnalysis.objections} icon={<ShieldAlert />} />
                <InsightCard title="DESIRED FEATURES" items={currentAnalysis.desiredFeatures} icon={<Lightbulb />} />
                <InsightCard title="BUYING SIGNALS" items={currentAnalysis.buyingSignals} icon={<TrendingUp />} />
              </div>

              {/* Marketing Arsenal */}
              {(assets || assetsLoading || assetsError) && (
                <MarketingArsenal
                  topic={reportTopic}
                  assets={assets}
                  loading={assetsLoading}
                  error={assetsError}
                  onRegenerate={regenerateAssets}
                />
              )}

              {/* Bunny's Source Section */}
              <div className="bg-zinc-50 rounded-[2.5rem] p-12 md:p-16 border border-zinc-100">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-4 mb-8">
                    <LinkIcon className="w-6 h-6 text-black" />
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Bunny's Source</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentAnalysis.sources && currentAnalysis.sources.length > 0 ? (
                      currentAnalysis.sources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-zinc-200 hover:border-black transition-all group shadow-sm"
                        >
                          <span className="text-xs font-bold text-zinc-600 line-clamp-1 group-hover:text-black uppercase tracking-wide">
                            {source.title}
                          </span>
                          <ExternalLink size={14} className="text-zinc-300 group-hover:text-black shrink-0 ml-4" />
                        </a>
                      ))
                    ) : (
                      <p className="text-zinc-400 text-sm font-medium">
                        {isAnalyzing ? 'Collecting web grounding sources...' : 'Verified web grounding sources automatically synthesized.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-12 py-12">
                <div className="w-full border-t border-zinc-100 pt-12 text-center">
                  <p className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-400 mb-1">Strategic Engineering</p>
                  <p className="text-lg font-black tracking-tighter uppercase">Rabbit Marketing House</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <section id="history" className="mt-40 pt-20 border-t-2 border-black no-print">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-px w-6 bg-black"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Knowledge Archive</span>
              </div>
              <h3 className="text-4xl font-black tracking-tighter uppercase">Recent Analysis</h3>
            </div>
          </div>

          {history.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {history.map(record => (
                <div
                  key={record.id}
                  onClick={() => recall(record)}
                  className="p-8 bg-white border border-zinc-100 rounded-[2rem] cursor-pointer hover:border-black transition-all group flex flex-col h-full hover:shadow-2xl"
                >
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest py-1 px-2 bg-zinc-50 rounded-md">{record.country}</span>
                    <div className="flex items-center gap-2">
                      {record.assets && <Megaphone className="w-4 h-4 text-zinc-300 group-hover:text-black" />}
                      <FileText className="w-5 h-5 text-zinc-200 group-hover:text-black" />
                    </div>
                  </div>
                  <h4 className="font-black text-2xl mb-2 line-clamp-1 uppercase tracking-tighter">{record.topic}</h4>
                  <p className="text-[10px] font-bold text-zinc-400 mb-8 uppercase tracking-widest">{new Date(record.timestamp).toLocaleDateString()}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-black">Recall Insights</span>
                    <ChevronRight size={16} className="transform group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 bg-zinc-50 rounded-[3rem] text-center border-2 border-dashed border-zinc-200">
              <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-6 opacity-30" />
              <p className="text-lg font-bold text-zinc-400 uppercase tracking-widest">No previous analysis</p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-zinc-100 py-20 px-6 mt-40 no-print bg-zinc-50/50 text-center">
        <p className="text-[11px] font-black tracking-[0.2em] mb-3 uppercase text-zinc-400">Strategic Engineering</p>
        <a href="https://rabbitmarketinghouse.in" target="_blank" rel="noopener noreferrer" className="text-xl font-black tracking-tighter border-b-2 border-black pb-1 uppercase">Rabbit Marketing House</a>
      </footer>
    </div>
  );
};

export default App;
