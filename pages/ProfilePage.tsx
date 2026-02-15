import React, { useEffect, useMemo, useRef, useState } from 'react';
import SEOHead from '../components/SEOHead';
import PlanBadge from '../components/PlanBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQuests } from '../hooks/useQuests';
import { usePlan } from '../hooks/usePlan';
import { Follower, Friendship, Post, PostComment, PostLike, Profile, getInitials, profileToUser } from '../types';
import { redirectToCheckout, openBillingPortal } from '../services/stripeService';
import { PLAN_FEATURES, BETA_MODE } from '../services/planService';
import { supabase } from '../services/supabase';

type ProfileLite = Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role'>;
type PostWithMeta = Post & {
  author: ProfileLite;
  comments?: CommentWithMeta[];
  likeCount: number;
  likedByMe: boolean;
};
type CommentWithMeta = PostComment & { author: ProfileLite };

const ProfilePage: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { showToast } = useToast();
  const { quests } = useQuests();
  const planInfo = usePlan();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'friends' | 'followers' | 'about' | 'photos'>('posts');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bannerDragRef = useRef<HTMLDivElement>(null);

  const [editName, setEditName] = useState(profile?.name ?? '');
  const [editAge, setEditAge] = useState(profile?.age ?? 0);
  const [editRole, setEditRole] = useState<'Sage' | 'Seeker' | 'Hybrid'>(profile?.role ?? 'Hybrid');
  const [editSkills, setEditSkills] = useState<string[]>(profile?.skills ?? []);
  const [editInterests, setEditInterests] = useState<string[]>(profile?.interests ?? []);
  const [editAvatar, setEditAvatar] = useState(profile?.avatar_url ?? '');
  const [editBanner, setEditBanner] = useState(profile?.banner_url ?? '');
  const [editBio, setEditBio] = useState(profile?.bio ?? '');
  const [editBannerPosition, setEditBannerPosition] = useState({
    x: profile?.banner_position_x ?? 50,
    y: profile?.banner_position_y ?? 50,
  });

  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [postDraft, setPostDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');
  const [followers, setFollowers] = useState<ProfileLite[]>([]);
  const [following, setFollowing] = useState<ProfileLite[]>([]);
  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Friendship[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Friendship[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<Record<string, ProfileLite>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileLite[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    </div>
  );

  const currentUser = profileToUser(profile);
  const completedQuests = quests.filter(
    (q) => q.status === 'completed' && q.participants.includes(profile.id)
  ).length;

  const stats = {
    posts: posts.length,
    friends: friends.length,
    followers: followers.length,
    following: following.length,
  };

  const pendingOutgoingIds = new Set(outgoingRequests.map((req) => req.user_id_b));

  const profileLite = useMemo<ProfileLite>(() => ({
    id: profile.id,
    name: profile.name,
    avatar_url: profile.avatar_url,
    role: profile.role,
  }), [profile.id, profile.name, profile.avatar_url, profile.role]);

  const startEditing = () => {
    setEditName(profile.name);
    setEditAge(profile.age ?? 0);
    setEditRole(profile.role);
    setEditSkills([...profile.skills]);
    setEditInterests([...profile.interests]);
    setEditAvatar(profile.avatar_url ?? '');
    setEditBanner(profile.banner_url ?? '');
    setEditBio(profile.bio ?? '');
    setEditBannerPosition({
      x: profile.banner_position_x ?? 50,
      y: profile.banner_position_y ?? 50,
    });
    setActiveTab('about');
    setIsEditingProfile(true);
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleProfileUpdate called');
    await updateProfile({
      name: editName,
      age: editAge,
      role: editRole,
      skills: editSkills,
      interests: editInterests,
      avatar_url: editAvatar || null,
      banner_url: editBanner || null,
      banner_position_x: Math.round(editBannerPosition.x),
      banner_position_y: Math.round(editBannerPosition.y),
      bio: editBio || null,
    });
    showToast('success', 'Profile updated!');
    setIsEditingProfile(false);
  };

  const handleSkillAdd = (skill: string) => {
    if (skill && !editSkills.includes(skill)) {
      setEditSkills([...editSkills, skill]);
    }
  };

  const handleInterestAdd = (interest: string) => {
    if (interest && !editInterests.includes(interest)) {
      setEditInterests([...editInterests, interest]);
    }
  };

  const fetchProfilesByIds = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, role')
      .in('id', ids);
    if (error) {
      console.error('fetchProfilesByIds error:', error.message);
      return [];
    }
    return (data as ProfileLite[]) ?? [];
  };

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('id, user_id, content, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('loadPosts error:', error.message);
      return;
    }

    const postRows = (data as Post[]) ?? [];
    const postIds = postRows.map((p) => p.id);
    let commentsMap: Record<string, CommentWithMeta[]> = {};
    let likesMap: Record<string, { count: number; likedByMe: boolean }> = {};

    if (postIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (!likesError && likesData) {
        const likeRows = likesData as PostLike[];
        likesMap = likeRows.reduce<Record<string, { count: number; likedByMe: boolean }>>((acc, like) => {
          if (!acc[like.post_id]) {
            acc[like.post_id] = { count: 0, likedByMe: false };
          }
          acc[like.post_id].count += 1;
          if (like.user_id === profile.id) {
            acc[like.post_id].likedByMe = true;
          }
          return acc;
        }, {});
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (!commentsError && commentsData) {
        const commentRows = commentsData as PostComment[];
        const authorIds = Array.from(new Set(commentRows.map((c) => c.user_id)));
        const authors = await fetchProfilesByIds(authorIds);
        const authorMap = new Map(authors.map((a) => [a.id, a]));

        commentsMap = commentRows.reduce<Record<string, CommentWithMeta[]>>((acc, comment) => {
          const author = authorMap.get(comment.user_id) || profileLite;
          const entry = { ...comment, author };
          if (!acc[comment.post_id]) acc[comment.post_id] = [];
          acc[comment.post_id].push(entry);
          return acc;
        }, {});
      }
    }

    const mapped = postRows.map((post) => ({
      ...post,
      author: profileLite,
      comments: commentsMap[post.id] ?? [],
      likeCount: likesMap[post.id]?.count ?? 0,
      likedByMe: likesMap[post.id]?.likedByMe ?? false,
    }));
    setPosts(mapped);
  };

  const loadSocial = async () => {
    setSocialLoading(true);

    const [{ data: followerRows }, { data: followingRows }] = await Promise.all([
      supabase
        .from('followers')
        .select('follower_id')
        .eq('user_id', profile.id),
      supabase
        .from('followers')
        .select('user_id')
        .eq('follower_id', profile.id),
    ]);

    const followerIds = (followerRows as Follower[] | null)?.map((row) => row.follower_id) ?? [];
    const followingIds = (followingRows as Follower[] | null)?.map((row) => row.user_id) ?? [];

    const [followersList, followingList] = await Promise.all([
      fetchProfilesByIds(followerIds),
      fetchProfilesByIds(followingIds),
    ]);

    setFollowers(followersList);
    setFollowing(followingList);

    const { data: friendRows } = await supabase
      .from('friendships')
      .select('id, user_id_a, user_id_b, status, created_at, updated_at')
      .eq('status', 'accepted')
      .or(`user_id_a.eq.${profile.id},user_id_b.eq.${profile.id}`);

    const friendships = (friendRows as Friendship[] | null) ?? [];
    const friendIds = friendships.map((f) => (f.user_id_a === profile.id ? f.user_id_b : f.user_id_a));
    setFriends(await fetchProfilesByIds(friendIds));

    const [{ data: incoming }, { data: outgoing }] = await Promise.all([
      supabase
        .from('friendships')
        .select('id, user_id_a, user_id_b, status, created_at, updated_at')
        .eq('status', 'pending')
        .eq('user_id_b', profile.id),
      supabase
        .from('friendships')
        .select('id, user_id_a, user_id_b, status, created_at, updated_at')
        .eq('status', 'pending')
        .eq('user_id_a', profile.id),
    ]);

    setIncomingRequests((incoming as Friendship[] | null) ?? []);
    setOutgoingRequests((outgoing as Friendship[] | null) ?? []);

    const requesterIds = Array.from(new Set([
      ...((incoming as Friendship[] | null) ?? []).map((req) => req.user_id_a),
      ...((outgoing as Friendship[] | null) ?? []).map((req) => req.user_id_b),
    ]));
    const requestProfilesList = await fetchProfilesByIds(requesterIds);
    setRequestProfiles(
      requestProfilesList.reduce<Record<string, ProfileLite>>((acc, person) => {
        acc[person.id] = person;
        return acc;
      }, {})
    );

    setSocialLoading(false);
  };

  useEffect(() => {
    void loadPosts();
    void loadSocial();
  }, [profile.id]);

  const uploadProfileMedia = async (file: File, kind: 'avatar' | 'banner') => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${profile.id}/${kind}-${Date.now()}.${ext}`;
    const setUploading = kind === 'avatar' ? setIsUploadingAvatar : setIsUploadingBanner;
    setUploading(true);

    const { error } = await supabase.storage
      .from('profile-media')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      console.error('uploadProfileMedia error:', error.message);
      showToast('error', 'Upload failed. Please try again.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
    if (data?.publicUrl) {
      if (kind === 'avatar') setEditAvatar(data.publicUrl);
      if (kind === 'banner') {
        setEditBanner(data.publicUrl);
        setEditBannerPosition({ x: 50, y: 50 });
      }
      showToast('success', 'Image updated!');
    }
    setUploading(false);
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const updateBannerPositionFromEvent = (clientX: number, clientY: number) => {
    const rect = bannerDragRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setEditBannerPosition({
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
    });
  };

  const handleBannerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditingProfile || !(editBanner || profile.banner_url)) return;
    setIsDraggingBanner(true);
    updateBannerPositionFromEvent(e.clientX, e.clientY);
  };

  const handleBannerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBanner) return;
    updateBannerPositionFromEvent(e.clientX, e.clientY);
  };

  const handleBannerPointerUp = () => {
    if (!isDraggingBanner) return;
    setIsDraggingBanner(false);
  };

  const handlePostCreate = async () => {
    if (!postDraft.trim()) return;
    const { error } = await supabase
      .from('posts')
      .insert({ user_id: profile.id, content: postDraft.trim() });
    if (error) {
      showToast('error', 'Unable to post right now.');
      return;
    }
    setPostDraft('');
    await loadPosts();
  };

  const handleCommentCreate = async (postId: string) => {
    const content = commentDrafts[postId]?.trim();
    if (!content) return;
    const { error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: profile.id, content });
    if (error) {
      showToast('error', 'Unable to comment right now.');
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    await loadPosts();
  };

  const handleLikeToggle = async (postId: string, liked: boolean) => {
    if (liked) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', profile.id);
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: profile.id });
    }
    await loadPosts();
  };

  const startEditPost = (post: PostWithMeta) => {
    setEditingPostId(post.id);
    setEditingPostContent(post.content);
  };

  const handlePostSave = async (postId: string) => {
    const content = editingPostContent.trim();
    if (!content) return;
    const { error } = await supabase
      .from('posts')
      .update({ content })
      .eq('id', postId)
      .eq('user_id', profile.id);
    if (error) {
      showToast('error', 'Unable to update the post.');
      return;
    }
    setEditingPostId(null);
    setEditingPostContent('');
    await loadPosts();
  };

  const handlePostDelete = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', profile.id);
    if (error) {
      showToast('error', 'Unable to delete the post.');
      return;
    }
    await loadPosts();
  };

  const handleFollowToggle = async (targetId: string) => {
    const isFollowing = following.some((p) => p.id === targetId);
    if (isFollowing) {
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', profile.id)
        .eq('user_id', targetId);
    } else {
      await supabase
        .from('followers')
        .insert({ follower_id: profile.id, user_id: targetId });
    }
    await loadSocial();
  };

  const handleFriendRequest = async (targetId: string) => {
    await supabase
      .from('friendships')
      .insert({ user_id_a: profile.id, user_id_b: targetId });
    await loadSocial();
  };

  const handleFriendResponse = async (requestId: string, status: 'accepted' | 'declined') => {
    await supabase
      .from('friendships')
      .update({ status })
      .eq('id', requestId);
    await loadSocial();
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, role')
      .ilike('name', `%${query}%`)
      .limit(8);
    if (error) {
      console.error('handleSearch error:', error.message);
      return;
    }
    const results = (data as ProfileLite[]).filter((item) => item.id !== profile.id);
    setSearchResults(results);
  };

  const bannerPosition = isEditingProfile
    ? editBannerPosition
    : {
      x: profile.banner_position_x ?? 50,
      y: profile.banner_position_y ?? 50,
    };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={`${currentUser.name} - Rootwise Profile`} description="Your Rootwise profile." path="/profile" />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          ref={bannerDragRef}
          className={`relative h-64 bg-slate-200 ${isEditingProfile ? (isDraggingBanner ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onPointerDown={handleBannerPointerDown}
          onPointerMove={handleBannerPointerMove}
          onPointerUp={handleBannerPointerUp}
          onPointerLeave={handleBannerPointerUp}
        >
          {profile.banner_url || editBanner ? (
            <img
              src={editBanner || profile.banner_url || ''}
              alt="Profile banner"
              className="w-full h-full object-cover bg-slate-200"
              style={{ objectPosition: `${bannerPosition.x}% ${bannerPosition.y}%` }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          )}

          {isEditingProfile && (editBanner || profile.banner_url) && (
            <div className="absolute left-6 bottom-4 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
              Drag to reposition
            </div>
          )}

          {isEditingProfile && (
            <button
              onClick={() => bannerInputRef.current?.click()}
              className="absolute bottom-4 right-6 px-4 py-2 bg-white/90 text-slate-700 rounded-xl text-sm font-bold shadow-sm"
              disabled={isUploadingBanner}
            >
              {isUploadingBanner ? 'Uploading...' : 'Change Cover'}
            </button>
          )}
        </div>

        <div className="px-8 pb-8">
          <div className="-mt-14 flex flex-col lg:flex-row lg:items-end gap-6">
            <div className="relative">
              {currentUser.avatar ? (
                <img
                  src={editAvatar || currentUser.avatar}
                  alt={currentUser.name}
                  className="w-32 h-32 rounded-3xl border-4 border-white object-cover shadow-lg bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-32 h-32 rounded-3xl border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold ${currentUser.avatar ? 'hidden' : ''}`}>
                {getInitials(currentUser.name)}
              </div>
              {isEditingProfile && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-2 right-2 px-3 py-1.5 bg-white text-slate-700 rounded-full text-xs font-bold shadow-md"
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? 'Uploading...' : 'Change'}
                </button>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-3xl font-bold text-slate-800">{currentUser.name}</h2>
              <p className="text-slate-500">{profile.role}  {profile.age ?? 'Age not set'}</p>
              {profile.bio && !isEditingProfile && (
                <p className="mt-3 text-sm text-slate-600 max-w-2xl">{profile.bio}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isEditingProfile ? (
                <button
                  onClick={startEditing}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    form="profile-form"
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{stats.posts}</p>
              <p className="text-xs text-slate-500">Posts</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{stats.friends}</p>
              <p className="text-xs text-slate-500">Friends</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{stats.followers}</p>
              <p className="text-xs text-slate-500">Followers</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{stats.following}</p>
              <p className="text-xs text-slate-500">Following</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            {[
              { key: 'posts', label: 'Posts' },
              { key: 'friends', label: 'Friends' },
              { key: 'followers', label: 'Followers' },
              { key: 'about', label: 'About' },
              { key: 'photos', label: 'Photos' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-bold mb-4">Intro</h4>
                <p className="text-sm text-slate-500 mb-4">
                  {profile.bio || 'Add a short bio to help people understand your story.'}
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Role</span>
                    <span className="font-semibold text-slate-700">{profile.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Age</span>
                    <span className="font-semibold text-slate-700">{profile.age ?? 'Not set'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold mb-4">Legacy Stats</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Plan</span>
                    <div className="flex items-center gap-2">
                      <PlanBadge plan={profile.plan || 'free'} isBeta={BETA_MODE} size="md" />
                      {BETA_MODE && (!profile.plan || profile.plan === 'free') && (
                        <span className="text-[10px] text-emerald-600 font-medium">Pro active</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total XP</span>
                    <span className="font-bold">{currentUser.xp}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Level</span>
                    <span className="font-bold">{profile.level}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Quests Completed</span>
                    <span className="font-bold">{completedQuests}</span>
                  </div>
                </div>
              </div>

              {planInfo.subscription ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <h4 className="font-bold mb-3">Subscription</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Status</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        planInfo.subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        planInfo.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                        planInfo.subscription.status === 'cancelling' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {planInfo.subscription.status.charAt(0).toUpperCase() + planInfo.subscription.status.slice(1)}
                      </span>
                    </div>
                    {planInfo.subscription.current_period_end && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">
                          {planInfo.subscription.status === 'cancelling' ? 'Ends' : 'Renews'}
                        </span>
                        <span className="text-sm font-medium">
                          {new Date(planInfo.subscription.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      setBillingLoading(true);
                      await openBillingPortal();
                      setBillingLoading(false);
                    }}
                    disabled={billingLoading}
                    className="w-full mt-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:border-indigo-400 hover:text-indigo-600 transition-all disabled:opacity-50"
                  >
                    {billingLoading ? 'Loading...' : ' Manage Billing'}
                  </button>
                </div>
              ) : (
                (!profile.plan || profile.plan === 'free') && (
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white">
                    <h4 className="font-bold mb-2">Upgrade to Pro</h4>
                    <p className="text-sm text-indigo-100 mb-3">Unlock all features:</p>
                    <ul className="space-y-1.5 mb-4">
                      {PLAN_FEATURES.pro.map((f) => (
                        <li key={f.label} className="flex items-center gap-2 text-sm text-indigo-100">
                          <span className="text-amber-300"></span> {f.label}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => redirectToCheckout('pro')}
                      className="w-full py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors"
                    >
                      {BETA_MODE ? ' Free During Beta' : 'Upgrade  $9.99/mo'}
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="lg:col-span-2">
              {activeTab === 'posts' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <textarea
                      value={postDraft}
                      onChange={(e) => setPostDraft(e.target.value)}
                      placeholder="Share an update or a learning win..."
                      className="w-full min-h-[120px] resize-none border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-xs text-slate-400">Keep it friendly and focused on learning.</span>
                      <button
                        onClick={handlePostCreate}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                      >
                        Post
                      </button>
                    </div>
                  </div>

                  {posts.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <p className="text-4xl mb-2"></p>
                      <p>No posts yet. Share your first update!</p>
                    </div>
                  )}

                  {posts.map((post) => (
                    <div key={post.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                            {post.author.avatar_url ? (
                              <img src={post.author.avatar_url} alt={post.author.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                {getInitials(post.author.name)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{post.author.name}</p>
                            <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        {post.user_id === profile.id && (
                          <div className="flex gap-2">
                            {editingPostId === post.id ? (
                              <>
                                <button
                                  onClick={() => handlePostSave(post.id)}
                                  className="text-xs font-bold text-indigo-600"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPostId(null);
                                    setEditingPostContent('');
                                  }}
                                  className="text-xs font-bold text-slate-400"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditPost(post)}
                                  className="text-xs font-bold text-slate-500"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handlePostDelete(post.id)}
                                  className="text-xs font-bold text-red-500"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {editingPostId === post.id ? (
                        <textarea
                          value={editingPostContent}
                          onChange={(e) => setEditingPostContent(e.target.value)}
                          className="mt-4 w-full min-h-[120px] resize-none border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="mt-4 text-sm text-slate-700 whitespace-pre-line">{post.content}</p>
                      )}

                      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                        <button
                          onClick={() => handleLikeToggle(post.id, post.likedByMe)}
                          className={`flex items-center gap-1 font-semibold ${post.likedByMe ? 'text-rose-500' : 'text-slate-500'}`}
                        >
                          {post.likedByMe ? '♥' : '♡'} {post.likeCount}
                        </button>
                        <span>{post.comments?.length ?? 0} Comments</span>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
                        {(post.comments || []).map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                              {comment.author.avatar_url ? (
                                <img src={comment.author.avatar_url} alt={comment.author.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-indigo-500">
                                  {getInitials(comment.author.name)}
                                </div>
                              )}
                            </div>
                            <div className="bg-slate-50 rounded-xl px-3 py-2 flex-1">
                              <p className="text-xs font-bold text-slate-700">{comment.author.name}</p>
                              <p className="text-xs text-slate-600">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write a comment..."
                            className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleCommentCreate(post.id)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold"
                          >
                            Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'friends' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h4 className="font-bold mb-3">Friend requests</h4>
                    {incomingRequests.length === 0 && (
                      <p className="text-sm text-slate-400">No friend requests right now.</p>
                    )}
                    <div className="space-y-3">
                      {incomingRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden">
                              {requestProfiles[req.user_id_a]?.avatar_url ? (
                                <img
                                  src={requestProfiles[req.user_id_a]?.avatar_url || ''}
                                  alt={requestProfiles[req.user_id_a]?.name || 'Requester'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-indigo-500">
                                  {getInitials(requestProfiles[req.user_id_a]?.name || 'User')}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {requestProfiles[req.user_id_a]?.name || 'New request'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {requestProfiles[req.user_id_a]?.role || 'Member'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleFriendResponse(req.id, 'accepted')}
                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleFriendResponse(req.id, 'declined')}
                              className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold">Friends</h4>
                      <span className="text-xs text-slate-400">{friends.length} total</span>
                    </div>
                    {friends.length === 0 ? (
                      <p className="text-sm text-slate-400">No friends yet. Use search below to connect.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {friends.map((friend) => (
                          <div key={friend.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                  {getInitials(friend.name)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{friend.name}</p>
                              <p className="text-xs text-slate-400">{friend.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h4 className="font-bold mb-3">Find people</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name"
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm"
                      />
                      <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                      >
                        Search
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {searchResults.map((person) => (
                        <div key={person.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                              {person.avatar_url ? (
                                <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                  {getInitials(person.name)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{person.name}</p>
                              <p className="text-xs text-slate-400">{person.role}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {friends.some((f) => f.id === person.id) ? (
                              <span className="text-xs text-emerald-600 font-bold">Friends</span>
                            ) : pendingOutgoingIds.has(person.id) ? (
                              <span className="text-xs text-slate-400 font-bold">Request sent</span>
                            ) : (
                              <button
                                onClick={() => handleFriendRequest(person.id)}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                              >
                                Add friend
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {searchQuery && searchResults.length === 0 && (
                        <p className="text-sm text-slate-400">No results. Try a different name.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'followers' && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold">Followers</h4>
                      <span className="text-xs text-slate-400">{followers.length} total</span>
                    </div>
                    {followers.length === 0 ? (
                      <p className="text-sm text-slate-400">No followers yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {followers.map((person) => (
                          <div key={person.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                              {person.avatar_url ? (
                                <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                  {getInitials(person.name)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{person.name}</p>
                              <p className="text-xs text-slate-400">{person.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold">Following</h4>
                      <span className="text-xs text-slate-400">{following.length} total</span>
                    </div>
                    {following.length === 0 ? (
                      <p className="text-sm text-slate-400">You are not following anyone yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {following.map((person) => (
                          <div key={person.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                                {person.avatar_url ? (
                                  <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                    {getInitials(person.name)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{person.name}</p>
                                <p className="text-xs text-slate-400">{person.role}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleFollowToggle(person.id)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold"
                            >
                              Unfollow
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <h4 className="font-bold mb-3">Find people to follow</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name"
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm"
                      />
                      <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold"
                      >
                        Search
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {searchResults.map((person) => (
                        <div key={person.id} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden">
                              {person.avatar_url ? (
                                <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white bg-indigo-500">
                                  {getInitials(person.name)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{person.name}</p>
                              <p className="text-xs text-slate-400">{person.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleFollowToggle(person.id)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                          >
                            {following.some((p) => p.id === person.id) ? 'Unfollow' : 'Follow'}
                          </button>
                        </div>
                      ))}
                      {searchQuery && searchResults.length === 0 && (
                        <p className="text-sm text-slate-400">No results. Try a different name.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'about' && (
                <div className="space-y-6">
                  {!isEditingProfile ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6">
                      <h4 className="font-bold mb-4">About</h4>
                      <p className="text-sm text-slate-600 mb-4">
                        {profile.bio || 'Add your story and what you want to learn or share.'}
                      </p>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-bold text-slate-700">Skills</h5>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentUser.skills.map((s) => (
                              <span key={s} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                                {s}
                              </span>
                            ))}
                            {currentUser.skills.length === 0 && (
                              <span className="text-xs text-slate-400">No skills added yet.</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-slate-700">Interests</h5>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentUser.interests.map((i) => (
                              <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-xs font-medium">
                                {i}
                              </span>
                            ))}
                            {currentUser.interests.length === 0 && (
                              <span className="text-xs text-slate-400">No interests added yet.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form id="profile-form" onSubmit={handleProfileUpdate} className="space-y-6">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">Full Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600">Age</label>
                            <input
                              type="number"
                              value={editAge}
                              onChange={(e) => setEditAge(parseInt(e.target.value) || 0)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600">Bio</label>
                          <textarea
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600">Role</label>
                          <div className="flex gap-2">
                            {(['Sage', 'Seeker', 'Hybrid'] as const).map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setEditRole(r)}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                                  editRole === r
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600">Skills (Add new)</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {editSkills.map((s) => (
                              <span key={s} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-sm flex items-center gap-2">
                                {s}
                                <button
                                  type="button"
                                  onClick={() => setEditSkills(editSkills.filter((sk) => sk !== s))}
                                  className="hover:text-red-500"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Type and press Enter..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSkillAdd((e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-600">Interests (Add new)</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {editInterests.map((i) => (
                              <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-sm flex items-center gap-2">
                                {i}
                                <button
                                  type="button"
                                  onClick={() => setEditInterests(editInterests.filter((inter) => inter !== i))}
                                  className="hover:text-red-500"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Type and press Enter..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInterestAdd((e.target as HTMLInputElement).value);
                                (e.target as HTMLInputElement).value = '';
                              }
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {activeTab === 'photos' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h4 className="font-bold mb-4">Photos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl overflow-hidden border border-slate-200">
                      <div className="bg-slate-100 text-xs text-slate-500 px-3 py-2">Cover</div>
                      {profile.banner_url ? (
                        <img
                          src={profile.banner_url}
                          alt="Cover"
                          className="w-full h-40 object-cover"
                          style={{ objectPosition: `${profile.banner_position_x ?? 50}% ${profile.banner_position_y ?? 50}%` }}
                        />
                      ) : (
                        <div className="w-full h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                      )}
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-slate-200">
                      <div className="bg-slate-100 text-xs text-slate-500 px-3 py-2">Profile</div>
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="w-full h-40 object-cover" />
                      ) : (
                        <div className="w-full h-40 bg-slate-100 flex items-center justify-center text-3xl font-bold text-indigo-500">
                          {getInitials(profile.name)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {socialLoading && (
                <div className="text-center text-sm text-slate-400 mt-6">Loading social activity...</div>
              )}
            </div>
          </div>
        </div>

        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadProfileMedia(file, 'avatar');
          }}
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadProfileMedia(file, 'banner');
          }}
        />
      </div>
    </div>
  );
};

export default ProfilePage;
