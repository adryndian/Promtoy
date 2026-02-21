
import React, { useState, useEffect, useCallback } from 'react';
import { GeminiService } from './services/geminiService';
import { AspectRatio, GeneratedPrompt, GenerationHistory } from './types';
import { ASPECT_RATIOS, STYLE_MODES, STORYBOARD_LAYOUTS } from './constants';
import { HistoryList } from './components/HistoryList';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'single' | 'storyboard'>('single');
  const [styleMode, setStyleMode] = useState(STYLE_MODES[0].id);
  const [layout, setLayout] = useState(STORYBOARD_LAYOUTS[0].id); // Default to 2x2
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<GeneratedPrompt | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewTab, setViewTab] = useState<'strategy' | 'json'>('strategy');

  useEffect(() => {
    const saved = localStorage.getItem('reality_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { console.error("History fail"); }
    }
  }, []);

  const saveToHistory = useCallback((item: GenerationHistory) => {
    setHistory(prev => {
      const newHistory = [item, ...prev].slice(0, 50);
      localStorage.setItem('reality_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsGenerating(true);
    setError(null);
    setImageUrl(null);
    setGeneratedPrompt(null);

    try {
      const promptData = await GeminiService.generateRealityPrompt(query, aspectRatio, mode, styleMode, layout);
      setGeneratedPrompt(promptData);

      const image = await GeminiService.generateImage(
        promptData.positive,
        promptData.negative,
        aspectRatio
      );
      setImageUrl(image);

      saveToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userQuery: query,
        generatedPrompt: promptData,
        imageUrl: image,
        aspectRatio: aspectRatio
      });
    } catch (err: any) {
      setError(err.message || "Synthesis failure. Please try a simpler description.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCombinedPrompt = () => {
    if (!generatedPrompt) return;
    const combined = `MASTER PROMPT:\n${generatedPrompt.positive}\n\nNEGATIVE CONSTRAINTS:\n${generatedPrompt.negative}`;
    navigator.clipboard.writeText(combined);
    alert("Full Strategy Copied!");
  };

  const copyJson = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(JSON.stringify(generatedPrompt, null, 2));
    alert("JSON Structure Copied!");
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `reality-grid-${mode}-${Date.now()}.png`;
    link.click();
  };

  const handleEdit = async () => {
    if (!imageUrl || !editPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const editedImage = await GeminiService.editImage(imageUrl, editPrompt);
      setImageUrl(editedImage);
      setEditPrompt('');
    } catch (err: any) {
      setError("Image refinement failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-2xl">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent italic tracking-tighter">Reality-First Flash</h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest opacity-60">High-Control Grid & Single Prompt Engine</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            <button onClick={() => setMode('single')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'single' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Single View</button>
            <button onClick={() => setMode('storyboard')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'storyboard' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Grid (4+ Photos)</button>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-xs flex justify-between items-center animate-in slide-in-from-top duration-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-white">✕</button>
        </div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        <section className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-2xl space-y-6 border-white/5 shadow-2xl">
            <form onSubmit={handleGenerate} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">1. Style Selection</label>
                <select 
                  value={styleMode} 
                  onChange={(e) => setStyleMode(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer hover:bg-white/10"
                >
                  {STYLE_MODES.map(s => <option key={s.id} value={s.id} className="bg-gray-900">{s.label}</option>)}
                </select>
              </div>

              {mode === 'storyboard' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-left duration-300">
                  <label className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">2. Panel Layout (Grid Mode)</label>
                  <select 
                    value={layout} 
                    onChange={(e) => setLayout(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500 transition-all cursor-pointer hover:bg-white/10"
                  >
                    {STORYBOARD_LAYOUTS.map(l => <option key={l.id} value={l.id} className="bg-gray-900">{l.label}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">
                  {mode === 'single' ? '3. Describe Your Vision' : '3. Sequential Concept'}
                </label>
                <textarea
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={mode === 'single' ? "e.g. A futuristic city at night with neon lights..." : "e.g. A set of 4 photos showing a cat waking up..."}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all resize-none min-h-[120px] placeholder:opacity-30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-cyan-500/70 tracking-widest">4. Composition Ratio</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button key={ratio.value} type="button" onClick={() => setAspectRatio(ratio.value as AspectRatio)}
                      className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${aspectRatio === ratio.value ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}>
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <button disabled={isGenerating || !query.trim()} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-lg shadow-cyan-500/10">
                {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div> : mode === 'single' ? 'Generate Image' : 'Generate 4+ Photos Grid'}
              </button>
            </form>
          </div>

          <div className="hidden lg:block">
            <HistoryList history={history} onSelect={(item) => { setQuery(item.userQuery); setGeneratedPrompt(item.generatedPrompt); setImageUrl(item.imageUrl || null); setAspectRatio(item.aspectRatio); }} onClear={() => { setHistory([]); localStorage.removeItem('reality_history'); }} />
          </div>
        </section>

        <section className="lg:col-span-8 space-y-6">
          <div className="glass-card min-h-[450px] rounded-3xl overflow-hidden flex flex-col relative border-white/5">
            <div className="flex-1 flex items-center justify-center p-4 bg-[#05070a]">
              {imageUrl ? (
                <div className="relative group w-full h-full flex items-center justify-center">
                  <img src={imageUrl} alt="Synthesis Result" className="max-w-full max-h-[65vh] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] object-contain cursor-zoom-in border border-white/5 animate-in zoom-in-95 duration-500" onClick={() => setIsViewerOpen(true)} />
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <button onClick={() => setIsViewerOpen(true)} title="View Larger" className="p-3 bg-black/80 backdrop-blur-xl rounded-xl text-white hover:bg-cyan-600 border border-white/10 shadow-2xl transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>
                    <button onClick={downloadImage} title="Download" className="p-3 bg-black/80 backdrop-blur-xl rounded-xl text-white hover:bg-cyan-600 border border-white/10 shadow-2xl transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-20">
                  <div className="w-32 h-32 border-2 border-dashed border-cyan-500 rounded-full animate-[spin_10s_linear_infinite] flex items-center justify-center">
                    <div className="w-24 h-24 border-2 border-dashed border-blue-500 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
                  </div>
                  <div className="text-center font-black uppercase tracking-[0.3em] text-xs">Awaiting Synthesis Command</div>
                </div>
              )}
            </div>

            {imageUrl && mode === 'single' && (
              <div className="p-4 bg-white/5 border-t border-white/10 backdrop-blur-xl">
                <div className="flex gap-2">
                  <input value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Refine: Adjust lighting, mood, or specific details..." className="flex-1 bg-black/40 rounded-xl px-4 py-2.5 text-sm outline-none border border-white/5 focus:border-cyan-500 transition-all" onKeyDown={(e) => e.key === 'Enter' && handleEdit()} />
                  <button onClick={handleEdit} className="px-6 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Refine</button>
                </div>
              </div>
            )}
          </div>

          {generatedPrompt && (
            <div className="space-y-4">
              <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                  <div className="flex gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                    <button onClick={() => setViewTab('strategy')} className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${viewTab === 'strategy' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-white'}`}>Generated Master Prompt</button>
                    <button onClick={() => setViewTab('json')} className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${viewTab === 'json' ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-white'}`}>Raw JSON Data</button>
                  </div>
                  <button onClick={viewTab === 'strategy' ? copyCombinedPrompt : copyJson} className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black hover:bg-cyan-500 hover:text-white transition-all transform active:scale-95">
                    {viewTab === 'strategy' ? 'COPY PROMPT' : 'COPY JSON'}
                  </button>
                </div>

                <div className="p-6">
                  {viewTab === 'strategy' ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-3">Master Positive Instruction (Lengkap)</h4>
                        <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar pr-2 selection:bg-cyan-500/30">
                          {generatedPrompt.positive}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70 mb-3">Negative Constraints</h4>
                        <div className="text-[10px] text-gray-500 italic font-mono selection:bg-red-500/30">
                          {generatedPrompt.negative}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <pre className="text-[10px] text-cyan-400/80 font-mono overflow-x-auto custom-scrollbar leading-relaxed">
                        {JSON.stringify(generatedPrompt, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {isViewerOpen && imageUrl && (
        <div className="fixed inset-0 z-[100] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300" onClick={() => setIsViewerOpen(false)}>
          <div className="relative max-w-full max-h-[85vh] group" onClick={(e) => e.stopPropagation()}>
            <img src={imageUrl} alt="High Res Synthesis" className="max-w-full max-h-[85vh] rounded-2xl shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10" />
            <button onClick={() => setIsViewerOpen(false)} className="absolute -top-12 right-0 text-white opacity-50 hover:opacity-100 transition-opacity">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="mt-12 flex gap-4">
            <button onClick={downloadImage} className="px-10 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-2xl shadow-cyan-600/20">Download Image</button>
            <button onClick={() => setIsViewerOpen(false)} className="px-10 py-3 bg-white/5 hover:bg-white/10 rounded-full font-black text-xs uppercase tracking-[0.2em] border border-white/10 transition-all">Close Viewer</button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 px-8 py-3 flex items-center gap-12 text-[9px] text-gray-500 z-50 rounded-full shadow-2xl shadow-black">
        <div className="flex gap-6 items-center border-r border-white/10 pr-6">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>SYNTHESIS ACTIVE</span>
          <span className="font-black uppercase">{mode.toUpperCase()} MODE</span>
        </div>
        <div className="flex gap-6 items-center">
          <span className="hidden sm:inline uppercase">Engine: 2.5 Flash</span>
          <span className="hidden sm:inline uppercase">Strategy: {styleMode.toUpperCase()}</span>
          <span className="text-cyan-500/80 font-black tracking-[0.3em] uppercase">READY</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
