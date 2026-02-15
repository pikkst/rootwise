import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { DbQuest } from '../types';

interface QuestMatch extends DbQuest {
  matchScore: number;
  matchReasons: string[];
  memberCount: number;
}

interface Filters {
  questType: 'all' | 'solo' | 'duo' | 'team';
  locationRadius: number; // km
  skillsRequired: string[];
  minXpReward: number;
}

const QuestDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [quests, setQuests] = useState<QuestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    questType: 'all',
    locationRadius: 50,
    skillsRequired: [],
    minXpReward: 0,
  });
  const [joiningQuestId, setJoiningQuestId] = useState<string | null>(null);

  // Fetch quests and calculate match scores
  useEffect(() => {
    if (!profile?.id) return;
    fetchAndMatchQuests();
  }, [profile?.id, filters]);

  const fetchAndMatchQuests = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      // Fetch published and in_progress quests
      let query = supabase
        .from('quests')
        .select('*')
        .in('status', ['published', 'in_progress']);

      const { data: questsData, error } = await query;

      if (error || !questsData) {
        showToast('error', 'Failed to load quests');
        setLoading(false);
        return;
      }

      // Filter quests by quest type if specified
      let filtered = questsData as DbQuest[];
      if (filters.questType !== 'all') {
        filtered = filtered.filter((q) => q.quest_type === filters.questType);
      }

      // Filter by XP reward
      filtered = filtered.filter((q) => (q.reward_xp ?? 0) >= filters.minXpReward);

      // Fetch member counts for each quest
      const questIds = filtered.map((q) => q.id);
      let memberCounts: Record<string, number> = {};
      if (questIds.length > 0) {
        const { data: memberData } = await supabase
          .from('quest_members')
          .select('quest_id')
          .in('quest_id', questIds);

        memberCounts = {};
        (memberData ?? []).forEach((m) => {
          memberCounts[m.quest_id] = (memberCounts[m.quest_id] ?? 0) + 1;
        });
      }

      // Calculate match scores
      const matched: QuestMatch[] = filtered
        .map((quest) => {
          let score = 0;
          const reasons: string[] = [];

          // Skill match: check if user has skills the quest requires
          const userSkills = profile.skills ?? [];
          const requiredSkills = quest.skills_required ?? [];
          const matchingSkills = userSkills.filter((s) => requiredSkills.includes(s));

          if (matchingSkills.length > 0) {
            score += matchingSkills.length * 25;
            reasons.push(`${matchingSkills.length} matching skill${matchingSkills.length > 1 ? 's' : ''}`);
          }

          // Location match: check if within radius
          if (quest.address_lat && quest.address_lng && profile.lat && profile.lng) {
            const distance = calculateDistance(
              profile.lat,
              profile.lng,
              quest.address_lat,
              quest.address_lng
            );

            if (distance <= filters.locationRadius) {
              score += Math.max(0, 50 - distance); // Closer = higher score
              reasons.push(`${Math.round(distance)} km away`);
            } else {
              score -= 20; // Penalize far quests
            }
          }

          // Interest match: check category alignment
          const userInterests = profile.interests ?? [];
          if (userInterests.includes(quest.category)) {
            score += 15;
            reasons.push(`Matches your interest in ${quest.category}`);
          }

          // Age range match
          const userAge = profile.age ?? 0;
          const minAge = quest.age_range_min ?? 0;
          const maxAge = quest.age_range_max ?? 120;

          if (userAge >= minAge && userAge <= maxAge) {
            score += 10;
            reasons.push('Matches your age range');
          }

          // Virtual preference
          if (quest.is_virtual) {
            score += 5;
            reasons.push('Virtual quest (no travel needed)');
          }

          // XP reward bonus for high-value quests
          if ((quest.reward_xp ?? 0) >= 200) {
            score += 10;
            reasons.push(`${quest.reward_xp} XP reward`);
          }

          if (reasons.length === 0) {
            reasons.push('New quest to explore');
          }

          return {
            ...quest,
            matchScore: Math.max(0, score),
            matchReasons: reasons,
            memberCount: memberCounts[quest.id] ?? 0,
          };
        })
        .filter((q) => q.matchScore > 0) // Only show matching quests
        .sort((a, b) => b.matchScore - a.matchScore);

      setQuests(matched);
    } catch (err) {
      console.error('Error fetching quests:', err);
      showToast('error', 'Failed to load quests');
    }
    setLoading(false);
  };

  // Haversine formula to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleJoin = async (questId: string) => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    setJoiningQuestId(questId);
    try {
      const { error } = await supabase.from('quest_members').insert({
        quest_id: questId,
        user_id: profile.id,
        role: 'learner',
        status: 'active',
        joined_at: new Date().toISOString(),
        proof_submitted: null,
        proof_verified: false,
      });

      if (error) {
        showToast('error', error.message || 'Failed to join quest');
      } else {
        showToast('success', 'Joined quest! Head to your dashboard to start.');
        await fetchAndMatchQuests();
      }
    } catch (err) {
      showToast('error', 'An error occurred while joining the quest');
    } finally {
      setJoiningQuestId(null);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Please log in to discover quests</p>
          <button
            onClick={() => navigate('/auth')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title="Discover Quests - Rootwise"
        description="Find and join quests matched to your interests and skills."
        path="/quest-discovery"
      />

      <header className="mb-10">
        <h1 className="text-4xl font-bold text-slate-800">Discover Quests</h1>
        <p className="text-slate-600 mt-2">Find quests matched to your interests and skills</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Filters</h2>

            {/* Quest Type */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Quest Type</label>
              <select
                value={filters.questType}
                onChange={(e) =>
                  setFilters({ ...filters, questType: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="team">Team</option>
              </select>
            </div>

            {/* Location Radius */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Location Radius
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={filters.locationRadius}
                  onChange={(e) =>
                    setFilters({ ...filters, locationRadius: parseInt(e.target.value) })
                  }
                  className="flex-1"
                />
                <span className="text-sm font-medium text-slate-600 min-w-fit">{filters.locationRadius} km</span>
              </div>
            </div>

            {/* Minimum XP Reward */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Min XP Reward
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={filters.minXpReward}
                onChange={(e) =>
                  setFilters({ ...filters, minXpReward: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Reset Button */}
            <button
              onClick={() =>
                setFilters({
                  questType: 'all',
                  locationRadius: 50,
                  skillsRequired: [],
                  minXpReward: 0,
                })
              }
              className="w-full px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Quests Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : quests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <p className="text-slate-600 text-lg">No quests match your criteria</p>
              <p className="text-slate-500 text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quests.map((quest) => (
                <div
                  key={quest.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">{quest.title}</h3>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
                          {quest.quest_type}
                        </span>
                        {quest.is_virtual && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
                            Virtual
                          </span>
                        )}
                      </div>

                      <p className="text-slate-600 mb-3">{quest.description}</p>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {quest.matchReasons.map((reason) => (
                          <span key={reason} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                            ✓ {reason}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>🎯 {quest.reward_xp} XP</span>
                        <span>👥 {quest.memberCount} member{quest.memberCount !== 1 ? 's' : ''}</span>
                        <span>📚 {quest.category}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-indigo-600">{Math.round(quest.matchScore)}</div>
                        <div className="text-xs text-slate-500">Match Score</div>
                      </div>
                      <button
                        onClick={() => handleJoin(quest.id)}
                        disabled={joiningQuestId === quest.id}
                        className="w-24 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                      >
                        {joiningQuestId === quest.id ? 'Joining...' : 'Join'}
                      </button>
                      <button
                        onClick={() => navigate(`/quests/${quest.id}`)}
                        className="w-24 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition text-sm font-semibold"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestDiscoveryPage;
