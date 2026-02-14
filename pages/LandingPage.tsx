import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Rootwise - Unlock the World's Wisdom"
        description="Bridge the gap between generations. Turn your unique life experience into a shared adventure through collaborative Quests, AI mentoring, and community learning."
        path="/"
      />

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-black">R</div>
            ROOTWISE
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a>
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
            <button onClick={() => navigate('/quests')} className="hover:text-indigo-600 transition-colors">Browse Quests</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/auth')} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">Sign In</button>
            <button onClick={() => navigate('/auth')} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">Get Started Free</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-24 gradient-bg text-white">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl animate-float-delayed"></div>
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                🌱 Free During Beta
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[1.1] tracking-tighter">
                Unlock the <br/> <span className="text-amber-300">World's Wisdom.</span>
              </h1>
              <p className="text-lg md:text-xl mb-8 text-indigo-100 max-w-lg font-medium leading-relaxed">
                The platform where seniors share life wisdom and youth share digital skills. Together, through collaborative Quests and AI mentoring.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => navigate('/auth')}
                  className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl hover:shadow-indigo-500/40"
                >
                  Start Free →
                </button>
                <button 
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-bold text-lg hover:bg-white/20 transition-all"
                >
                  See How It Works
                </button>
              </div>
              <div className="mt-8 flex items-center gap-4 text-sm text-indigo-200">
                <span className="flex items-center gap-1">✓ No credit card</span>
                <span className="flex items-center gap-1">✓ AI mentor included</span>
                <span className="flex items-center gap-1">✓ Free forever plan</span>
              </div>
            </div>

            {/* Right: Product Preview */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-white/5 rounded-3xl rotate-2 scale-105"></div>
              <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">
                {/* Mini Quest Card Preview */}
                <div className="bg-white rounded-2xl p-5 shadow-lg mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">R</div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Quest Active</span>
                    <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">+250 XP</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1">Restore a 1970s Camera</h3>
                  <p className="text-slate-500 text-sm mb-3">Arthur (74) teaches film mechanics while Leo (19) helps digitize his photo collection.</p>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-3/4 rounded-full"></div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 text-right">75% complete</p>
                </div>
                {/* Mini AI Chat Preview */}
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">✨</span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">AI Mentor</span>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-3 text-sm text-slate-700">
                    "That's a great question! Combining Arthur's darkroom expertise with modern scanning creates a perfect quest. Have you considered..."
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-black text-slate-800">6+</div>
            <div className="text-xs text-slate-500 font-medium">Active Communities</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">AI-Powered</div>
            <div className="text-xs text-slate-500 font-medium">Quest Generation</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">Gamified</div>
            <div className="text-xs text-slate-500 font-medium">XP & Level System</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">Free</div>
            <div className="text-xs text-slate-500 font-medium">During Beta</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">How It Works</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Three steps to wisdom</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">From sign-up to meaningful connection in under 5 minutes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">1</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">Create Your Profile</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Choose your role — Sage (mentor), Seeker (learner), or Hybrid (both). Share your skills and interests.</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">2</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">Join a Quest</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Browse intergenerational quests or let AI create one tailored to your skills. Learn by doing, together.</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">3</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">Grow Together</h3>
              <p className="text-slate-500 text-sm leading-relaxed">Earn XP, level up, and build real relationships. Your wisdom creates lasting impact across generations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem & Solution Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Why Rootwise</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Fixing the Disconnect</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Society is fractured by age silos. Rootwise is the bridge.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">📉</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">Combatting Isolation</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Loneliness is a global epidemic. Rootwise replaces passive scrolling with active, meaningful human partnership across generations.</p>
            </div>
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🏛️</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">Unlocking Siloed Wisdom</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Millions of years of life experience are locked away. We turn those memories into actionable quests that preserve cultural legacy.</p>
            </div>
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🛠️</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">Filling the Skill Gap</h4>
              <p className="text-slate-500 text-sm leading-relaxed">No more "digital divide". Seniors teach soft skills and history; youth teach modern technology and digital leverage.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Showcase */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Platform</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Everything you need</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">📜</div>
              <h5 className="font-bold text-lg mb-2">Quests</h5>
              <p className="text-slate-500 text-sm">Collaborative challenges that pair different generations to learn from each other.</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-amber-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">✨</div>
              <h5 className="font-bold text-lg mb-2">AI Mentor</h5>
              <p className="text-slate-500 text-sm">Powered by Gemini AI — your personal guide for learning, quests, and growth.</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-pink-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">🤝</div>
              <h5 className="font-bold text-lg mb-2">Communities</h5>
              <p className="text-slate-500 text-sm">Join groups around shared interests — cooking, tech, gardening, storytelling, and more.</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">🏆</div>
              <h5 className="font-bold text-lg mb-2">XP & Levels</h5>
              <p className="text-slate-500 text-sm">Earn experience points, level up, and track your wisdom journey over time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Pricing</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Start free, upgrade when you're ready. Currently in beta — all features are free!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <div className="p-8 bg-white rounded-3xl border border-slate-200 hover:shadow-xl transition-all">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Free</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">$0</span>
                <span className="text-slate-400 text-sm"> / forever</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> 3 active quests</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Community access</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> AI mentor (5 msgs/day)</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Basic profile & XP</li>
              </ul>
              <button onClick={() => navigate('/auth')} className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                Get Started
              </button>
            </div>

            {/* Pro */}
            <div className="p-8 bg-indigo-600 rounded-3xl border-2 border-indigo-600 text-white relative hover:shadow-2xl transition-all transform md:-translate-y-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 rounded-full text-xs font-black uppercase">Most Popular</div>
              <h3 className="text-lg font-bold mb-2">Pro</h3>
              <div className="mb-1">
                <span className="text-4xl font-black">$9.99</span>
                <span className="text-indigo-200 text-sm"> / month</span>
              </div>
              <p className="text-indigo-200 text-xs mb-6">Free during beta!</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Unlimited quests</li>
                <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Unlimited AI mentor</li>
                <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> AI quest generation</li>
                <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Advanced analytics</li>
                <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Priority matching</li>
              </ul>
              <button onClick={() => navigate('/auth')} className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all">
                Start Free Trial
              </button>
            </div>

            {/* Organization */}
            <div className="p-8 bg-white rounded-3xl border border-slate-200 hover:shadow-xl transition-all">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Organization</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">$49</span>
                <span className="text-slate-400 text-sm"> / month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Everything in Pro</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Up to 50 members</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Admin dashboard</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Branded communities</li>
                <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Reporting & analytics</li>
              </ul>
              <button onClick={() => window.location.href = 'mailto:hello@rootwise.site'} className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Email Capture / Newsletter */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-slate-900 mb-4">Stay in the loop</h2>
          <p className="text-slate-500 mb-8">Get updates on new features, community stories, and wisdom tips. No spam, unsubscribe anytime.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (email) { setEmail(''); alert('Thanks! You\'ll hear from us soon.'); }}} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" 
              className="flex-1 px-5 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap">
              Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[40px] p-12 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/30 blur-[100px]"></div>
          <h2 className="text-4xl md:text-5xl font-black mb-6 relative z-10">Ready to bridge generations?</h2>
          <p className="text-lg text-slate-400 mb-10 relative z-10 max-w-xl mx-auto">Join the movement where every interaction is an investment in our collective future. Start your first quest today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <button 
              onClick={() => navigate('/auth')}
              className="px-10 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-xl transition-all hover:scale-105 shadow-xl"
            >
              Create Free Account
            </button>
            <button 
              onClick={() => navigate('/quests')}
              className="px-10 py-5 bg-white/10 border border-white/20 hover:bg-white/20 rounded-2xl font-bold text-xl transition-all"
            >
              Browse Quests
            </button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-16 border-t border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-black">R</div>
                ROOTWISE
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">Bridging generations through collaborative quests, AI mentoring, and shared wisdom.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><button onClick={() => navigate('/quests')} className="hover:text-indigo-600 transition-colors">Browse Quests</button></li>
                <li><button onClick={() => navigate('/community')} className="hover:text-indigo-600 transition-colors">Communities</button></li>
                <li><button onClick={() => navigate('/ai-nexus')} className="hover:text-indigo-600 transition-colors">AI Mentor</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a></li>
                <li><a href="mailto:hello@rootwise.site" className="hover:text-indigo-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><span className="text-slate-400">Privacy Policy</span></li>
                <li><span className="text-slate-400">Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm">&copy; 2026 Rootwise. Wisdom is meant to be shared.</p>
            <div className="flex items-center gap-4 text-slate-400 text-sm">
              <span>Built with 🌱 for all generations</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
