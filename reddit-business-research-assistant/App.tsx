
import React, { useState, useEffect, useRef } from 'react';
import { analyzeMarketTopic } from './services/geminiService';
import { RedditAnalysis, AnalysisRecord } from './types';
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
  Link as LinkIcon
} from 'lucide-react';

const COUNTRIES = [
  'Global', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'India', 'Japan', 'Brazil', 'China', 'Singapore', 'UAE', 'Mexico', 'Italy'
];

const LOADING_STEPS = [
  "Initializing deep search nodes...",
  "Scraping Reddit community discussions...",
  "Filtering verified user reviews...",
  "Extracting buyer pain points...",
  "Synthesizing market opportunity data...",
  "Mapping competitor landscape...",
  "Finalizing strategic brief..."
];

export const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;
  
  // Remove markdown symbols but allow internal logic to bold specific labels like "Value:", "Opportunity:", "Level:"
  const cleanText = text.replace(/[*#_]+/g, '').trim();
  
  // Split by line to handle bolding specific labels for the "End Card" feel
  const lines = cleanText.split('\n');
  
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/^(Value:|Opportunity:|Level:)/i);
        if (parts.length > 1) {
          return (
            <div key={i}>
              <span className="font-black text-black">{parts[1]}</span>
              {parts[2]}
            </div>
          );
        }
        return <div key={i}>{line}</div>;
      })}
    </>
  );
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [country, setCountry] = useState('Global');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<RedditAnalysis | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('market_research_v5');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('market_research_v5', JSON.stringify(history));
  }, [history]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsAnalyzing(true);
    setCurrentAnalysis(null);
    setProgress(0);
    setLoadingStep(0);

    progressTimer.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return prev;
        const inc = prev < 60 ? 1.5 : 0.4;
        return Math.min(prev + inc, 99);
      });
      setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + (Math.random() > 0.88 ? 1 : 0) : prev));
    }, 200);

    try {
      const result = await analyzeMarketTopic(topic, country);
      if (progressTimer.current) clearInterval(progressTimer.current);
      setProgress(100);
      
      setTimeout(() => {
        setCurrentAnalysis(result);
        const newRecord: AnalysisRecord = {
          id: Date.now().toString(),
          topic,
          country,
          timestamp: Date.now(),
          data: result
        };
        setHistory(prev => [newRecord, ...prev].slice(0, 15));
        setIsAnalyzing(false);
      }, 500);

    } catch (err: any) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      setIsAnalyzing(false);
    }
  };

  const radius = 54;
  const circumference = 2 * Math.PI * radius;

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
              Strategic Research <br/><span className="text-zinc-300">On-Demand.</span>
            </h2>
            
            <form onSubmit={handleSearch} className="mt-12">
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
                  disabled={isAnalyzing || !topic}
                  className="px-12 py-5 font-black text-sm uppercase tracking-[0.2em] bg-black text-white hover:bg-zinc-800 disabled:bg-zinc-200 min-w-[180px]"
                >
                  {isAnalyzing ? <Activity className="w-5 h-5 animate-pulse" /> : <span>Execute</span>}
                </button>
              </div>
            </form>
          </section>

          {currentAnalysis ? (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">RESEARCH TOPIC</p>
                <h3 className="text-4xl font-black tracking-tighter uppercase">{topic}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <BarChart3 className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">MARKET VALUATION</span>
                  <div className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                    <FormattedText text={currentAnalysis.marketValue} />
                  </div>
                </div>
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <Rocket className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">GROWTH POTENTIAL</span>
                  <div className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                    <FormattedText text={currentAnalysis.opportunityValue} />
                  </div>
                </div>
                <div className="bg-white border border-zinc-100 p-8 rounded-3xl flex flex-col items-start text-left shadow-sm">
                  <Swords className="w-5 h-5 mb-6 text-zinc-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4">COMPETITION</span>
                  <div className="text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
                    <FormattedText text={currentAnalysis.competitionLevel} />
                  </div>
                </div>
              </div>

              <div className="w-full bg-black text-white rounded-[2.5rem] p-12 md:p-16">
                <div className="max-w-4xl mx-auto">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6">ANALYSIS SUMMARY</p>
                  <p className="text-xl md:text-2xl font-medium leading-relaxed text-zinc-200">
                    <FormattedText text={currentAnalysis.summary} />
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InsightCard title="PAIN POINTS" items={currentAnalysis.painPoints} icon={<Frown />} />
                <InsightCard title="OBJECTIONS" items={currentAnalysis.objections} icon={<ShieldAlert />} />
                <InsightCard title="DESIRED FEATURES" items={currentAnalysis.desiredFeatures} icon={<Lightbulb />} />
                <InsightCard title="BUYING SIGNALS" items={currentAnalysis.buyingSignals} icon={<TrendingUp />} />
              </div>

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
                      <p className="text-zinc-400 text-sm font-medium">Verified web grounding sources automatically synthesized.</p>
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
          ) : isAnalyzing && (
            <div className="py-32 text-center flex flex-col items-center">
              <div className="relative mb-14 flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90 scale-110">
                    <circle cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="1.5" fill="transparent" className="text-zinc-50" />
                    <circle 
                      cx="80" cy="80" r={radius} stroke="currentColor" strokeWidth="2.5" fill="transparent" 
                      strokeDasharray={circumference} 
                      strokeDashoffset={circumference - (circumference * progress) / 100} 
                      className="text-black transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center translate-y-[2px]">
                    <span className="text-4xl font-black tracking-tighter text-center">{Math.floor(progress)}%</span>
                  </div>
                </div>
              </div>
              <h3 className="text-4xl font-black mb-3 tracking-tighter uppercase">Analyzing Global Data...</h3>
              <div className="h-8 flex items-center justify-center mb-8">
                <p className="text-zinc-500 font-bold text-[12px] uppercase tracking-[0.35em]">{LOADING_STEPS[loadingStep]}</p>
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
                  onClick={() => { setTopic(record.topic); setCountry(record.country); setCurrentAnalysis(record.data); window.scrollTo({ top: 100, behavior: 'smooth' }); }}
                  className="p-8 bg-white border border-zinc-100 rounded-[2rem] cursor-pointer hover:border-black transition-all group flex flex-col h-full hover:shadow-2xl"
                >
                  <div className="flex justify-between items-start mb-8">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest py-1 px-2 bg-zinc-50 rounded-md">{record.country}</span>
                    <FileText className="w-5 h-5 text-zinc-200 group-hover:text-black" />
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
