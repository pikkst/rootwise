import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCommunities } from '../hooks/useCommunities';

const CommunityPage: React.FC = () => {
  const { t } = useTranslation();
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
        showToast('error', result.error || t('communities.failedLeave'));
      } else {
        showToast('info', t('communities.leftToast'));
      }
    } else {
      const result = await joinCommunity(communityId, profile.id);
      if (result.error) {
        showToast('error', result.error || t('communities.failedJoin'));
      } else {
        showToast('success', t('communities.joinedToast'));
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title={`${t('communities.title')} - Rootwise`}
        description={t('communities.subtitle')}
        path="/community"
      />

      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">{t('communities.title')}</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          {t('communities.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">{t('communities.loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((group) => {
            const isMember = userCommunities.includes(group.id);
            const brandColor = group.brand_color || '#6366f1';
            return (
              <div
                key={group.id}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all group"
                style={{ borderTopWidth: 4, borderTopColor: brandColor }}
              >
                <div className="flex gap-4 mb-4">
                  {group.logo_url ? (
                    <img
                      src={group.logo_url}
                      alt={group.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-100 group-hover:scale-110 transition-transform flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform flex-shrink-0">
                      {group.icon}
                    </div>
                  )}
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/community/${group.id}`)}>
                    <h4 className="text-xl font-bold mb-1 group-hover:text-indigo-600 transition">{group.name}</h4>
                    <p className="text-sm text-slate-500 mb-2">{t('communities.membersCount', { count: group.member_count })}</p>
                  </div>
                </div>
                {group.description && (
                  <p className="text-xs text-slate-400 mb-6 line-clamp-2">{group.description}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/community/${group.id}`)}
                    className="flex-1 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold rounded-xl transition text-sm"
                  >
                    {t('communities.view')}
                  </button>
                  <button
                    onClick={() => handleToggleMembership(group.id)}
                    className={`flex-1 py-2 font-semibold rounded-xl transition text-sm ${
                      isMember
                        ? 'border border-red-100 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                        : 'border border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    {isMember ? t('communities.leave') : t('communities.join')}
                  </button>
                </div>
              </div>
            );
          })}
          {communities.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-400">
              <p className="text-6xl mb-4">🤝</p>
              <p className="font-bold text-xl">{t('communities.noCommunitiesTitle')}</p>
              <p>{t('communities.noCommunitiesDesc')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
