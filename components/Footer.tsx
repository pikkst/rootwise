import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer: React.FC = () => {
  const navigate = useNavigate();

  return (
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
              <li><button onClick={() => navigate('/auth')} className="hover:text-indigo-600 transition-colors">Create account</button></li>
              <li><a href="mailto:villu@mail.eventnexus.eu" className="hover:text-indigo-600 transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => navigate('/privacy-policy')} className="hover:text-indigo-600 transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => navigate('/terms-of-service')} className="hover:text-indigo-600 transition-colors">Terms of Service</button></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-100 flex flex-col gap-2 text-slate-500 text-sm">
          <p>© 2026 EventNexus OÜ. All Rights Reserved.</p>
          <p>EventNexus OÜ (reg. no. 17431557), Põltsamaa, Estonia</p>
          <p>English (US)</p>
          <p>
            <a href="mailto:villu@mail.eventnexus.eu" className="hover:text-indigo-600 transition-colors">villu@mail.eventnexus.eu</a>
          </p>
          <p>Response time: Within 24 hours</p>
          <p>
            <a href="https://www.eventnexus.eu" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">www.eventnexus.eu</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;