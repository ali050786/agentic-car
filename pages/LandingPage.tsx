import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Zap, Layout, Share2, Layers, Palette, PenTool } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-[#05050A] text-white overflow-x-hidden font-sans selection:bg-blue-500/30">
            {/* Dynamic Background */}
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* 3D Perspective Grid */}
                <div className="absolute inset-x-0 bottom-0 h-[80vh] overflow-hidden">
                    <div className="absolute inset-0 w-full h-[200%] bg-[linear-gradient(to_right,rgba(100,116,139,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:linear-gradient(to_bottom,transparent_0%,black_30%)] animate-grid-flow origin-top transform-gpu" style={{ transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }} />
                </div>

                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse delay-1000" />
            </div>

            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/5' : 'bg-transparent'}`}>
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white tracking-wide">
                            Agentic Carousel
                        </span>
                    </div>



                    <div className="flex items-center gap-6">
                        <Link to="/login" className="text-slate-300 hover:text-white font-medium transition-colors text-sm">
                            Sign in
                        </Link>
                        <Link
                            to="/app"
                            className="px-5 py-2 rounded-full bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors text-sm"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 pt-40 pb-32 px-6 overflow-hidden min-h-screen flex flex-col justify-center">

                {/* The Glowing Arc Background - Toned Down */}
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-blue-500/30 opacity-60 blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen animate-pulse" />
                <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[90%] h-[2px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent z-0 shadow-[0_0_30px_rgba(59,130,246,0.5)]" />

                <div className="container mx-auto max-w-5xl text-center relative z-10">

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-10 animate-fade-in-up backdrop-blur-sm cursor-pointer hover:bg-blue-500/20 transition-colors">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-sm font-medium text-blue-300">Early Access Beta</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tight mb-8">
                        Create Viral Carousels <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-blue-300 to-blue-600">
                            In Seconds.
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
                        Stop struggling with design tools. The India's first 🇮🇳 <strong>Agentic AI Carousel Builder</strong> that writes hooks, designs slides, and builds carousel on your personal brand automatically ⚡.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <div className="relative group">
                            {/* Button Border Beam */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                            <div className="absolute -inset-0.5 rounded-xl overflow-hidden">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[500%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] opacity-0 group-hover:opacity-50 animate-border-spin z-0 transition-opacity duration-500" />
                            </div>

                            <Link
                                to="/app"
                                className="relative flex items-center gap-3 px-10 py-5 bg-gradient-to-b from-blue-500 to-blue-600 rounded-xl leading-none text-xl font-bold text-white border-t border-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-300 z-10"
                            >
                                <span>Start Creating for Free</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-white" />
                            </Link>
                        </div>
                    </div>

                    {/* Dashboard Preview (The "Lumine" Screen) - Reduced Glow */}
                    <div className="relative mx-auto max-w-5xl rounded-xl border border-white/10 p-2 bg-white/5 backdrop-blur-sm shadow-2xl shadow-blue-900/40 transform hover:scale-[1.01] transition-transform duration-700 overflow-hidden">

                        {/* Border Beam Animation - Toned Down */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400%] h-[400%] bg-[conic-gradient(from_0deg,transparent_0_300deg,#60a5fa_360deg)] opacity-30 animate-border-spin pointer-events-none z-0 mix-blend-lighten" />
                        <div className="absolute inset-[1px] rounded-xl bg-[#0B0F19]/90 z-0" />

                        <div className="rounded-lg overflow-hidden bg-[#0B0F19] aspect-[16/9] relative group z-10">
                            {/* YouTube Video Embed */}
                            <iframe
                                src="https://www.youtube.com/embed/RtvqiE0IrBM?autoplay=1&mute=1&loop=1&controls=0&playlist=RtvqiE0IrBM&modestbranding=1&showinfo=0&rel=0"
                                className="w-full h-full object-cover"
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                                title="Dashboard Preview"
                            />
                            {/* Glow effect on the bottom */}
                            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-blue-600/5 to-transparent pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>
            {/* Features Grid */}
            <section id="features" className="py-20 bg-slate-950 relative z-10">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                        Everything you need to <span className="text-purple-400">go viral</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Zap className="w-8 h-8 text-yellow-400" />}
                            title="Viral Engine"
                            description="AI Strategist explicitly designed to find hooks and angles that drive engagement on LinkedIn."
                        />
                        <FeatureCard
                            icon={<PenTool className="w-8 h-8 text-orange-400" />}
                            title="Figma Ready"
                            description="Need pixel-perfect control? Copy any slide directly to Figma with one click to fine-tune details."
                        />
                        <FeatureCard
                            icon={<Layers className="w-8 h-8 text-blue-400" />}
                            title="Multi-ModelAI"
                            description="Currently using DeepSeek from OpenRouter. Claude 3.5 and GPT-4o models coming soon to give you more choices."
                        />
                        <FeatureCard
                            icon={<Layout className="w-8 h-8 text-purple-400" />}
                            title="Smart Design"
                            description="Auto-formatting that adheres to design best practices. No more messing with font sizes manually."
                        />
                        <FeatureCard
                            icon={<Share2 className="w-8 h-8 text-green-400" />}
                            title="Instant Export"
                            description="One-click PDF export ready for LinkedIn, plus high-res images for Instagram and Twitter."
                        />
                        <FeatureCard
                            icon={<Palette className="w-8 h-8 text-pink-400" />}
                            title="Brand Identity"
                            description="Save your exact colors, fonts, and logos. Ensure every carousel perfectly matches your personal brand."
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-900 bg-slate-950 relative z-10">
                <div className="container mx-auto px-6 text-center">
                    <p className="text-slate-500 mb-4">© 2025 AgenticCar. All rights reserved.</p>
                    <div className="flex justify-center gap-6">
                        <a href="https://www.linkedin.com/in/blinkwiser/" className="text-slate-400 hover:text-white transition-colors">LinkedIn</a>
                        <a href="https://github.com/ali050786" className="text-slate-400 hover:text-white transition-colors">GitHub</a>
                    </div>
                </div>
            </footer>

            <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-move 5s ease infinite;
        }
        @keyframes gradient-move {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes grid-flow {
          0% { background-position: 0 0; }
          100% { background-position: 0 4rem; } 
        }
        .animate-grid-flow {
          animation: grid-flow 2s linear infinite;
        }
        @keyframes border-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .animate-border-spin {
          animation: border-spin 4s linear infinite;
        }
      `}</style>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900 transition-all group">
        <div className="mb-6 p-4 rounded-xl bg-slate-950 inline-block group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
);

const ShowcaseImage = ({ src }: { src: string }) => (
    <div className="inline-block w-[300px] md:w-[400px] aspect-[4/5] rounded-xl overflow-hidden shadow-2xl border border-slate-800 transform hover:scale-105 transition-transform duration-300">
        <img src={src} alt="Carousel Slide" className="w-full h-full object-cover" />
    </div>
);

export default LandingPage;

const HeroDemoAnimation = () => {
    const [text, setText] = useState('');
    const [step, setStep] = useState<'typing' | 'generating' | 'done'>('typing');
    const fullText = "How to hire senior engineers";

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const runAnimation = async () => {
            // Reset
            setText('');
            setStep('typing');

            // 1. Typing Effect
            for (let i = 0; i <= fullText.length; i++) {
                await new Promise(r => setTimeout(r, 50 + Math.random() * 30));
                setText(fullText.slice(0, i));
            }

            // Pause before click
            await new Promise(r => setTimeout(r, 600));

            // 2. Click Generate
            setStep('generating');

            // 3. Simulate Loading
            await new Promise(r => setTimeout(r, 1500));

            // 4. Show Result
            setStep('done');

            // 5. Hold Result then Loop
            await new Promise(r => setTimeout(r, 4000));
            runAnimation();
        };

        runAnimation();

        return () => clearTimeout(timeout);
    }, []);

    return (
        <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500">
            {/* Fake Browser Header */}
            <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            </div>

            {/* Content Area */}
            <div className="p-6 md:p-8 min-h-[400px] flex flex-col relative">

                {/* Visual State Transition */}
                <div className={`transition-all duration-500 absolute inset-0 p-8 flex flex-col ${step === 'done' ? 'opacity-0 pointer-events-none translate-y-10' : 'opacity-100 translate-y-0'}`}>
                    <label className="text-sm font-medium text-slate-400 mb-2">What is your carousel about?</label>
                    <div className="relative mb-6">
                        <div className="w-full h-14 bg-black/40 border border-white/10 rounded-lg flex items-center px-4 text-lg text-white shadow-inner">
                            {text}
                            <span className="w-0.5 h-6 bg-blue-500 ml-1 animate-pulse" />
                        </div>
                    </div>

                    <button
                        className={`
                            h-12 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2
                            ${step === 'generating'
                                ? 'bg-slate-800 text-slate-400 cursor-wait'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 scale-100'}
                        `}
                    >
                        {step === 'generating' ? (
                            <>
                                <Sparkles className="w-5 h-5 animate-spin" />
                                Generating Strategy...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Generate Carousel
                            </>
                        )}
                    </button>

                    {/* Fake Settings for Realism */}
                    <div className="mt-8 space-y-3 opacity-50 blur-[1px]">
                        <div className="h-4 w-1/3 bg-slate-800 rounded animate-pulse" />
                        <div className="h-4 w-1/2 bg-slate-800 rounded animate-pulse delay-100" />
                        <div className="h-4 w-2/3 bg-slate-800 rounded animate-pulse delay-200" />
                    </div>
                </div>

                {/* Result State */}
                <div className={`transition-all duration-700 absolute inset-0 bg-slate-900/50 backdrop-blur-sm p-8 flex items-center justify-center ${step === 'done' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}`}>
                    <div className="grid grid-cols-2 gap-4 w-full max-w-sm rotate-0 hover:scale-105 transition-transform duration-500">
                        <div className="aspect-[4/5] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-white/10 p-3 shadow-2xl flex flex-col gap-2">
                            <div className="h-full border-l-4 border-blue-500 pl-2 flex flex-col justify-center">
                                <div className="h-2 w-12 bg-blue-500/50 rounded mb-2" />
                                <div className="h-4 w-full bg-white rounded mb-1" />
                                <div className="h-4 w-3/4 bg-white rounded" />
                            </div>
                        </div>
                        <div className="aspect-[4/5] bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-white/10 p-3 shadow-2xl flex flex-col gap-2 opacity-80 translate-y-4">
                            <div className="h-full flex flex-col justify-center">
                                <div className="h-2 w-full bg-slate-700 rounded mb-2" />
                                <div className="h-2 w-full bg-slate-700 rounded mb-2" />
                                <div className="h-2 w-3/4 bg-slate-700 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Floating Badge */}
                    <div className="absolute bottom-8 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl backdrop-blur-md animate-bounce">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Done in 3.2s
                    </div>
                </div>

            </div>
        </div>
    );
};

