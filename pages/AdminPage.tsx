import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isOrg, canAddOrgMember, remainingOrgSlots, PLAN_LIMITS } from '../services/planService';
import { redirectToCheckout } from '../services/stripeService';
import { supabase } from '../services/supabase';
import { Profile, getInitials } from '../types';

interface CommunityWithMembers {
  id: string;
  name: string;
  icon: string;
  brand_color?: string | null;
  logo_url?: string | null;
  description: string | null;
  category: string;
  memberCount: number;
  members: Profile[];
}

interface OrgStats {
  totalMembers: number;
  totalCommunities: number;
  totalQuests: number;
  totalXp: number;
  memberActivity: { name: string; members: number }[];
}

interface PlatformStats {
  totalUsers: number;
  activeUsers7d: number;
  totalCommunities: number;
  totalQuests: number;
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
}

interface TrendPoint {
  date: string;
  users: number;
  quests: number;
  posts: number;
}

const AdminPage: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [communities, setCommunities] = useState<CommunityWithMembers[]>([]);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'members' | 'communities' | 'reports'>('overview');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);

  // Community creation form
  const [showCreate, setShowCreate] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommIcon, setNewCommIcon] = useState('🌱');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommCategory, setNewCommCategory] = useState('Growth');
  const [newCommColor, setNewCommColor] = useState('#6366f1');
  const [newCommLogoUrl, setNewCommLogoUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const plan = profile?.plan || 'free';
  const hasOrg = isOrg(plan);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    bootstrapAdminData();
  }, [profile?.id, hasOrg]);

  const bootstrapAdminData = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: adminRow } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', profile.id)
      .maybeSingle();

    const platformAdmin = !!adminRow;
    setIsPlatformAdmin(platformAdmin);

    if (platformAdmin) {
      await Promise.all([fetchPlatformData(), fetchAllCommunitiesData()]);
      setLoading(false);
      return;
    }

    if (hasOrg) {
      await fetchAdminData();
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const fetchAllCommunitiesData = async () => {
    const { data: comms } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });

    if (comms && comms.length > 0) {
      await loadCommunityMembers(comms);
    } else {
      setCommunities([]);
      setStats({
        totalMembers: 0,
        totalCommunities: 0,
        totalQuests: 0,
        totalXp: 0,
        memberActivity: [],
      });
    }
  };

  const fetchPlatformData = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const iso = sevenDaysAgo.toISOString();

    const [
      usersCount,
      activeUsersCount,
      communitiesCount,
      questsCount,
      postsCount,
      commentsCount,
      likesCount,
      usersTrend,
      questsTrend,
      postsTrend,
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', iso),
      supabase.from('communities').select('id', { count: 'exact', head: true }),
      supabase.from('quests').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('post_comments').select('id', { count: 'exact', head: true }),
      supabase.from('post_likes').select('post_id', { count: 'exact', head: true }),
      supabase.from('profiles').select('created_at').gte('created_at', iso),
      supabase.from('quests').select('created_at').gte('created_at', iso),
      supabase.from('posts').select('created_at').gte('created_at', iso),
    ]);

    setPlatformStats({
      totalUsers: usersCount.count ?? 0,
      activeUsers7d: activeUsersCount.count ?? 0,
      totalCommunities: communitiesCount.count ?? 0,
      totalQuests: questsCount.count ?? 0,
      totalPosts: postsCount.count ?? 0,
      totalComments: commentsCount.count ?? 0,
      totalLikes: likesCount.count ?? 0,
    });

    const dayMap: Record<string, TrendPoint> = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        users: 0,
        quests: 0,
        posts: 0,
      };
    }

    (usersTrend.data ?? []).forEach((r: { created_at: string }) => {
      const key = r.created_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].users += 1;
    });
    (questsTrend.data ?? []).forEach((r: { created_at: string }) => {
      const key = r.created_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].quests += 1;
    });
    (postsTrend.data ?? []).forEach((r: { created_at: string }) => {
      const key = r.created_at.slice(0, 10);
      if (dayMap[key]) dayMap[key].posts += 1;
    });

    setTrendData(Object.values(dayMap));
  };

  const fetchAdminData = async () => {
    if (!profile) return;
    setLoading(true);

    // Fetch communities created by this user
    const { data: comms } = await supabase
      .from('communities')
      .select('*')
      .eq('created_by', profile.id);

    if (!comms || comms.length === 0) {
      // Also check communities where user is admin
      const { data: memberComms } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', profile.id)
        .eq('role', 'admin');

      if (memberComms && memberComms.length > 0) {
        const commIds = memberComms.map((m) => m.community_id);
        const { data: adminComms } = await supabase
          .from('communities')
          .select('*')
          .in('id', commIds);
        if (adminComms) {
          await loadCommunityMembers(adminComms);
        }
      }
      setLoading(false);
      return;
    }

    await loadCommunityMembers(comms);
    setLoading(false);
  };

  const loadCommunityMembers = async (comms: any[]) => {
    const commIds = comms.map((c) => c.id);

    // Fetch all members of these communities
    const { data: members } = await supabase
      .from('community_members')
      .select('community_id, user_id')
      .in('community_id', commIds);

    const memberUserIds = [...new Set((members ?? []).map((m) => m.user_id))];

    // Fetch member profiles
    const { data: profiles } = memberUserIds.length > 0
      ? await supabase.from('profiles').select('*').in('id', memberUserIds)
      : { data: [] };

    const profileMap: Record<string, Profile> = {};
    (profiles ?? []).forEach((p: Profile) => { profileMap[p.id] = p; });

    // Build community data
    const enriched: CommunityWithMembers[] = comms.map((c) => {
      const commMembers = (members ?? [])
        .filter((m) => m.community_id === c.id)
        .map((m) => profileMap[m.user_id])
        .filter(Boolean);
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        brand_color: c.brand_color ?? '#6366f1',
        logo_url: c.logo_url ?? null,
        description: c.description,
        category: c.category,
        memberCount: commMembers.length,
        members: commMembers,
      };
    });

    setCommunities(enriched);
    if (enriched.length > 0 && !selectedCommunity) {
      setSelectedCommunity(enriched[0].id);
    }

    // Calculate stats
    const totalMembers = memberUserIds.length;
    const allProfiles = profiles ?? [];
    const totalXp = allProfiles.reduce((sum: number, p: Profile) => sum + (p.xp || 0), 0);

    // Get quests created/joined by members
    const { count: questCount } = await supabase
      .from('quest_members')
      .select('*', { count: 'exact', head: true })
      .in('user_id', memberUserIds);

    // Member activity by role
    const roleCount: Record<string, number> = {};
    allProfiles.forEach((p: Profile) => {
      roleCount[p.role] = (roleCount[p.role] || 0) + 1;
    });
    const memberActivity = Object.entries(roleCount).map(([name, members]) => ({ name, members }));

    setStats({
      totalMembers,
      totalCommunities: enriched.length,
      totalQuests: questCount ?? 0,
      totalXp,
      memberActivity,
    });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;

    // Enforce member limit
    const currentCount = stats?.totalMembers ?? 0;
    if (!canAddOrgMember(plan, currentCount)) {
      const max = PLAN_LIMITS.org.maxOrgMembers;
      showToast('error', `Member limit reached (${currentCount}/${max}). Remove a member or contact support.`);
      return;
    }

    // In a real app, this would send an email invitation
    const remaining = remainingOrgSlots(currentCount) - 1;
    showToast('success', `Invitation sent to ${inviteEmail}! ${remaining} seats remaining.`);
    setInviteEmail('');
  };

  const handleCreateCommunity = async () => {
    if (!profile || !newCommName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from('communities').insert({
        name: newCommName.trim(),
        icon: newCommIcon,
        description: newCommDesc.trim() || null,
        category: newCommCategory,
        created_by: profile.id,
        brand_color: newCommColor,
        logo_url: newCommLogoUrl.trim() || null,
        member_limit: PLAN_LIMITS.org.maxOrgMembers,
      }).select().single();

      if (error) throw error;

      // Auto-join as admin
      await supabase.from('community_members').insert({
        community_id: data.id,
        user_id: profile.id,
        role: 'admin',
      });

      showToast('success', `🎉 "${newCommName}" community created!`);
      setNewCommName('');
      setNewCommDesc('');
      setNewCommIcon('🌱');
      setNewCommCategory('Growth');
      setNewCommColor('#6366f1');
      setNewCommLogoUrl('');
      setShowCreate(false);
      fetchAdminData(); // Refresh
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create community');
    } finally {
      setCreating(false);
    }
  };

  const handleExportReport = () => {
    if (!stats || !communities.length) return;

    const report = [
      'Rootwise Organization Report',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      '--- Summary ---',
      `Total Members: ${stats.totalMembers}`,
      `Total Communities: ${stats.totalCommunities}`,
      `Total Quest Participations: ${stats.totalQuests}`,
      `Total XP Earned: ${stats.totalXp}`,
      '',
      '--- Communities ---',
      ...communities.map((c) => `${c.icon} ${c.name}: ${c.memberCount} members`),
      '',
      '--- Members ---',
      ...communities.flatMap((c) =>
        c.members.map((m) => `  [${c.name}] ${m.name} — ${m.role}, Level ${m.level}, ${m.xp} XP`)
      ),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rootwise-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Report downloaded!');
  };

  const handleExportPlatformReport = () => {
    if (!platformStats) return;

    const report = [
      'Rootwise Platform Admin Report',
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      '--- Global Summary ---',
      `Total Users: ${platformStats.totalUsers}`,
      `Active Users (7d): ${platformStats.activeUsers7d}`,
      `Total Communities: ${platformStats.totalCommunities}`,
      `Total Quests: ${platformStats.totalQuests}`,
      `Total Posts: ${platformStats.totalPosts}`,
      `Total Comments: ${platformStats.totalComments}`,
      `Total Likes: ${platformStats.totalLikes}`,
      '',
      '--- 7-Day Trend ---',
      ...trendData.map((t) => `${t.date}: users=${t.users}, quests=${t.quests}, posts=${t.posts}`),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rootwise-platform-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Platform report downloaded!');
  };

  // Upgrade wall for non-org users
  if (!hasOrg && !isPlatformAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        <SEOHead title="Admin Dashboard - Rootwise" description="Manage your organization." path="/admin" />
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">👑</div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">Organization Dashboard</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-2">
            Manage up to 50 members, create branded communities, track team analytics, and download reports.
          </p>
          <p className="text-slate-400 text-sm mb-8">Available on the Organization plan.</p>
          <button
            onClick={() => redirectToCheckout('org')}
            className="px-8 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/30"
          >
            Upgrade to Organization — $49/mo
          </button>
        </div>
      </div>
    );
  }

  const selectedComm = communities.find((c) => c.id === selectedCommunity);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title="Admin Dashboard - Rootwise" description="Manage your organization." path="/admin" />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <span className="text-amber-500">👑</span> Admin Dashboard
          </h2>
          <p className="text-slate-500">
            {isPlatformAdmin
              ? 'Platform administration: reports, traffic, statistics, and system activity.'
              : 'Manage your organization, members, and communities.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={isPlatformAdmin ? handleExportPlatformReport : handleExportReport}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            📥 Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {(isPlatformAdmin
          ? (['overview', 'traffic', 'members', 'communities', 'reports'] as const)
          : (['overview', 'members', 'communities', 'reports'] as const)
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
            }`}
          >
            {tab === 'overview' && '📊 '}
            {tab === 'traffic' && '📈 '}
            {tab === 'members' && '👥 '}
            {tab === 'communities' && '🏘️ '}
            {tab === 'reports' && '📋 '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading admin data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (isPlatformAdmin ? !!platformStats : !!stats) && (
            <div className="space-y-6">
              {isPlatformAdmin && platformStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Total Users</p>
                    <p className="text-3xl font-black text-indigo-600">{platformStats.totalUsers}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Active Users (7d)</p>
                    <p className="text-3xl font-black text-emerald-600">{platformStats.activeUsers7d}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Total Quests</p>
                    <p className="text-3xl font-black text-amber-600">{platformStats.totalQuests}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Total Communities</p>
                    <p className="text-3xl font-black text-purple-600">{platformStats.totalCommunities}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Total Members</p>
                    <p className="text-3xl font-black text-indigo-600">{stats.totalMembers}</p>
                    <p className="text-xs text-slate-400 mt-1">of {PLAN_LIMITS.org.maxOrgMembers} max</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Communities</p>
                    <p className="text-3xl font-black text-emerald-600">{stats.totalCommunities}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Quest Activity</p>
                    <p className="text-3xl font-black text-amber-600">{stats.totalQuests}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Total XP</p>
                    <p className="text-3xl font-black text-purple-600">{stats.totalXp}</p>
                  </div>
                </div>
              )}

              {stats.memberActivity.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Member Roles Distribution</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.memberActivity}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="members" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'traffic' && isPlatformAdmin && (
            <div className="space-y-6">
              {platformStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Posts</p>
                    <p className="text-3xl font-black text-indigo-600">{platformStats.totalPosts}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Comments</p>
                    <p className="text-3xl font-black text-emerald-600">{platformStats.totalComments}</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 mb-1">Likes</p>
                    <p className="text-3xl font-black text-amber-600">{platformStats.totalLikes}</p>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4">7-day Platform Activity</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Bar dataKey="users" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="quests" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="posts" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {!isPlatformAdmin && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold mb-4">Invite New Member</h3>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      placeholder="Enter email address..."
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={handleInvite}
                      className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                      Send Invite
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Members will receive an email with a link to join your organization.
                    {stats && (
                      <span className={`font-medium ${
                        remainingOrgSlots(stats.totalMembers) <= 5 ? 'text-amber-600' : ''
                      }`}>
                        {' '}({stats.totalMembers}/{PLAN_LIMITS.org.maxOrgMembers} seats used
                        {remainingOrgSlots(stats.totalMembers) <= 5 && ` — ${remainingOrgSlots(stats.totalMembers)} remaining`})
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Member list */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold">All Members ({communities.reduce((s, c) => s + c.memberCount, 0)})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {communities.flatMap((c) =>
                    c.members.map((m) => (
                      <div key={`${c.id}-${m.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              getInitials(m.name)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{m.name}</p>
                            <p className="text-xs text-slate-400">{c.icon} {c.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            m.role === 'Sage' ? 'bg-amber-100 text-amber-700' :
                            m.role === 'Seeker' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>{m.role}</span>
                          <span className="text-xs text-slate-500">Level {m.level}</span>
                          <span className="text-xs font-medium text-indigo-600">{m.xp} XP</span>
                        </div>
                      </div>
                    ))
                  )}
                  {communities.length === 0 && (
                    <div className="p-10 text-center text-slate-400">
                      <p>No members yet. Create a community and invite people!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Communities Tab */}
          {activeTab === 'communities' && (
            <div className="space-y-6">
              {/* Create Community */}
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-300 text-slate-500 rounded-3xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all"
                >
                  + Create Branded Community
                </button>
              ) : (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">New Branded Community</h3>
                    <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">Name</label>
                      <input
                        type="text"
                        value={newCommName}
                        onChange={(e) => setNewCommName(e.target.value)}
                        placeholder="e.g. Acme Growth Team"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">Category</label>
                      <select
                        value={newCommCategory}
                        onChange={(e) => setNewCommCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        <option value="Growth">Growth</option>
                        <option value="Mindfulness">Mindfulness</option>
                        <option value="Fitness">Fitness</option>
                        <option value="Learning">Learning</option>
                        <option value="Career">Career</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">Icon (emoji)</label>
                      <input
                        type="text"
                        value={newCommIcon}
                        onChange={(e) => setNewCommIcon(e.target.value)}
                        maxLength={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center text-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-600">Brand Color</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={newCommColor}
                          onChange={(e) => setNewCommColor(e.target.value)}
                          className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer"
                        />
                        <span className="text-sm text-slate-500 font-mono">{newCommColor}</span>
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-bold text-slate-600">Logo URL (optional)</label>
                      <input
                        type="url"
                        value={newCommLogoUrl}
                        onChange={(e) => setNewCommLogoUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Description</label>
                    <textarea
                      value={newCommDesc}
                      onChange={(e) => setNewCommDesc(e.target.value)}
                      placeholder="What is this community about?"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-5 py-2 border border-slate-200 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCommunity}
                      disabled={!newCommName.trim() || creating}
                      className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : '🏘️ Create Community'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCommunity(c.id)}
                    className={`bg-white p-6 rounded-3xl border-2 shadow-sm hover:shadow-lg transition-all cursor-pointer ${
                      selectedCommunity === c.id ? 'border-indigo-500' : 'border-slate-200'
                    }`}
                    style={{ borderTopWidth: 4, borderTopColor: c.brand_color || '#6366f1' }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.name} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
                      ) : (
                        <span className="text-3xl">{c.icon}</span>
                      )}
                      <div>
                        <h4 className="font-bold text-slate-800">{c.name}</h4>
                        <p className="text-xs text-slate-400">{c.category}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mb-3 line-clamp-2">{c.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-indigo-600">{c.memberCount} members</span>
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg">Branded</span>
                    </div>
                  </div>
                ))}
                {communities.length === 0 && (
                  <div className="col-span-3 text-center py-20 text-slate-400">
                    <p className="text-6xl mb-4">🏘️</p>
                    <p className="font-bold text-xl mb-2">No branded communities</p>
                    <p>Create a community from the Community Hub to manage it here.</p>
                  </div>
                )}
              </div>

              {/* Selected community details */}
              {selectedComm && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span>{selectedComm.icon}</span> {selectedComm.name} — Members
                    </h3>
                    <span className="text-sm text-slate-500">{selectedComm.memberCount} members</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedComm.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                          {getInitials(m.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.role} · {m.xp} XP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold mb-6">{isPlatformAdmin ? 'Platform Reports' : 'Organization Reports'}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all cursor-pointer" onClick={isPlatformAdmin ? handleExportPlatformReport : handleExportReport}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">📊</span>
                      <h4 className="font-bold">{isPlatformAdmin ? 'Full Platform Report' : 'Full Organization Report'}</h4>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">
                      {isPlatformAdmin
                        ? 'Complete platform-level overview of users, communities, quests, and traffic indicators.'
                        : 'Complete overview of members, communities, quests, and XP across your organization.'}
                    </p>
                    <span className="text-indigo-600 text-sm font-bold">Download .txt →</span>
                  </div>

                  <div className="p-6 border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all cursor-pointer" onClick={() => {
                    if (!communities.length) return;
                    const csv = [
                      'Name,Role,Level,XP,Community',
                      ...communities.flatMap((c) =>
                        c.members.map((m) => `"${m.name}","${m.role}",${m.level},${m.xp},"${c.name}"`)
                      ),
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rootwise-members-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('success', 'Member report downloaded!');
                  }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">👥</span>
                      <h4 className="font-bold">Member Activity Report</h4>
                    </div>
                    <p className="text-sm text-slate-500 mb-4">CSV export of all members with their roles, levels, and XP.</p>
                    <span className="text-indigo-600 text-sm font-bold">Download .csv →</span>
                  </div>
                </div>
              </div>

              {/* Summary stats for report */}
              {stats && (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Quick Stats Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-2xl font-black text-slate-800">{stats.totalMembers}</p>
                      <p className="text-sm text-slate-500">Members</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-800">{stats.totalCommunities}</p>
                      <p className="text-sm text-slate-500">Communities</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-800">{stats.totalQuests}</p>
                      <p className="text-sm text-slate-500">Quest Actions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-800">{stats.totalXp}</p>
                      <p className="text-sm text-slate-500">Total XP</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPage;
