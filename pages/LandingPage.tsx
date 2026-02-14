import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Rootwise - Unlock the World's Wisdom"
        description="Bridge the gap between generations. Turn your unique life experience into a shared adventure through collaborative Quests, AI mentoring, and community learning."
        path="/"
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 gradient-bg text-white">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl animate-float-delayed"></div>
        
        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            The Future is Intergenerational
          </div>
          <h1 className="text-6xl md:text-8xl font-black mb-8 leading-[1.1] tracking-tighter">
            Unlock the <br/> <span className="text-amber-300">World's Wisdom.</span>
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-indigo-100 max-w-2xl mx-auto font-medium">
            Bridging the gap between loneliness and legacy. Turn your unique life experience into a shared adventure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => navigate('/auth')}
              className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl hover:shadow-indigo-500/40"
            >
              Start My Quest →
            </button>
          </div>
          
          <div className="mt-16 flex items-center justify-center">
            <div className="px-6 py-3 bg-white/20 backdrop-blur-md rounded-full text-sm font-bold">
              Join the movement of intergenerational learning
            </div>
          </div>
        </div>
      </section>

      {/* The Problem & Solution Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Fixing the Disconnect</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Society is fractured by age silos. Rootwise is the bridge that mends the fracture.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex gap-6 p-6 bg-white rounded-3xl shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
                <div className="w-16 h-16 shrink-0 bg-red-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📉</div>
                <div>
                  <h4 className="font-bold text-xl text-slate-800 mb-2">Combatting Isolation</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">Loneliness is a global epidemic for both elders and youth. Rootwise replaces passive scrolling with active, meaningful human partnership.</p>
                </div>
              </div>
              
              <div className="flex gap-6 p-6 bg-white rounded-3xl shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
                <div className="w-16 h-16 shrink-0 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🏛️</div>
                <div>
                  <h4 className="font-bold text-xl text-slate-800 mb-2">Unlocking Siloed Wisdom</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">Millions of years of life experience are currently locked away. We turn those memories into actionable quests that preserve cultural and technical legacy.</p>
                </div>
              </div>

              <div className="flex gap-6 p-6 bg-white rounded-3xl shadow-sm border border-slate-100 group hover:shadow-xl transition-all">
                <div className="w-16 h-16 shrink-0 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🛠️</div>
                <div>
                  <h4 className="font-bold text-xl text-slate-800 mb-2">Filling the Skill Gap</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">No more "digital divide". Seniors teach soft skills and history; youth teach modern technology and digital leverage.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-indigo-600/5 rounded-[40px] rotate-3"></div>
              <div className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">R</div>
                  <span className="font-bold text-slate-400">QUEST ACTIVE</span>
                </div>
                <h3 className="text-3xl font-black mb-4">Restore a 1970s Camera</h3>
                <p className="text-slate-500 mb-8 italic">"Arthur (74) is teaching Leo (19) the mechanics of film, while Leo helps Arthur digitize his collection."</p>
                <div className="space-y-4">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-3/4 animate-pulse"></div>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>RESTORATION LEVEL 8</span>
                    <span>75% COMPLETE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gamified Goals Section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black mb-16">Our Mission Milestones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-indigo-400 transition-all group">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">🤝</div>
              <h5 className="font-bold text-xl mb-2">1 Million</h5>
              <p className="text-slate-400 text-sm">Meaningful cross-age connections created by 2027.</p>
            </div>
            <div className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-amber-400 transition-all group">
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 group-hover:bg-amber-400 group-hover:text-white transition-all">🧠</div>
              <h5 className="font-bold text-xl mb-2">Digital Unity</h5>
              <p className="text-slate-400 text-sm">Empowering 10 million seniors with modern digital agency.</p>
            </div>
            <div className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-pink-400 transition-all group">
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 group-hover:bg-pink-600 group-hover:text-white transition-all">🌍</div>
              <h5 className="font-bold text-xl mb-2">Global Village</h5>
              <p className="text-slate-400 text-sm">Establishing 1,000 local physical Rootwise hubs.</p>
            </div>
            <div className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-emerald-400 transition-all group">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">🎓</div>
              <h5 className="font-bold text-xl mb-2">Legacy Vault</h5>
              <p className="text-slate-400 text-sm">Preserving 1 billion stories and technical methods.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Playful CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[60px] p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/30 blur-[100px]"></div>
          <h2 className="text-5xl font-black mb-8 relative z-10">Ready to level up humanity?</h2>
          <p className="text-xl text-slate-400 mb-12 relative z-10 max-w-xl mx-auto">Join the movement where every interaction is an investment in our collective future.</p>
          <button 
            onClick={() => navigate('/auth')}
            className="px-12 py-6 bg-indigo-600 hover:bg-indigo-500 rounded-3xl font-black text-2xl transition-all hover:scale-105 shadow-xl relative z-10"
          >
            Claim My Profile
          </button>
        </div>
      </section>
      
      <footer className="py-12 border-t border-slate-100 text-center text-slate-400 text-sm">
        <p>&copy; 2026 Rootwise. Wisdom is meant to be shared.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
