import React, { useState, useEffect } from 'react';
import { useCarouselStore } from './store/useCarouselStore';
import { useAuthStore } from './store/useAuthStore';
import { runAgentWorkflow } from './core/agents/MainAgent';
import { CarouselPreview } from './components/CarouselPreview';
import { downloadAllSvgs } from './utils/downloadUtils';
import { Layout, Sparkles, AlertCircle, Download, Zap } from 'lucide-react';
import './tests/testAuthSetup';

const SUGGESTED_TOPICS = [
  "Mental Models for Junior Devs",
  "How to Scale a SaaS to $10k MRR",
  "Why TypeScript is Winning",
  "The Art of Salary Negotiation"
];

const App: React.FC = () => {
  // Auth store - initialize authentication
  const { initialize, initialized, loading: authLoading } = useAuthStore();
  
  // Carousel store - existing functionality
  const { topic, setTopic, selectedTemplate, setTemplate, isGenerating, error, slides } = useCarouselStore();
  const [localTopic, setLocalTopic] = useState('');

  // Initialize auth when app loads
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading state while auth is initializing
  if (!initialized || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  const handleGenerate = () => {
    if (!localTopic) return;
    setTopic(localTopic);
    runAgentWorkflow(localTopic);
  };

  const handleRandomTopic = () => {
    const random = SUGGESTED_TOPICS[Math.floor(Math.random() * SUGGESTED_TOPICS.length)];
    setLocalTopic(random);
  };

  const handleDownloadAll = () => {
    downloadAllSvgs(slides, selectedTemplate);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">Agentic Carousel Generator</h1>
        </div>
        
        {slides.length > 0 && (
          <button 
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg text-sm font-medium transition-all"
          >
            <Download size={16} />
            Download Optimized (SVG)
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel: Controls */}
        <aside className="w-96 border-r border-white/10 bg-neutral-900/95 backdrop-blur flex flex-col gap-8 p-6 z-10 shadow-xl overflow-y-auto">
          
          {/* Input Section */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                1. Topic
              </label>
              <button 
                onClick={handleRandomTopic}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <Zap size={12} /> Surprise Me
              </button>
            </div>
            
            <textarea
              className="w-full h-32 bg-black/40 border border-white/10 rounded-lg p-4 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder:text-neutral-600"
              placeholder="What should this carousel be about?"
              value={localTopic}
              onChange={(e) => setLocalTopic(e.target.value)}
            />
          </div>

          {/* Template Selection */}
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
              2. Agent Persona
            </label>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setTemplate('template-1')}
                className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                  selectedTemplate === 'template-1'
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                }`}
              >
                <div className="relative z-10">
                  <div className="font-bold text-white mb-1 flex justify-between">
                    The Truth
                    {selectedTemplate === 'template-1' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>}
                  </div>
                  <div className="text-xs text-neutral-400 group-hover:text-neutral-300">Bold, industrial, high contrast.</div>
                </div>
              </button>
              
              <button
                onClick={() => setTemplate('template-2')}
                className={`group p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                  selectedTemplate === 'template-2'
                    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                    : 'border-white/10 hover:border-white/30 bg-black/20'
                }`}
              >
                <div className="relative z-10">
                  <div className="font-bold text-white mb-1 flex justify-between">
                    The Clarity
                    {selectedTemplate === 'template-2' && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"/>}
                  </div>
                  <div className="text-xs text-neutral-400 group-hover:text-neutral-300">Clean, tech-forward, gradients.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-auto pt-6 border-t border-white/5">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-xs text-red-200">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !localTopic}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                isGenerating || !localTopic
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Carousel
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Right Panel: Preview */}
        <main className="flex-1 relative bg-neutral-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950">
           <CarouselPreview />
        </main>
      </div>
    </div>
  );
};

export default App;