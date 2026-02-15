import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Follower, Friendship, Post, PostComment, PostLike, Profile, getInitials } from '../types';
import { supabase } from '../services/supabase';

type ProfileLite = Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role'>;
type CommentWithMeta = PostComment & { author: ProfileLite };
type PostWithMeta = Post & {
  author: ProfileLite;
  comments?: CommentWithMeta[];
  likeCount: number;
  likedByMe: boolean;
};

const PublicProfilePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const supabaseAny = supabase as any;

  const viewerLite = useMemo<ProfileLite | null>(() => {
    if (!profile) return null;
    return {
      id: profile.id,
      name: profile.name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    };
  }, [profile]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        setViewedProfile(null);
        setLoading(false);
        return;
      }
      setViewedProfile(data as Profile);
      setLoading(false);
    };
    void load();
  }, [id]);

  const fetchProfilesByIds = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, role')
      .in('id', ids);
    if (error) return [];
    return (data as ProfileLite[]) ?? [];
  };

  const loadStats = async () => {
    if (!id) return;
    const [{ count: followers }, { count: following }, { count: friendsA }, { count: friendsB }] = await Promise.all([
      supabase
        .from('followers')
        .select('follower_id', { count: 'exact', head: true })
        .eq('user_id', id),
      supabase
        .from('followers')
        .select('user_id', { count: 'exact', head: true })
        .eq('follower_id', id),
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .eq('user_id_a', id),
      supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .eq('user_id_b', id),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
    setFriendsCount((friendsA ?? 0) + (friendsB ?? 0));
  };

  const loadPosts = async () => {
    if (!id || !viewedProfile) return;
    const { data, error } = await supabase
      .from('posts')
      .select('id, user_id, content, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    if (error) return;

    const postRows = (data as Post[]) ?? [];
    const postIds = postRows.map((p) => p.id);
    let commentsMap: Record<string, CommentWithMeta[]> = {};
    let likesMap: Record<string, { count: number; likedByMe: boolean }> = {};

    if (postIds.length > 0) {
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      if (likesData) {
        const likeRows = likesData as PostLike[];
        likesMap = likeRows.reduce<Record<string, { count: number; likedByMe: boolean }>>((acc, like) => {
          if (!acc[like.post_id]) {
            acc[like.post_id] = { count: 0, likedByMe: false };
          }
          acc[like.post_id].count += 1;
          if (like.user_id === profile?.id) {
            acc[like.post_id].likedByMe = true;
          }
          return acc;
        }, {});
      }

      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });

      if (commentsData) {
        const commentRows = commentsData as PostComment[];
        const authorIds = Array.from(new Set(commentRows.map((c) => c.user_id)));
        const authors = await fetchProfilesByIds(authorIds);
        const authorMap = new Map(authors.map((a) => [a.id, a]));

        commentsMap = commentRows.reduce<Record<string, CommentWithMeta[]>>((acc, comment) => {
          const author = authorMap.get(comment.user_id) || viewerLite || {
            id: comment.user_id,
            name: 'Member',
            avatar_url: null,
            role: 'Hybrid',
          };
          const entry = { ...comment, author };
          if (!acc[comment.post_id]) acc[comment.post_id] = [];
          acc[comment.post_id].push(entry);
          return acc;
        }, {});
      }
    }

    const author = {
      id: viewedProfile.id,
      name: viewedProfile.name,
      avatar_url: viewedProfile.avatar_url,
      role: viewedProfile.role,
    };

    const mapped = postRows.map((post) => ({
      ...post,
      author,
      comments: commentsMap[post.id] ?? [],
      likeCount: likesMap[post.id]?.count ?? 0,
      likedByMe: likesMap[post.id]?.likedByMe ?? false,
    }));

    setPosts(mapped);
  };

  const loadViewerRelations = async () => {
    if (!id || !user) return;
    const { data: followData } = await supabaseAny
      .from('followers')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('user_id', id)
      .maybeSingle();
    setIsFollowing(!!followData);

    // Get friendships where user is involved
    const { data: friendshipA } = await supabaseAny
      .from('friendships')
      .select('status')
      .eq('user_id_a', user.id)
      .eq('user_id_b', id)
      .maybeSingle();
    
    const { data: friendshipB } = await supabaseAny
      .from('friendships')
      .select('status')
      .eq('user_id_a', id)
      .eq('user_id_b', user.id)
      .maybeSingle();
    
    const friendship = friendshipA || friendshipB;
    if (friendship && friendship.status === 'accepted') {
      setFriendStatus('accepted');
    } else if (friendship && friendship.status === 'pending') {
      setFriendStatus('pending');
    } else {
      setFriendStatus('none');
    }
  };

  useEffect(() => {
    if (!viewedProfile) return;
    void loadStats();
    void loadPosts();
    void loadViewerRelations();
  }, [viewedProfile?.id, profile?.id]);

  const handleFollowToggle = async () => {
    if (!id) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (isFollowing) {
      await supabaseAny
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('user_id', id);
    } else {
      await supabaseAny
        .from('followers')
        .insert({ follower_id: user.id, user_id: id });
    }
    await loadViewerRelations();
    await loadStats();
  };

  const handleFriendRequest = async () => {
    if (!id) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (friendStatus !== 'none') return;
    await supabaseAny
      .from('friendships')
      .insert({ user_id_a: user.id, user_id_b: id });
    await loadViewerRelations();
  };

  const handleLikeToggle = async (postId: string, liked: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (liked) {
      await supabaseAny
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
    } else {
      await supabaseAny
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id });
    }
    await loadPosts();
  };

  const handleCommentCreate = async (postId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const content = commentDrafts[postId]?.trim();
    if (!content) return;
    const { error } = await supabaseAny
      .from('post_comments')
      .insert({ post_id: postId, user_id: user.id, content });
    if (error) {
      showToast('error', 'Unable to comment right now.');
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    await loadPosts();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!viewedProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Profile not found.</p>
      </div>
    );
  }

  const isOwner = profile?.id === viewedProfile.id;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={`${viewedProfile.name} - Rootwise`} description="Rootwise member profile." path={`/users/${viewedProfile.id}`} />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="relative h-64 bg-slate-200">
          {viewedProfile.banner_url ? (
            <img
              src={viewedProfile.banner_url}
              alt="Profile banner"
              className="w-full h-full object-cover bg-slate-200"
              style={{ objectPosition: `${viewedProfile.banner_position_x ?? 50}% ${viewedProfile.banner_position_y ?? 50}%` }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          )}
        </div>

        <div className="px-8 pb-8">
          <div className="-mt-14 flex flex-col lg:flex-row lg:items-end gap-6">
            <div className="relative">
              {viewedProfile.avatar_url ? (
                <img
                  src={viewedProfile.avatar_url}
                  alt={viewedProfile.name}
                  className="w-32 h-32 rounded-3xl border-4 border-white object-cover shadow-lg bg-slate-100"
                />
              ) : (
                <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
                  {getInitials(viewedProfile.name)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-3xl font-bold text-slate-800">{viewedProfile.name}</h2>
              <p className="text-slate-500">{viewedProfile.role} • {viewedProfile.age ?? 'Age not set'}</p>
              {viewedProfile.bio && (
                <p className="mt-3 text-sm text-slate-600 max-w-2xl">{viewedProfile.bio}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isOwner ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleFollowToggle}
                    className={`px-5 py-2 rounded-xl font-bold ${isFollowing ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white'}`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={handleFriendRequest}
                    disabled={friendStatus !== 'none'}
                    className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold disabled:opacity-60"
                  >
                    {friendStatus === 'accepted' ? 'Friends' : friendStatus === 'pending' ? 'Request sent' : 'Add Friend'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{posts.length}</p>
              <p className="text-xs text-slate-500">Posts</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{friendsCount}</p>
              <p className="text-xs text-slate-500">Friends</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{followersCount}</p>
              <p className="text-xs text-slate-500">Followers</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{followingCount}</p>
              <p className="text-xs text-slate-500">Following</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-bold mb-4">Intro</h4>
                <p className="text-sm text-slate-500 mb-4">
                  {viewedProfile.bio || 'No bio yet.'}
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Role</span>
                    <span className="font-semibold text-slate-700">{viewedProfile.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Age</span>
                    <span className="font-semibold text-slate-700">{viewedProfile.age ?? 'Not set'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {posts.length === 0 && (
                <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-4xl mb-2">📝</p>
                  <p>No posts yet.</p>
                </div>
              )}

              {posts.map((post) => (
                <div key={post.id} className="bg-white border border-slate-200 rounded-2xl p-5">
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
                  <p className="mt-4 text-sm text-slate-700 whitespace-pre-line">{post.content}</p>

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
                        placeholder={user ? 'Write a comment...' : 'Sign in to comment'}
                        className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!user}
                      />
                      <button
                        onClick={() => handleCommentCreate(post.id)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold disabled:opacity-60"
                        disabled={!user}
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePage;

