import React, { useEffect, useState } from 'react';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isPro } from '../services/planService';
import { redirectToCheckout } from '../services/stripeService';
import { supabase } from '../services/supabase';
import { Profile, getInitials } from '../types';

interface MatchedProfile extends Profile {
  score: number;
  matchReasons: string[];
}

const MatchingPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<MatchedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);

  useEffect(() => {
    if (!profile?.id || !hasPro) {
      setLoading(false);
      return;
    }
    findMatches();
  }, [profile?.id, hasPro]);

  const findMatches = async () => {
    if (!profile) return;
    setLoading(true);

    // Fetch all profiles except self
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile.id)
      .limit(100);

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Fetch communities user belongs to
    const { data: userComms } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', profile.id);
    const userCommunityIds = new Set((userComms ?? []).map((c) => c.community_id));

    // Fetch all community memberships for matching
    const { data: allComms } = await supabase
      .from('community_members')
      .select('user_id, community_id');
    const commsByUser: Record<string, Set<string>> = {};
    (allComms ?? []).forEach((m) => {
      if (!commsByUser[m.user_id]) commsByUser[m.user_id] = new Set();
      commsByUser[m.user_id].add(m.community_id);
    });

    // Score each profile
    const scored: MatchedProfile[] = (profiles as Profile[]).map((p) => {
      let score = 0;
      const matchReasons: string[] = [];

      // Shared interests
      const sharedInterests = (profile.interests ?? []).filter((i) =>
        (p.interests ?? []).includes(i)
      );
      if (sharedInterests.length > 0) {
        score += sharedInterests.length * 20;
        matchReasons.push(`${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}: ${sharedInterests.slice(0, 3).join(', ')}`);
      }

      // Complementary skills (Sage has what Seeker wants)
      const complementarySkills = (profile.interests ?? []).filter((i) =>
        (p.skills ?? []).includes(i)
      );
      if (complementarySkills.length > 0) {
        score += complementarySkills.length * 25;
        matchReasons.push(`Can teach you: ${complementarySkills.slice(0, 3).join(', ')}`);
      }

      // You can teach them
      const youCanTeach = (profile.skills ?? []).filter((s) =>
        (p.interests ?? []).includes(s)
      );
      if (youCanTeach.length > 0) {
        score += youCanTeach.length * 15;
        matchReasons.push(`You can share: ${youCanTeach.slice(0, 3).join(', ')}`);
      }

      // Role compatibility (Sage-Seeker pairs score highest)
      if (
        (profile.role === 'Sage' && p.role === 'Seeker') ||
        (profile.role === 'Seeker' && p.role === 'Sage')
      ) {
        score += 30;
        matchReasons.push('Complementary roles (Sage ↔ Seeker)');
      } else if (profile.role === 'Hybrid' || p.role === 'Hybrid') {
        score += 10;
      }

      // Shared communities
      const otherComms = commsByUser[p.id] ?? new Set();
      const sharedCommunities = [...userCommunityIds].filter((c) => otherComms.has(c));
      if (sharedCommunities.length > 0) {
        score += sharedCommunities.length * 15;
        matchReasons.push(`${sharedCommunities.length} shared communit${sharedCommunities.length > 1 ? 'ies' : 'y'}`);
      }

      // Age diversity bonus (intergenerational!)
      if (profile.age && p.age) {
        const ageDiff = Math.abs(profile.age - p.age);
        if (ageDiff >= 20) {
          score += 20;
          matchReasons.push('Intergenerational match');
        }
      }

      if (matchReasons.length === 0) {
        matchReasons.push('Explore a new connection');
      }

      return { ...p, score, matchReasons };
    });

    // Sort by score, filter out zero-score
    const sorted = scored
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    setMatches(sorted);
    setLoading(false);
  };

  const handleConnect = async (partnerId: string) => {
    if (!profile) return;
    setConnectingId(partnerId);

    // Check if connection already exists
    const { data: existing } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user_id.eq.${profile.id},partner_id.eq.${partnerId}),and(user_id.eq.${partnerId},partner_id.eq.${profile.id})`)
      .limit(1);

    if (existing && existing.length > 0) {
      showToast('info', 'You already have a connection with this person.');
      setConnectingId(null);
      return;
    }

    const { error } = await supabase.from('connections').insert({
      user_id: profile.id,
      partner_id: partnerId,
      status: 'scheduled',
      topic: 'Matched by Rootwise AI',
      scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      showToast('error', 'Failed to create connection.');
    } else {
      showToast('success', 'Connection request sent! Check your dashboard.');
    }
    setConnectingId(null);
  };

  // Upgrade wall for free users
  if (!hasPro) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        <SEOHead title="Priority Matching - Rootwise" description="Find your ideal intergenerational partner." path="/matching" />
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">🤝</div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">Priority Matching</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-2">
            Our AI analyzes your skills, interests, role, and community involvement to find your ideal intergenerational partners.
          </p>
          <p className="text-slate-400 text-sm mb-8">Available on Pro and Organization plans.</p>
          <button
            onClick={() => redirectToCheckout('pro')}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30"
          >
            Upgrade to Pro — $9.99/mo
          </button>
          <p className="text-xs text-slate-400 mt-3">Free during beta!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title="Priority Matching - Rootwise" description="Find your ideal intergenerational partner." path="/matching" />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Priority Matching</h2>
          <p className="text-slate-500">AI-powered partner recommendations based on your profile.</p>
        </div>
        <button
          onClick={findMatches}
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <span className="animate-spin">⟳</span> : <span>🔄</span>}
          Refresh Matches
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Finding your best matches...</p>
        </div>
      ) : matches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match, index) => (
            <div key={match.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden">
              {/* Match score badge */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 flex items-center justify-between">
                <span className="text-white font-bold text-sm">Match #{index + 1}</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-bold">
                  {match.score}% match
                </span>
              </div>

              <div className="p-6">
                {/* Profile info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                    {match.avatar_url ? (
                      <img src={match.avatar_url} alt={match.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(match.name)
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{match.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        match.role === 'Sage' ? 'bg-amber-100 text-amber-700' :
                        match.role === 'Seeker' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {match.role}
                      </span>
                      {match.age && <span className="text-xs text-slate-400">Age {match.age}</span>}
                    </div>
                  </div>
                </div>

                {/* Match reasons */}
                <div className="space-y-2 mb-4">
                  {match.matchReasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {/* Skills */}
                {match.skills && match.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {match.skills.slice(0, 4).map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs">
                        {s}
                      </span>
                    ))}
                    {match.skills.length > 4 && (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded text-xs">
                        +{match.skills.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Connect button */}
                <button
                  onClick={() => handleConnect(match.id)}
                  disabled={connectingId === match.id}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {connectingId === match.id ? 'Connecting...' : '🤝 Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <p className="text-6xl mb-4">🔍</p>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No matches yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Add skills and interests to your profile, and join communities to improve your matching results.
          </p>
        </div>
      )}
    </div>
  );
};

export default MatchingPage;
