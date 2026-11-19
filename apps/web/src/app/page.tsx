import React from 'react';
import { 
  ShieldCheck, 
  Wind, 
  Sparkles, 
  CalendarClock, 
  Home, 
  Leaf, 
  Users 
} from 'lucide-react';

export default function HomePage() {
  const modules = [
    {
      id: 'aqi-intelligence',
      title: 'AQI Intelligence',
      desc: 'Spatiotemporal station interpolation, weather correlation, and verifiable data provenance.',
      icon: Wind,
      badge: 'Spatial Engine',
    },
    {
      id: 'copilot',
      title: 'GenAI Air Quality Copilot',
      desc: 'Context-grounded assistant with citation guardrails and deterministic fallback.',
      icon: Sparkles,
      badge: 'Gemini 2.5',
    },
    {
      id: 'routine-planner',
      title: 'Smart Daily Routine Planner',
      desc: 'Exposure dose minimization algorithm across diurnal pollution curves.',
      icon: CalendarClock,
      badge: 'Dose Optimizer',
    },
    {
      id: 'indoor-air',
      title: 'Indoor Air Optimizer',
      desc: 'One-compartment mass-balance model and predictive HEPA CADR runtime tracker.',
      icon: Home,
      badge: 'Physics Model',
    },
    {
      id: 'action-simulator',
      title: 'Sustainable Action Simulator',
      desc: 'Rigid separation of macro emissions avoided (kg CO2e) vs micro personal exposure saved.',
      icon: Leaf,
      badge: 'Impact Engine',
    },
    {
      id: 'family-protection',
      title: 'Family Protection Dashboard',
      desc: 'Vulnerability tier thresholds for children, asthmatics, pregnant individuals, and elderly.',
      icon: Users,
      badge: 'Health Shield',
    },
  ];

  return (
    <div className="flex-1 px-4 py-8 md:px-12 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="mb-10 text-center md:text-left border-b border-slate-800 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
          <ShieldCheck className="w-4 h-4" />
          Google PromptWars Virtual Edition — Challenge 6
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          AETHER <span className="text-emerald-400 font-light text-2xl md:text-3xl">| Urban Air Quality Intelligence</span>
        </h1>
        <p className="text-slate-400 max-w-3xl text-sm md:text-base leading-relaxed">
          Translating complex spatiotemporal atmospheric data into hyper-personalized, proactive health protection. Grounded in official EPA breakpoints, WHO 2021 guidelines, and physical mass-balance dynamics.
        </p>
      </header>

      {/* Modules Grid */}
      <section aria-labelledby="modules-heading" className="space-y-4">
        <h2 id="modules-heading" className="text-xl font-bold text-slate-200">
          Core Product Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <article
                key={m.id}
                className="group relative rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-200 focus-within:ring-2 focus-within:ring-emerald-400"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {m.badge}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  {m.title}
                </h3>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  {m.desc}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* System Status Footer */}
      <footer className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
          <span>Core System Architecture Initialized &bull; WCAG 2.1 AA Compliant</span>
        </div>
        <div>
          <span>Backend API Target: FastAPI (Render) &bull; Frontend: Next.js (Vercel)</span>
        </div>
      </footer>
    </div>
  );
}
