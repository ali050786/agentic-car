import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import {
    ArrowRight, Sparkles, Zap, Layout, Share2, Layers, Palette, PenTool,
    MessageSquare, Wand2, Download, Github, Linkedin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { HeroFloatingCards } from '../components/landing/HeroFloatingCards';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09 } },
};

const wordContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const wordUp: Variants = {
    hidden: { opacity: 0, y: '100%' },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

/** Animates a headline word-by-word with a clipped rise-in. */
const RevealHeadline: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
    <motion.span
        variants={wordContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className={className}
    >
        {text.split(' ').map((word, i) => (
            <span key={i} className="inline-block overflow-hidden align-bottom pb-1 mr-[0.28em]">
                <motion.span variants={wordUp} className="inline-block">
                    {word}
                </motion.span>
            </span>
        ))}
    </motion.span>
);

const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
];

const LandingPage = () => {
    const { user } = useAuthStore();
    const [scrolled, setScrolled] = useState(false);
    const { scrollY } = useScroll();
    const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.2]);
    const heroY = useTransform(scrollY, [0, 500], [0, 80]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-[#040406] text-white overflow-x-hidden selection:bg-blue-500/30" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
            {/* Ambient background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-[60vh] bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_10%,transparent_75%)]" />
                <motion.div
                    className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-600/25 blur-[130px]"
                    animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.08, 1] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute top-[10%] right-[-15%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[130px]"
                    animate={{ opacity: [0.4, 0.7, 0.4], scale: [1.05, 1, 1.05] }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                />
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
            </div>

            {/* Nav */}
            <motion.nav
                initial={{ y: -80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#040406]/70 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'}`}
            >
                <div className="container mx-auto px-6 h-18 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Sparkles className="w-4.5 h-4.5 text-white" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Agentic Carousel
                        </span>
                    </div>

                    <div className="hidden md:flex items-center gap-8">
                        {NAV_LINKS.map(link => (
                            <a key={link.href} href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <Link to="/app" className="px-5 py-2 rounded-full bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors text-sm">
                                Go to App
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="hidden sm:block text-slate-300 hover:text-white font-medium transition-colors text-sm">
                                    Sign in
                                </Link>
                                <Link to="/app" className="px-5 py-2 rounded-full bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors text-sm">
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </motion.nav>

            {/* Hero */}
            <motion.section style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 pt-44 pb-28 px-6 min-h-screen flex flex-col justify-center">
                <div className="container mx-auto max-w-6xl relative">
                    {/* 3D visual — desktop only, sits behind the text */}
                    <div className="hidden lg:block absolute -top-24 right-[-14%] w-[680px] h-[620px] pointer-events-none">
                        <HeroFloatingCards />
                    </div>

                    <div className="relative z-10 max-w-3xl">
                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 backdrop-blur-sm"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-sm font-medium text-blue-300">Early Access Beta</span>
                        </motion.div>

                        <h1
                            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight mb-6"
                            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                        >
                            <RevealHeadline text="Carousels that write" />
                            <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-blue-400 to-purple-400">
                                <RevealHeadline text="themselves." />
                            </span>
                        </h1>

                        <motion.p
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            transition={{ delay: 0.5 }}
                            className="text-base md:text-lg text-slate-400 max-w-lg mb-8 leading-relaxed"
                        >
                            Give it a topic. A team of AI agents researches the angle, writes the hooks, and
                            designs every slide on your brand — while you get on with your day.
                        </motion.p>

                        <motion.div
                            variants={fadeUp}
                            initial="hidden"
                            animate="show"
                            transition={{ delay: 0.65 }}
                            className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
                        >
                            <Link
                                to="/app"
                                className="group relative flex items-center gap-3 px-8 py-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-xl text-base font-semibold text-white shadow-[0_0_0_1px_rgba(96,165,250,0.4)_inset] hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] transition-shadow duration-300"
                            >
                                <span>{user ? 'Start Creating' : 'Start Creating for Free'}</span>
                                <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <a
                                href="#how-it-works"
                                className="px-6 py-4 rounded-xl text-base font-medium text-slate-300 border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors"
                            >
                                See how it works
                            </a>
                        </motion.div>
                    </div>
                </div>
            </motion.section>

            {/* How it works */}
            <section id="how-it-works" className="relative z-10 py-28 px-6">
                <div className="container mx-auto max-w-5xl">
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-100px' }}
                        className="text-center mb-20"
                    >
                        <span className="text-sm font-medium text-blue-400 uppercase tracking-widest">The process</span>
                        <h2 className="text-3xl md:text-4xl font-semibold mt-3 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Three steps. Zero design tools.
                        </h2>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-80px' }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        <StepCard
                            index="01"
                            icon={<MessageSquare className="w-6 h-6 text-blue-400" />}
                            title="Describe your topic"
                            description="Type a topic, paste an article, or drop in a YouTube link. That's the whole brief."
                        />
                        <StepCard
                            index="02"
                            icon={<Wand2 className="w-6 h-6 text-purple-400" />}
                            title="Agents do the work"
                            description="Research, strategy, copywriting, and layout run automatically — in the background, even if you close the tab."
                        />
                        <StepCard
                            index="03"
                            icon={<Download className="w-6 h-6 text-green-400" />}
                            title="Refine and export"
                            description="Chat to tweak any slide, then export straight to LinkedIn-ready PDF or images."
                        />
                    </motion.div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="relative z-10 py-28 px-6">
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-100px' }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Everything you need to <span className="text-purple-400">go viral</span>
                        </h2>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-80px' }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5"
                    >
                        <FeatureCard span="lg:col-span-3" icon={<Zap className="w-7 h-7 text-yellow-400" />} title="Viral Engine" description="A dedicated Strategist agent hunts for the angle and hook that actually drives engagement — not generic advice." />
                        <FeatureCard span="lg:col-span-3" icon={<Layers className="w-7 h-7 text-blue-400" />} title="Multi-Agent Pipeline" description="Research, strategy, copy, and design each run as their own specialized agent, working in sequence on your behalf." />
                        <FeatureCard span="lg:col-span-2" icon={<PenTool className="w-7 h-7 text-orange-400" />} title="Figma Ready" description="Copy any slide straight into Figma for pixel-perfect fine-tuning." />
                        <FeatureCard span="lg:col-span-2" icon={<Layout className="w-7 h-7 text-purple-400" />} title="Smart Design" description="Auto-formatting that follows real design constraints — no manual font wrangling." />
                        <FeatureCard span="lg:col-span-2" icon={<Palette className="w-7 h-7 text-pink-400" />} title="Brand Identity" description="Save your colors, fonts, and logo once — every carousel matches automatically." />
                        <FeatureCard span="lg:col-span-3" icon={<Share2 className="w-7 h-7 text-green-400" />} title="Instant Export" description="One click for a LinkedIn-ready PDF, plus high-res images for Instagram and Twitter." />
                        <FeatureCard span="lg:col-span-3" icon={<Sparkles className="w-7 h-7 text-blue-300" />} title="Runs in the Background" description="Kick off a carousel, keep working, and get notified the moment it's ready — no waiting around." />
                    </motion.div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="relative z-10 py-24 px-6">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: '-100px' }}
                    className="container mx-auto max-w-4xl relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-14 text-center"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(59,130,246,0.25),transparent)]" />
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Your next carousel is one prompt away.
                        </h2>
                        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                            No credit card. No design tools. Just describe what you want to say.
                        </p>
                        <Link
                            to="/app"
                            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-b from-blue-500 to-blue-600 rounded-xl text-base font-semibold text-white hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] transition-shadow duration-300"
                        >
                            <span>Start Creating for Free</span>
                            <ArrowRight className="w-4.5 h-4.5" />
                        </Link>
                    </div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 py-12 border-t border-white/10">
                <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 text-sm">© 2026 AgenticCar. All rights reserved.</p>
                    <div className="flex gap-5">
                        <a href="https://www.linkedin.com/in/blinkwiser/" className="text-slate-400 hover:text-white transition-colors" aria-label="LinkedIn">
                            <Linkedin className="w-4.5 h-4.5" />
                        </a>
                        <a href="https://github.com/ali050786" className="text-slate-400 hover:text-white transition-colors" aria-label="GitHub">
                            <Github className="w-4.5 h-4.5" />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const StepCard = ({ index, icon, title, description }: { index: string; icon: React.ReactNode; title: string; description: string }) => (
    <motion.div variants={fadeUp} className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors">
        <span className="absolute top-6 right-7 text-5xl font-semibold text-white/5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{index}</span>
        <div className="mb-5 p-3 rounded-xl bg-white/5 inline-block">{icon}</div>
        <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </motion.div>
);

const FeatureCard = ({ icon, title, description, span }: { icon: React.ReactNode; title: string; description: string; span: string }) => (
    <motion.div
        variants={fadeUp}
        whileHover={{ y: -4 }}
        className={`${span} p-8 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/40 hover:bg-white/[0.05] transition-colors duration-300`}
    >
        <div className="mb-6 p-3.5 rounded-xl bg-black/30 inline-block">
            {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2.5 text-white">{title}</h3>
        <p className="text-slate-400 leading-relaxed">{description}</p>
    </motion.div>
);

export default LandingPage;
