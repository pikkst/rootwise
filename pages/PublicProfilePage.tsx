import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocalePath } from '../hooks/useLocalePath';
import { Follower, Friendship, Post, PostComment, PostLike, Profile, getInitials } from '../types';
import { supabase } from '../services/supabase';
import { RootwiseAIService } from '../services/geminiService';
import { formatDateTime } from '../utils/formatDate';

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
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const lp = useLocalePath();
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [aiConsentToSend, setAiConsentToSend] = useState(false);
  const [aiSendingMessage, setAiSendingMessage] = useState(false);
  const supabaseAny = supabase as any;
  const aiService = useRef(new RootwiseAIService());

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
      // Only select public-safe fields — never expose stripe_customer_id or internal fields
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, age, role, bio, avatar_url, banner_url, banner_position_x, banner_position_y, skills, interests, preferred_language, spoken_languages, xp, level, created_at, updated_at')
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

  const openMessageModal = () => {
    if (!user) {
      navigate(lp('/auth'));
      return;
    }
    setAiConsentToSend(false);
    setShowMessageModal(true);
  };

  const closeMessageModal = () => {
    if (sendingMessage || aiSendingMessage) return;
    setShowMessageModal(false);
  };

  const sendDirectMessageWithNotification = async (subjectText: string, bodyText: string) => {
    if (!profile?.id || !viewedProfile?.id) return false;

    const composedBody = `📌 ${subjectText}\n\n${bodyText}`;

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.id,
      recipient_id: viewedProfile.id,
      body: composedBody,
    });

    if (error) {
      showToast('error', error.message);
      return false;
    }

    await supabase.from('notifications').insert({
      user_id: viewedProfile.id,
      type: 'direct_message',
      title: t('messages.notificationTitle', { defaultValue: 'New message' }),
      body: t('messages.notificationBody', {
        defaultValue: '{{name}} sent you a message',
        name: profile.name,
      }),
      link: `/messages?user=${profile.id}`,
      read: false,
    });

    return true;
  };

  const handleSendDirectMessage = async () => {
    if (!profile?.id || !viewedProfile?.id || sendingMessage) return;

    const subject = messageSubject.trim();
    const body = messageBody.trim();

    if (!subject || !body) {
      showToast('error', t('messages.requiredFields', { defaultValue: 'Palun täida pealkiri ja sõnumi sisu.' }));
      return;
    }

    setSendingMessage(true);
    const ok = await sendDirectMessageWithNotification(subject, body);
    setSendingMessage(false);

    if (!ok) return;

    showToast('success', t('messages.sentToast', { defaultValue: 'Message sent.' }));
    setShowMessageModal(false);
  };

  const handleAiSendOnBehalf = async () => {
    if (!profile?.id || !viewedProfile?.id || aiSendingMessage || sendingMessage) return;

    if (!aiConsentToSend) {
      showToast('error', t('messages.aiConsentRequired', { defaultValue: 'Please confirm AI permission before sending on your behalf.' }));
      return;
    }

    const requestText = [messageSubject.trim(), messageBody.trim()].filter(Boolean).join('\n\n');
    if (!requestText) {
      showToast('error', t('messages.requiredFields', { defaultValue: 'Please fill in subject and message content.' }));
      return;
    }

    setAiSendingMessage(true);
    const introResult = await aiService.current.requestAiIntroduction(viewedProfile.id, requestText);

    if (!introResult.ok) {
      showToast('error', introResult.error || t('common.error'));
      setAiSendingMessage(false);
      return;
    }

    const subject = messageSubject.trim() || t('messages.aiDefaultSubject', { defaultValue: 'Quick intro' });
    const aiBody = introResult.introPreview?.trim() || messageBody.trim();
    const ok = await sendDirectMessageWithNotification(subject, aiBody);
    setAiSendingMessage(false);

    if (!ok) return;

    showToast('success', t('messages.aiSentToast', { defaultValue: 'AI sent your first message.' }));
    setShowMessageModal(false);
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
      showToast('error', t('publicProfile.commentError'));
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
        <p className="text-slate-500">{t('publicProfile.notFound')}</p>
      </div>
    );
  }

  const isOwner = profile?.id === viewedProfile.id;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={`${viewedProfile.name} - Rootwise`} description={t('publicProfile.seoDescription')} path={`/users/${viewedProfile.id}`} />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="relative h-40 sm:h-64 bg-slate-200">
          {viewedProfile.banner_url ? (
            <img
              src={viewedProfile.banner_url}
              alt={t('publicProfile.profileBanner')}
              className="w-full h-full object-cover bg-slate-200"
              style={{ objectPosition: `${viewedProfile.banner_position_x ?? 50}% ${viewedProfile.banner_position_y ?? 50}%` }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          )}
        </div>

        <div className="px-4 sm:px-8 pb-8">
          <div className="pt-3 sm:pt-4 flex flex-col lg:flex-row lg:items-end gap-6">
            <div className="relative -mt-14 sm:-mt-16 lg:-mt-20">
              {viewedProfile.avatar_url ? (
                <img
                  src={viewedProfile.avatar_url}
                  alt={viewedProfile.name}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-white object-cover shadow-lg bg-slate-100"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold">
                  {getInitials(viewedProfile.name)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold text-slate-800 break-words leading-tight">{viewedProfile.name}</h2>
              <p className="text-slate-500">{viewedProfile.role} • {viewedProfile.age ?? t('publicProfile.ageNotSet')}</p>
              {viewedProfile.bio && (
                <p className="mt-3 text-sm text-slate-600 max-w-2xl">{viewedProfile.bio}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isOwner ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                >
                  {t('publicProfile.editProfile')}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleFollowToggle}
                    className={`px-5 py-2 rounded-xl font-bold ${isFollowing ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 text-white'}`}
                  >
                    {isFollowing ? t('publicProfile.following') : t('publicProfile.follow')}
                  </button>
                  <button
                    onClick={openMessageModal}
                    className="px-5 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold"
                  >
                    {t('messages.sendBtn', { defaultValue: 'Saada sõnum' })}
                  </button>
                  <button
                    onClick={handleFriendRequest}
                    disabled={friendStatus !== 'none'}
                    className="px-5 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold disabled:opacity-60"
                  >
                    {friendStatus === 'accepted' ? t('publicProfile.friends') : friendStatus === 'pending' ? t('publicProfile.requestSent') : t('publicProfile.addFriend')}
                  </button>
                  <button
                    onClick={() => navigate(`/reports?type=user&targetUserId=${viewedProfile.id}`)}
                    className="px-5 py-2 bg-rose-50 text-rose-700 rounded-xl font-bold"
                  >
                    {t('publicProfile.reportUser')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{posts.length}</p>
              <p className="text-xs text-slate-500">{t('publicProfile.posts')}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{friendsCount}</p>
              <p className="text-xs text-slate-500">{t('publicProfile.friends')}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{followersCount}</p>
              <p className="text-xs text-slate-500">{t('publicProfile.followers')}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl py-3">
              <p className="text-xl font-bold text-slate-800">{followingCount}</p>
              <p className="text-xs text-slate-500">{t('publicProfile.following')}</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-bold mb-4">{t('publicProfile.intro')}</h4>
                <p className="text-sm text-slate-500 mb-4">
                  {viewedProfile.bio || t('publicProfile.noBio')}
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('publicProfile.role')}</span>
                    <span className="font-semibold text-slate-700">{viewedProfile.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('publicProfile.age')}</span>
                    <span className="font-semibold text-slate-700">{viewedProfile.age ?? t('publicProfile.notSet')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {posts.length === 0 && (
                <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-4xl mb-2">📝</p>
                  <p>{t('publicProfile.noPosts')}</p>
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
                      <p className="text-xs text-slate-400">{formatDateTime(post.created_at)}</p>
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
                    <span>{post.comments?.length ?? 0} {t('publicProfile.comments')}</span>
                    <button
                      onClick={() => navigate(`/reports?type=post&targetUserId=${viewedProfile.id}&targetPostId=${post.id}`)}
                      className="font-semibold text-rose-600"
                    >
                      {t('publicProfile.reportPost')}
                    </button>
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
                        placeholder={user ? t('publicProfile.writeComment') : t('publicProfile.signInToComment')}
                        className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={!user}
                      />
                      <button
                        onClick={() => handleCommentCreate(post.id)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold disabled:opacity-60"
                        disabled={!user}
                      >
                        {t('publicProfile.comment')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showMessageModal && (
        <div className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6">
            <h3 className="text-xl font-black text-slate-900 mb-1">
              {t('messages.composeTitle', { defaultValue: 'Saada sõnum' })}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('messages.toUser', { defaultValue: 'Saaja: {{name}}', name: viewedProfile.name })}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {t('messages.subject', { defaultValue: 'Pealkiri' })}
                </label>
                <input
                  type="text"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder={t('messages.subjectPlaceholder', { defaultValue: 'Sisesta pealkiri...' })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {t('messages.message', { defaultValue: 'Sõnumi sisu' })}
                </label>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={t('messages.messagePlaceholder', { defaultValue: 'Kirjuta oma sõnum...' })}
                  rows={6}
                  maxLength={4000}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={aiConsentToSend}
                  onChange={(e) => setAiConsentToSend(e.target.checked)}
                  className="mt-0.5"
                  disabled={sendingMessage || aiSendingMessage}
                />
                <span>
                  {t('messages.aiConsent', { defaultValue: 'I agree that AI can send the first message on my behalf using my provided context.' })}
                </span>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => void handleAiSendOnBehalf()}
                disabled={sendingMessage || aiSendingMessage}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm disabled:opacity-50"
              >
                {aiSendingMessage
                  ? t('common.processing')
                  : t('messages.aiSendOnBehalf', { defaultValue: 'AI send on my behalf' })}
              </button>
              <button
                onClick={closeMessageModal}
                disabled={sendingMessage || aiSendingMessage}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm disabled:opacity-50"
              >
                {t('common.back')}
              </button>
              <button
                onClick={() => void handleSendDirectMessage()}
                disabled={sendingMessage || aiSendingMessage}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50"
              >
                {sendingMessage ? t('common.sending') : t('common.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicProfilePage;

