import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCommunities } from '../hooks/useCommunities';

const CommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const {
    communities,
    userCommunities,
    loading,
    fetchUserCommunities,
    joinCommunity,
    leaveCommunity,
  } = useCommunities();

  useEffect(() => {
    if (profile?.id) fetchUserCommunities(profile.id);
  }, [profile?.id, fetchUserCommunities]);

  const handleToggleMembership = async (communityId: string) => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    if (userCommunities.includes(communityId)) {
      const result = await leaveCommunity(communityId, profile.id);
      if (result.error) {
        showToast('error', result.error.message || 'Failed to leave group');
      } else {
        showToast('info', 'Left community');
      }
    } else {
      const result = await joinCommunity(communityId, profile.id);
      if (result.error) {
        showToast('error', result.error.message || 'Failed to join group');
      } else {
        showToast('success', 'Joined community!');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title="Community Hub - Rootwise"
        description="Join intergenerational communities around cooking, technology, gardening, and more. Share skills across generations."
        path="/community"
      />

      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Community Hub</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Connect with groups of like-minded lifelong learners across all generations.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading communities...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((group) => {
            const isMember = userCommunities.includes(group.id);
            return (
              <div
                key={group.id}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {group.icon}
                </div>
                <h4 className="text-xl font-bold mb-1">{group.name}</h4>
                <p className="text-sm text-slate-500 mb-2">{group.member_count} Members</p>
                {group.description && (
                  <p className="text-xs text-slate-400 mb-6 line-clamp-2">{group.description}</p>
                )}
                <button
                  onClick={() => handleToggleMembership(group.id)}
                  className={`w-full py-3 font-bold rounded-xl transition-all ${
                    isMember
                      ? 'border border-red-100 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                      : 'border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                  }`}
                >
                  {isMember ? 'Leave Group' : 'Join Group'}
                </button>
              </div>
            );
          })}
          {communities.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-400">
              <p className="text-6xl mb-4">🤝</p>
              <p className="font-bold text-xl">No communities yet</p>
              <p>Communities will appear once the database is seeded.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
