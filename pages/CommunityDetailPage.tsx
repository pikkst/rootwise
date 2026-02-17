import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { RootwiseAIService } from '../services/geminiService';
import type { CommunityQuestContext, UserQuestContext } from '../services/geminiService';
import { Community, CommunityMember, DbQuest, Profile } from '../types';
import { formatDateNumeric, formatTime } from '../utils/formatDate';

type Tab = 'overview' | 'members' | 'quests' | 'activity' | 'chat';

interface MemberWithProfile extends CommunityMember {
  profile?: Profile;
  isFriend?: boolean;
  isFollowing?: boolean;
}

interface ActivityEvent {
  id: string;
  user_id: string;
  activity_type: 'post' | 'quest_completed' | 'achievement' | 'joined_community' | 'friendship';
  title?: string;
  description?: string;
  created_at: string;
  profile?: Profile;
}

interface CommunityMessage {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_system_message: boolean;
  profile?: Profile;
}

const CommunityDetailPage: React.FC = () => {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const supabaseAny = supabase as any;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiService = useRef(new RootwiseAIService());

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithProfile[]>([]);
  const [quests, setQuests] = useState<DbQuest[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joiningCommunity, setJoiningCommunity] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingCommunityQuest, setGeneratingCommunityQuest] = useState(false);
  const [allSkills, setAllSkills] = useState<string[]>([]);

  useEffect(() => {
    if (!communityId) return;
    fetchCommunityDetails();

    // Subscribe to community messages for real-time updates
    const subscription = supabase
      .channel(`community_${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [communityId, profile?.id]);

  // Filter members based on search and skill filter
  useEffect(() => {
    let filtered = members;

    if (memberSearch) {
      filtered = filtered.filter(
        (m) =>
          m.profile?.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.profile?.bio?.toLowerCase().includes(memberSearch.toLowerCase())
      );
    }

    if (skillFilter) {
      filtered = filtered.filter((m) =>
        m.profile?.skills?.includes(skillFilter)
      );
    }

    setFilteredMembers(filtered);
  }, [members, memberSearch, skillFilter]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchCommunityDetails = async () => {
    if (!communityId) return;
    setLoading(true);

    try {
      // Fetch community
      const { data: communityData } = await supabase
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single();

      if (communityData) {
        setCommunity(communityData as Community);
      }

      // Check if user is member
      if (profile?.id) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('*')
          .eq('community_id', communityId)
          .eq('user_id', profile.id)
          .single();
        setIsMember(!!memberData);
      }

      // Fetch all members with profiles
      const { data: membersData } = await supabase
        .from('community_members')
        .select('*, user:user_id(id, name, avatar_url, bio, role, skills)')
        .eq('community_id', communityId);

      if (membersData) {
        // Map the data to use the right structure
        const mappedMembers = membersData.map((m: any) => ({
          ...m,
          profile: m.user,
        }));

        // Collect all unique skills from all members
        const skillsSet = new Set<string>();
        mappedMembers.forEach((m: any) => {
          if (m.profile?.skills && Array.isArray(m.profile.skills)) {
            m.profile.skills.forEach((skill: string) => skillsSet.add(skill));
          }
        });
        setAllSkills(Array.from(skillsSet).sort());

        // Fetch friendship/follow status for current user
        let friendStatuses: Record<string, boolean> = {};
        let followStatuses: Record<string, boolean> = {};

        if (profile?.id && mappedMembers.length > 0) {
          const memberIds = mappedMembers.map((m) => m.user_id);

          // Get friendships where current user is user_id_a
          const { data: friendshipsA } = await supabase
            .from('friendships')
            .select('user_id_a, user_id_b')
            .eq('user_id_a', profile.id);

          // Get friendships where current user is user_id_b
          const { data: friendshipsB } = await supabase
            .from('friendships')
            .select('user_id_a, user_id_b')
            .eq('user_id_b', profile.id);

          const allFriendships = [...(friendshipsA || []), ...(friendshipsB || [])];

          if (allFriendships && allFriendships.length > 0) {
            allFriendships.forEach((f: any) => {
              const otherId = f.user_id_a === profile.id ? f.user_id_b : f.user_id_a;
              if (memberIds.includes(otherId)) {
                friendStatuses[otherId] = true;
              }
            });
          }

          // Check follows - get followers where current user is follower_id
          const { data: followers } = await supabase
            .from('followers')
            .select('follower_id, user_id')
            .eq('follower_id', profile.id);

          if (followers && followers.length > 0) {
            followers.forEach((f: any) => {
              if (memberIds.includes(f.user_id)) {
                followStatuses[f.user_id] = true;
              }
            });
          }
        }

        const enrichedMembers: MemberWithProfile[] = mappedMembers.map((m: any) => ({
          ...m,
          isFriend: friendStatuses[m.user_id] ?? false,
          isFollowing: followStatuses[m.user_id] ?? false,
        }));

        setMembers(enrichedMembers);
        setFilteredMembers(enrichedMembers);
      }

      // Fetch community quests
      const { data: questsData } = await supabase
        .from('quests')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (questsData) {
        setQuests(questsData as DbQuest[]);
      }

      // Fetch activity feed
      await fetchActivities();

      // Fetch community messages
      await fetchMessages();
    } catch (error) {
      console.error('Error fetching community details:', error);
      showToast('error', t('communityDetail.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    if (!communityId) return;

    const { data } = await supabase
      .from('activity_feed')
      .select('*, user:user_id(id, name, avatar_url, role)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setActivities((data as any[]).map((item) => ({ ...item, profile: item.user })) as ActivityEvent[]);
    }
  };

  const fetchMessages = async () => {
    if (!communityId) return;

    const { data } = await supabase
      .from('community_messages')
      .select('*, user:user_id(id, name, avatar_url, role)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setMessages((data as any[]).map((item) => ({ ...item, profile: item.user })) as CommunityMessage[]);
    }
  };

  const handleGenerateCommunityQuest = async () => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    if (!communityId || !community) return;

    if (!isMember) {
      showToast('info', t('communityDetail.joinToGenerate'));
      return;
    }

    setGeneratingCommunityQuest(true);
    try {
      // ── Build rich community context from member data ──
      const memberProfiles = members
        .map((m) => m.profile)
        .filter((p): p is Profile => !!p);

      const ages = memberProfiles.map((p) => p.age).filter((a): a is number => !!a);
      const memberAgeRange = ages.length >= 2
        ? { min: Math.min(...ages), max: Math.max(...ages) }
        : null;

      // Aggregate skills and interests across members, count frequency
      const skillCounts = new Map<string, number>();
      const interestCounts = new Map<string, number>();
      for (const p of memberProfiles) {
        for (const s of p.skills ?? []) skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
        for (const i of p.interests ?? []) interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
      }
      const topSkills = [...skillCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s]) => s);
      const topInterests = [...interestCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s]) => s);

      // Existing community quests (to avoid duplicates)
      const existingQuestTitles = quests.map((q) => q.title);

      const communityContext: CommunityQuestContext = {
        communityName: community.name,
        communityDescription: community.description,
        communityCategory: community.category,
        memberCount: members.length,
        memberAgeRange,
        memberSkills: topSkills,
        memberInterests: topInterests,
        existingQuestTitles,
      };

      // Basic creator context
      let creatorLocation: string | null = null;
      try {
        const { data: locData } = await supabase
          .from('profile_locations')
          .select('locations(country, county, city, locality)')
          .eq('profile_id', profile.id)
          .eq('is_primary', true)
          .limit(1)
          .single();
        const loc = (locData as any)?.locations;
        if (loc) {
          creatorLocation = [loc.locality, loc.city, loc.county, loc.country].filter(Boolean).join(', ');
        }
      } catch { /* no location */ }

      const userContext: UserQuestContext = {
        age: profile.age,
        role: profile.role,
        location: creatorLocation,
      };

      const generated = await aiService.current.generateGroupQuest(profile.role, communityContext, userContext);

      if (!generated || generated.error) {
        showToast('error', generated?.error || t('communityDetail.couldNotGenerate'));
        return;
      }

      let imageUrl: string | null = null;
      try {
        const imageBase64 = await aiService.current.generateQuestImage(
          generated.title,
          generated.description,
          generated.category
        );

        if (imageBase64) {
          const fileName = `community-quest-${Date.now()}.png`;
          const base64Data = imageBase64.replace('data:image/png;base64,', '');
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);

          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-media')
            .upload(`quest-images/${profile.id}/${fileName}`, bytes, {
              contentType: 'image/png',
            });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('profile-media')
              .getPublicUrl(uploadData.path);
            imageUrl = publicUrlData.publicUrl;
          }
        }
      } catch (imageError) {
        console.warn('Community quest image generation failed:', imageError);
      }

      const { data: createdQuest, error: questError } = await supabaseAny
        .from('quests')
        .insert({
          title: generated.title,
          description: generated.description,
          category: generated.category,
          community_id: communityId,
          quest_type: 'team',
          is_virtual: true,
          reward_xp: 200,
          steps: generated.steps ?? [],
          created_by: profile.id,
          status: 'published',
          image_url: imageUrl,
        })
        .select('id, title')
        .single();

      if (questError || !createdQuest) {
        throw questError || new Error('Quest insert failed');
      }

      await supabaseAny.from('quest_members').upsert({
        quest_id: createdQuest.id,
        user_id: profile.id,
        role: 'creator',
        status: 'accepted',
        proof_submitted: null,
        xp_awarded: false,
      });

      await supabaseAny.from('activity_feed').insert({
        user_id: profile.id,
        community_id: communityId,
        activity_type: 'post',
        title: `${profile.name} created a community quest: ${createdQuest.title}`,
      });

      await fetchCommunityDetails();
      setActiveTab('quests');
      showToast('success', t('communityDetail.questGenerated', { title: createdQuest.title }));
    } catch (error) {
      console.error('Error generating community quest:', error);
      showToast('error', t('communityDetail.questGenerateFailed'));
    } finally {
      setGeneratingCommunityQuest(false);
    }
  };

  const handleJoinCommunity = async () => {
    if (!profile?.id || !communityId) return;

    setJoiningCommunity(true);
    try {
      if (community?.member_limit && members.length >= community.member_limit) {
        showToast('error', t('communityDetail.memberLimitReached', { limit: community.member_limit }));
        return;
      }

      const { error } = await supabaseAny.from('community_members').insert({
        community_id: communityId,
        user_id: profile.id,
      });

      if (error) throw error;

      setIsMember(true);
      showToast('success', t('communityDetail.joinedSuccess'));

      // Log activity
      await supabaseAny.from('activity_feed').insert({
        user_id: profile.id,
        community_id: communityId,
        activity_type: 'joined_community',
        title: `${profile.name} joined the community`,
      });
    } catch (error) {
      console.error('Error joining community:', error);
      showToast('error', t('communityDetail.errorJoining'));
    } finally {
      setJoiningCommunity(false);
    }
  };

  const handleLeaveCommunity = async () => {
    if (!profile?.id || !communityId) return;

    setJoiningCommunity(true);
    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', profile.id);

      if (error) throw error;

      setIsMember(false);
      showToast('success', t('communityDetail.leftSuccess'));
    } catch (error) {
      console.error('Error leaving community:', error);
      showToast('error', t('communityDetail.errorLeaving'));
    } finally {
      setJoiningCommunity(false);
    }
  };

  const handleFollowMember = async (userId: string) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabaseAny.from('followers').insert({
        follower_id: profile.id,
        user_id: userId,
      });

      if (error) throw error;

      setMembers(
        members.map((m) =>
          m.user_id === userId ? { ...m, isFollowing: true } : m
        )
      );
      showToast('success', t('communityDetail.followingMember'));
    } catch (error) {
      console.error('Error following member:', error);
    }
  };

  const handleUnfollowMember = async (userId: string) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', profile.id)
        .eq('user_id', userId);

      if (error) throw error;

      setMembers(
        members.map((m) =>
          m.user_id === userId ? { ...m, isFollowing: false } : m
        )
      );
      showToast('success', t('communityDetail.unfollowedMember'));
    } catch (error) {
      console.error('Error unfollowing member:', error);
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabaseAny.from('friendships').insert({
        user_id_a: profile.id,
        user_id_b: userId,
      });

      if (error) throw error;

      setMembers(
        members.map((m) =>
          m.user_id === userId ? { ...m, isFriend: true } : m
        )
      );
      showToast('success', t('communityDetail.addedFriend'));
    } catch (error) {
      console.error('Error adding friend:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !profile?.id || !communityId) return;

    setSendingMessage(true);
    try {
      const { error } = await supabaseAny.from('community_messages').insert({
        community_id: communityId,
        user_id: profile.id,
        content: messageInput,
      });

      if (error) throw error;

      setMessageInput('');
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('error', t('communityDetail.errorSendingMessage'));
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-gray-600">{t('communityDetail.communityLoading')}</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">{t('communityDetail.notFound')}</h1>
          <button
            onClick={() => navigate('/community')}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            {t('communityDetail.backToCommunities')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead title={community.name} description={community.description || ''} />
      <div
        className="min-h-screen bg-gradient-to-br from-indigo-50 to-white pt-24 pb-32"
        style={{ borderTop: `4px solid ${community.brand_color || '#6366f1'}` }}
      >
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {community.logo_url ? (
                  <img
                    src={community.logo_url}
                    alt={community.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-100"
                  />
                ) : (
                  <div className="text-5xl">{community.icon}</div>
                )}
                <div>
                  <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{community.name}</h1>
                  <p className="text-gray-600 mt-1">{community.description}</p>
                  <div className="flex gap-3 mt-3 text-sm">
                    <span className="text-gray-600">{t('common.membersPlural', { count: members.length })}</span>
                    <span className="text-gray-600">🏷️ {community.category}</span>
                  </div>
                </div>
              </div>
              <div>
                {isMember ? (
                  <button
                    onClick={handleLeaveCommunity}
                    disabled={joiningCommunity}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {joiningCommunity ? t('common.loading') : t('common.leave')}
                  </button>
                ) : (
                  <button
                    onClick={handleJoinCommunity}
                    disabled={joiningCommunity}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {joiningCommunity ? t('common.joining') : t('communityDetail.joinCommunity')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-4 border-b border-gray-200 mb-6 overflow-x-auto">
            {(['overview', 'members', 'quests', 'activity', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {tab === 'overview' && t('communityDetail.tabOverview')}
                {tab === 'members' && t('communityDetail.tabMembers')}
                {tab === 'quests' && t('communityDetail.tabQuests')}
                {tab === 'activity' && t('communityDetail.tabActivity')}
                {tab === 'chat' && t('communityDetail.tabChat')}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-bold mb-3">{t('communityDetail.about')}</h2>
                  <p className="text-gray-700">{community.description}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-bold text-lg mb-2">{t('communityDetail.stats')}</h3>
                  <div className="space-y-2 text-sm">
                    <p>{t('communityDetail.statsMembers')}: {members.length}</p>
                    <p>{t('communityDetail.statsQuests')}: {quests.length}</p>
                    <p>{t('communityDetail.statsCategory')}: {community.category}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* Search and Filter */}
              <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
                <input
                  type="text"
                  placeholder={t('communityDetail.searchMembersPlaceholder')}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {allSkills.length > 0 && (
                  <select
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">{t('communityDetail.filterSkillPlaceholder')}</option>
                    {allSkills.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm text-gray-600">
                  {t('communityDetail.showingMembers', { shown: filteredMembers.length, total: members.length })}
                </p>
              </div>

              {/* Members Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMembers.map((member) => (
                  <div key={member.user_id} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {member.profile?.avatar_url && (
                        <img
                          src={member.profile.avatar_url}
                          alt={member.profile.name}
                          onClick={() => navigate(`/users/${member.user_id}`)}
                          className="w-12 h-12 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-indigo-500 transition"
                        />
                      )}
                      <div className="flex-1">
                        <h3 
                          onClick={() => navigate(`/users/${member.user_id}`)}
                          className="font-bold cursor-pointer hover:text-indigo-600 transition"
                        >
                          {member.profile?.name}
                        </h3>
                        <p className="text-sm text-gray-600">{member.profile?.role || t('communityDetail.defaultRole')}</p>
                      </div>
                    </div>
                    {member.profile?.bio && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{member.profile.bio}</p>
                    )}
                    {member.profile?.skills && member.profile.skills.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1">
                        {member.profile.skills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {member.user_id !== profile?.id ? (
                        <>
                          {member.isFollowing ? (
                            <button
                              onClick={() => handleUnfollowMember(member.user_id)}
                              className="px-2 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                            >
                              {'✓ ' + t('common.following')}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollowMember(member.user_id)}
                              className="px-2 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                            >
                              {t('common.follow')}
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/users/${member.user_id}`)}
                            className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            title={t('communityDetail.sendMessage')}
                          >
                            {t('communityDetail.message')}
                          </button>
                          {!member.isFriend && (
                            <button
                              onClick={() => handleAddFriend(member.user_id)}
                              className="px-2 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              {t('communityDetail.addFriend')}
                            </button>
                          )}
                        </>
                      ) : null}
                      <button
                        onClick={() => navigate(`/users/${member.user_id}`)}
                        className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {t('communityDetail.profile')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quests Tab */}
          {activeTab === 'quests' && (
            <div className="space-y-4">
              {isMember && (
                <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{t('communityDetail.createQuestTitle')}</p>
                    <p className="text-sm text-gray-600">{t('communityDetail.createQuestDesc')}</p>
                  </div>
                  <button
                    onClick={handleGenerateCommunityQuest}
                    disabled={generatingCommunityQuest}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {generatingCommunityQuest ? t('communityDetail.generating') : t('communityDetail.generateQuest')}
                  </button>
                </div>
              )}

              {quests.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                  <p className="text-gray-600 mb-4">{t('communityDetail.noQuestsYet')}</p>
                  {isMember && (
                    <button
                      onClick={handleGenerateCommunityQuest}
                      disabled={generatingCommunityQuest}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                    >
                      {generatingCommunityQuest ? t('communityDetail.generating') : t('communityDetail.generateFirstQuest')}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Active Quests */}
                  {quests.filter((q) => q.status !== 'completed').length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {t('communityDetail.activeQuests')}
                      </h3>
                      {quests.filter((q) => q.status !== 'completed').map((quest) => (
                        <div
                          key={quest.id}
                          onClick={() => navigate(`/quests/${quest.id}`)}
                          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow mb-3"
                        >
                          <div className="flex gap-4">
                            {quest.image_url && (
                              <img
                                src={quest.image_url}
                                alt={quest.title}
                                className="w-24 h-24 rounded-lg object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg">{quest.title}</h3>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-50 text-emerald-600">
                                  {quest.status === 'in_progress' ? t('communityDetail.statusInProgress') : t('communityDetail.statusActive')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{quest.description}</p>
                              <div className="flex gap-3 mt-2 text-sm">
                                <span className="text-indigo-600">⭐ {quest.reward_xp} XP</span>
                                <span className="text-gray-600">{quest.category}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Completed Quests (Archive) */}
                  {quests.filter((q) => q.status === 'completed').length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        {t('communityDetail.completedQuests')}
                      </h3>
                      {quests.filter((q) => q.status === 'completed').map((quest) => (
                        <div
                          key={quest.id}
                          onClick={() => navigate(`/quests/${quest.id}`)}
                          className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow mb-3 opacity-75"
                        >
                          <div className="flex gap-4">
                            {quest.image_url && (
                              <img
                                src={quest.image_url}
                                alt={quest.title}
                                className="w-24 h-24 rounded-lg object-cover grayscale-[0.3]"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg">{quest.title}</h3>
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-500">
                                  {t('communityDetail.statusCompleted')}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{quest.description}</p>
                              <div className="flex gap-3 mt-2 text-sm">
                                <span className="text-indigo-600">⭐ {quest.reward_xp} XP</span>
                                <span className="text-gray-600">{quest.category}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {activities.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-600">
                  {t('communityDetail.activityEmpty')}
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex gap-3">
                      {activity.profile?.avatar_url && (
                        <img
                          src={activity.profile.avatar_url}
                          alt={activity.profile.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {activity.profile?.name || t('communityDetail.unknown')} 
                          <span className="font-normal text-gray-600 ml-2">
                            {activity.activity_type === 'quest_completed' && `✓ ${t('communityDetail.activityCompleted')}`}
                            {activity.activity_type === 'achievement' && `🏆 ${t('communityDetail.activityAchievement')}`}
                            {activity.activity_type === 'joined_community' && `👋 ${t('communityDetail.activityJoined')}`}
                            {activity.activity_type === 'post' && `📝 ${t('communityDetail.activityPosted')}`}
                          </span>
                        </p>
                        {activity.title && <p className="text-gray-700 mt-1">{activity.title}</p>}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateNumeric(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col h-[600px]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">{t('communityDetail.chatEmpty')}</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      {msg.profile?.avatar_url && (
                        <img
                          src={msg.profile.avatar_url}
                          alt={msg.profile.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{msg.profile?.name}</p>
                        <p className="text-gray-700 text-sm">{msg.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {isMember ? (
                <div className="border-t border-gray-200 p-4 flex gap-2">
                  <input
                    type="text"
                    placeholder={t('communityDetail.chatPlaceholder')}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    disabled={sendingMessage}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageInput.trim()}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
                  >
                    {sendingMessage ? '...' : t('common.send')}
                  </button>
                </div>
              ) : (
                <div className="border-t border-gray-200 p-4 text-center text-gray-600 text-sm">
                  {t('communityDetail.chatJoinFirst')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CommunityDetailPage;
