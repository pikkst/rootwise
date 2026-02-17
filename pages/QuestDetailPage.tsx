import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import QuestVideoCall from '../components/QuestVideoCall';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { useTranslation } from 'react-i18next';
import { DbQuest, QuestMember, QuestMessage, QuestFile, QuestMilestone, Profile } from '../types';
import { formatTime, formatDateNumeric } from '../utils/formatDate';
import { useQuestTranslation } from '../hooks/useQuestTranslation';

/** Privacy name: "Malle K." format */
const privacyName = (fullName?: string | null): string => {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

/** Role emoji for quest member role */
const roleEmoji = (role?: string): string => {
  if (role === 'creator' || role === 'mentor') return '🦉';
  return '⚡';
};

type Tab = 'overview' | 'chat' | 'files' | 'milestones' | 'members' | 'proof';

interface MessageWithAuthor extends QuestMessage {
  author?: Profile;
}

const QuestDetailPage: React.FC = () => {
  const { questId } = useParams<{ questId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [quest, setQuest] = useState<DbQuest | null>(null);
  const [members, setMembers] = useState<QuestMember[]>([]);
  const [messages, setMessages] = useState<MessageWithAuthor[]>([]);
  const [files, setFiles] = useState<QuestFile[]>([]);
  const [milestones, setMilestones] = useState<QuestMilestone[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [currentMember, setCurrentMember] = useState<QuestMember | null>(null);
  const [joiningQuest, setJoiningQuest] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofText, setProofText] = useState('');
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [activeCallUsers, setActiveCallUsers] = useState<any[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, Profile>>({});

  // Auto-translate quest content to user's UI language
  const {
    title: tTitle,
    description: tDescription,
    steps: tSteps,
    isTranslating,
    isTranslated,
  } = useQuestTranslation(
    questId,
    quest?.title ?? '',
    quest?.description ?? '',
    quest?.steps ?? []
  );
  const callChannelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload config
  const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': 'Image',
    'image/png': 'Image',
    'image/gif': 'Image',
    'image/webp': 'Image',
    'application/pdf': 'PDF',
    'video/mp4': 'Video',
    'text/plain': 'Article',
    'text/markdown': 'Article',
    'text/html': 'Article',
    'application/msword': 'Document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Document',
  };
  const MAX_FILE_SIZES: Record<string, number> = {
    image: 10 * 1024 * 1024,   // 10 MB
    pdf: 20 * 1024 * 1024,     // 20 MB
    video: 100 * 1024 * 1024,  // 100 MB
    text: 5 * 1024 * 1024,     // 5 MB
    default: 10 * 1024 * 1024, // 10 MB
  };

  const getMaxSize = (mime: string) => {
    if (mime.startsWith('image/')) return MAX_FILE_SIZES.image;
    if (mime === 'application/pdf') return MAX_FILE_SIZES.pdf;
    if (mime.startsWith('video/')) return MAX_FILE_SIZES.video;
    if (mime.startsWith('text/')) return MAX_FILE_SIZES.text;
    return MAX_FILE_SIZES.default;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type === 'application/pdf') return '📕';
    if (type.startsWith('text/')) return '📝';
    return '📄';
  };

  useEffect(() => {
    if (!questId || !profile?.id) return;
    fetchQuestDetails();
  }, [questId, profile?.id]);

  // Close share menu on outside click
  useEffect(() => {
    if (!showShareMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-share-menu]')) setShowShareMenu(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showShareMenu]);

  // Supabase Realtime Presence for video call awareness
  useEffect(() => {
    if (!questId || !profile?.id) return;

    const channel = supabase.channel(`quest-call:${questId}`, {
      config: { presence: { key: profile.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat();
      setActiveCallUsers(users);
    });

    channel.subscribe();
    callChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      callChannelRef.current = null;
    };
  }, [questId, profile?.id]);

  const fetchQuestDetails = async () => {
    if (!questId || !profile?.id) return;
    setLoading(true);

    try {
      // Fetch quest
      const { data: questData } = await supabase.from('quests').select('*').eq('id', questId).single();

      if (questData) {
        setQuest(questData as DbQuest);
      }

      // Fetch members
      const { data: membersData } = await supabase
        .from('quest_members')
        .select('*')
        .eq('quest_id', questId);
      setMembers((membersData as QuestMember[]) ?? []);

      // Set current member info
      const myMembership = (membersData as QuestMember[])?.find((m) => m.user_id === profile.id);
      setCurrentMember(myMembership ?? null);

      // Fetch profile names for all members
      const memberUserIds = (membersData as QuestMember[])?.map((m) => m.user_id) ?? [];
      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, role')
          .in('id', memberUserIds);
        if (profilesData) {
          const profileMap: Record<string, Profile> = {};
          profilesData.forEach((p: any) => { profileMap[p.id] = p as Profile; });
          setMemberProfiles(profileMap);
        }
      }

      // Fetch messages
      try {
        const { data: messagesData } = await supabase
          .from('quest_messages')
          .select('*')
          .eq('quest_id', questId)
          .order('created_at', { ascending: true });
        setMessages((messagesData as QuestMessage[]) ?? []);
      } catch { setMessages([]); }

      // Fetch files
      try {
        const { data: filesData } = await supabase
          .from('quest_files')
          .select('*')
          .eq('quest_id', questId)
          .order('created_at', { ascending: false });
        setFiles((filesData as QuestFile[]) ?? []);
      } catch { setFiles([]); }

      // Fetch milestones
      try {
        const { data: milestonesData } = await supabase
          .from('quest_milestones')
          .select('*')
          .eq('quest_id', questId)
          .order('created_at', { ascending: true });
        setMilestones((milestonesData as QuestMilestone[]) ?? []);
      } catch { setMilestones([]); }
    } catch (err) {
      console.error('Error fetching quest details:', err);
      showToast('error', t('questDetail.toastLoadFailed'));
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !questId || !profile?.id || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase.from('quest_messages').insert({
        quest_id: questId,
        user_id: profile.id,
        content: messageText,
      });

      if (error) {
        showToast('error', t('questDetail.toastSendFailed'));
      } else {
        setMessageText('');
        await fetchQuestDetails();
        showToast('success', t('questDetail.chatMessageSent'));
      }
    } catch (err) {
      showToast('error', t('questDetail.toastError'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('quest_milestones')
        .update({ completed: !currentStatus })
        .eq('id', milestoneId);

      if (error) {
        showToast('error', t('questDetail.toastMilestoneFailed'));
      } else {
        await fetchQuestDetails();
        showToast('success', t('questDetail.milestoneUpdated'));
      }
    } catch (err) {
      showToast('error', t('questDetail.toastError'));
    }
  };

  const handleJoinQuest = async () => {
    if (!questId || !profile?.id || joiningQuest) return;

    setJoiningQuest(true);
    try {
      const { error } = await supabase.from('quest_members').insert({
        quest_id: questId,
        user_id: profile.id,
        role: 'learner',
        status: 'accepted',
        proof_submitted: null,
        proof_verified: false,
        xp_awarded: false,
      });

      if (error) {
        showToast('error', error.message || t('questDetail.toastJoinFailed'));
      } else {
        showToast('success', t('questDetail.toastJoined'));
        await fetchQuestDetails();
      }
    } catch (err) {
      showToast('error', t('questDetail.toastJoinError'));
    } finally {
      setJoiningQuest(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofText.trim() || !questId || !profile?.id || submittingProof) return;

    setSubmittingProof(true);
    try {
      const proofData = {
        type: 'text',
        content: proofText,
      };

      const { error } = await supabase
        .from('quest_members')
        .update({
          proof_submitted: proofData,
          proof_submitted_at: new Date().toISOString(),
        })
        .eq('quest_id', questId)
        .eq('user_id', profile.id);

      if (error) {
        showToast('error', t('questDetail.toastProofFailed'));
      } else {
        // Notify quest creator/mentors about new proof
        const mentors = members.filter((m) => m.role === 'creator' || m.role === 'mentor');
        for (const mentor of mentors) {
          await supabase.from('notifications').insert({
            user_id: mentor.user_id,
            type: 'proof_submitted',
            title: t('questDetail.toastProofSubmitted'),
            body: `${profile.name} — ${quest?.title}`,
            link: `/quests/${questId}`,
          });
        }
        setProofText('');
        await fetchQuestDetails();
        showToast('success', t('questDetail.toastProofSubmitted'));
      }
    } catch (err) {
      showToast('error', t('questDetail.toastError'));
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleVerifyProof = async (userId: string, approved: boolean, feedback?: string) => {
    if (!questId || !profile?.id) return;
    try {
      if (approved) {
        // Award XP via RPC
        await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: quest?.reward_xp ?? 0 });
      }

      const { error } = await supabase
        .from('quest_members')
        .update({
          proof_verified: approved,
          proof_verified_by: approved ? profile.id : null,
          proof_verified_at: approved ? new Date().toISOString() : null,
          xp_awarded: approved,
          status: approved ? 'completed' : 'accepted',
          ...((!approved && feedback) ? { proof_submitted: null } : {}),
        })
        .eq('quest_id', questId)
        .eq('user_id', userId);

      if (error) {
        showToast('error', t('questDetail.toastVerifyFailed'));
      } else {
        // Create notification for the learner
        await supabase.from('notifications').insert({
          user_id: userId,
          type: approved ? 'proof_approved' : 'proof_rejected',
          title: approved
            ? t('questDetail.toastProofApproved')
            : t('questDetail.toastProofRejected'),
          body: approved
            ? `+${quest?.reward_xp ?? 0} XP — ${quest?.title}`
            : feedback || '',
          link: `/quests/${questId}`,
        }).then(() => {});

        if (approved) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
        setRejectingUserId(null);
        setRejectFeedback('');
        await fetchQuestDetails();
        showToast('success', approved ? t('questDetail.toastProofApproved') : t('questDetail.toastProofRejected'));
      }
    } catch {
      showToast('error', t('questDetail.toastError'));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !questId || !profile?.id || uploadingFile) return;

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      showToast('error', t('questDetail.toastFileTypeNotSupported'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size
    const maxSize = getMaxSize(file.type);
    if (file.size > maxSize) {
      showToast('error', t('questDetail.toastFileTooLarge', { maxSize: formatBytes(maxSize) }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `${profile.id}/quest-files/${questId}/${Date.now()}-${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError || !uploadData) {
        throw uploadError || new Error('Upload failed');
      }

      const { data: publicUrlData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(uploadData.path);

      const { error: dbError } = await supabase.from('quest_files').insert({
        quest_id: questId,
        user_id: profile.id,
        file_url: publicUrlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      if (dbError) {
        // Clean up the uploaded file if DB insert fails
        await supabase.storage.from('profile-media').remove([storagePath]);
        throw dbError;
      }

      await fetchQuestDetails();
      showToast('success', t('questDetail.toastFileUploaded'));
    } catch (err: any) {
      console.error('File upload error:', err);
      showToast('error', err?.message || t('questDetail.toastUploadFailed'));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: QuestFile) => {
    if (!profile?.id || deletingFileId) return;

    // Only uploader can delete
    if (file.user_id !== profile.id) {
      showToast('error', t('questDetail.toastDeleteOwnOnly'));
      return;
    }

    if (!window.confirm(t('questDetail.confirmDeleteFile'))) return;

    setDeletingFileId(file.id);
    try {
      // Extract storage path from URL
      const url = file.file_url ?? '';
      const pathMatch = url.match(/profile-media\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from('profile-media').remove([pathMatch[1]]);
      }

      const { error } = await supabase.from('quest_files').delete().eq('id', file.id);
      if (error) throw error;

      await fetchQuestDetails();
      showToast('success', t('questDetail.toastFileDeleted'));
    } catch (err: any) {
      console.error('File delete error:', err);
      showToast('error', err?.message || t('questDetail.toastDeleteFailed'));
    } finally {
      setDeletingFileId(null);
    }
  };

  // Video call handlers — must be before early returns to satisfy Rules of Hooks
  const handleStartCall = useCallback(() => {
    if (!questId) return;
    setShowVideoCall(true);
    callChannelRef.current?.track({
      userId: profile?.id,
      userName: profile?.name || 'User',
      avatarUrl: profile?.avatar_url,
      joinedAt: new Date().toISOString(),
    });
    // Log call start
    if (profile?.id) {
      supabase.from('quest_video_calls').insert({
        quest_id: questId,
        room_name: `Rootwise_${questId.replace(/-/g, '').slice(0, 16)}`,
        created_by: profile.id,
        status: 'active',
      }).then(() => {});
    }
  }, [questId, profile]);

  const handleLeaveCall = useCallback(() => {
    setShowVideoCall(false);
    callChannelRef.current?.untrack();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{t('questDetail.notFound')}</p>
          <button
            onClick={() => navigate('/quests')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            {t('questDetail.backToQuests')}
          </button>
        </div>
      </div>
    );
  }

  const isCreator = quest.created_by === profile?.id;
  const isMentor = currentMember?.role === 'mentor';
  const isLearner = currentMember?.role === 'learner';
  const isMember = !!currentMember;

  const questUrl = `https://rootwise.site/quests/${questId}`;
  const shareText = `Check out this quest on Rootwise: "${tTitle}" — ${tDescription?.slice(0, 100) ?? ''}...`;

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(questUrl)}`,
    twitter: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(questUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(questUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${questUrl}`)}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(questUrl);
      showToast('success', t('questDetail.toastLinkCopied'));
    } catch {
      showToast('error', t('questDetail.toastCopyFailed'));
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: tTitle, text: shareText, url: questUrl });
      } catch { /* user cancelled */ }
    } else {
      setShowShareMenu((v) => !v);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-32 relative">
      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                fontSize: `${12 + Math.random() * 16}px`,
                color: ['#f43f5e', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#3b82f6'][Math.floor(Math.random() * 6)],
              }}
            >
              {['🎉', '⭐', '🏆', '✨', '🎊', '💎'][Math.floor(Math.random() * 6)]}
            </span>
          ))}
        </div>
      )}

      <SEOHead title={`${tTitle} - Rootwise`} description={tDescription} path={`/quests/${questId}`} />

      {/* Header */}
      <header className="mb-8">
        <button
          onClick={() => navigate('/quests')}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold mb-4 inline-flex items-center gap-1"
        >
          ← {t('questDetail.backToQuests')}
        </button>

        {/* Quest image banner */}
        {quest.image_url && (
          <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden mb-6">
            <img src={quest.image_url} alt={tTitle} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 leading-tight">
          {tTitle}
          {isTranslating && <span className="ml-2 text-sm font-normal text-indigo-400 animate-pulse">🌐 {t('questDetail.translating')}</span>}
          {isTranslated && <span className="ml-2 text-xs font-normal text-emerald-500">🌐</span>}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {quest.quest_type && (
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full uppercase tracking-wide">
              {quest.quest_type}
            </span>
          )}
          <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
            quest.status === 'published' ? 'bg-green-100 text-green-700' :
            quest.status === 'completed' ? 'bg-slate-200 text-slate-600' :
            quest.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-700'
          }`}>
            {quest.status?.replace('_', ' ')}
          </span>
          {quest.is_virtual && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full uppercase tracking-wide">
              🌐 {t('questDetail.virtual')}
            </span>
          )}

          {/* Video Call button */}
          {isMember && (
            <button
              onClick={handleStartCall}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition ml-auto ${
                activeCallUsers.length > 0
                  ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              {activeCallUsers.length > 0
                ? `🔴 ${t('questDetail.videoCallJoinActive')} (${activeCallUsers.length})`
                : `📹 ${t('questDetail.videoCallTitle')}`}
            </button>
          )}

          {/* Share button */}
          <div className={`relative ${!isMember ? 'ml-auto' : ''}`} data-share-menu>
            <button
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition"
            >
              📤 {t('questDetail.shareTitle')}
            </button>

            {showShareMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 min-w-[200px]">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('questDetail.shareTitle')}</p>
                <div className="flex gap-2 mb-3">
                  <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center p-2.5 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition text-sm" title="Facebook">
                    f
                  </a>
                  <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center p-2.5 bg-black text-white rounded-lg hover:opacity-90 transition text-sm" title="X (Twitter)">
                    𝕏
                  </a>
                  <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center p-2.5 bg-[#0A66C2] text-white rounded-lg hover:opacity-90 transition text-sm" title="LinkedIn">
                    in
                  </a>
                  <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center p-2.5 bg-[#25D366] text-white rounded-lg hover:opacity-90 transition text-sm" title="WhatsApp">
                    💬
                  </a>
                </div>
                <button
                  onClick={() => { handleCopyLink(); setShowShareMenu(false); }}
                  className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-center"
                >
                  {t('questDetail.shareCopyLink')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Active call banner */}
      {activeCallUsers.length > 0 && !showVideoCall && isMember && (
        <div className="mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse flex-shrink-0" />
              <div>
                <p className="font-bold text-sm sm:text-base">{t('questDetail.videoCallInProgress')}</p>
                <p className="text-indigo-200 text-xs sm:text-sm">
                  {t('questDetail.videoCallCount', { n: activeCallUsers.length })} —{' '}
                  {(activeCallUsers as any[]).map((u: any) => u.userName).join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={handleStartCall}
              className="px-5 py-2.5 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition text-sm shadow-sm"
            >
              {t('questDetail.videoCallJoinActive')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
            <div className="flex border-b border-slate-200 overflow-x-auto">
              {(['overview', 'chat', 'files', 'milestones', 'members', 'proof'] as Tab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap flex-shrink-0 py-3 px-3 sm:py-4 sm:px-4 sm:flex-1 text-center font-semibold transition text-sm sm:text-base ${
                      activeTab === tab
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {t(`questDetail.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)}
                  </button>
                )
              )}
            </div>

            <div className="p-4 sm:p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-3">{t('questDetail.aboutTitle')}</h2>
                  <p className="text-slate-600 leading-relaxed mb-6 text-[15px]">{tDescription}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-100">
                      <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">{t('questDetail.xpReward')}</div>
                      <div className="text-2xl font-bold text-indigo-600">⭐ {quest.reward_xp}</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{t('questDetail.category')}</div>
                      <div className="text-lg font-bold text-slate-800">{quest.category}</div>
                    </div>
                  </div>

                  {quest.skills_required && quest.skills_required.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">{t('questDetail.requiredSkills')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {quest.skills_required.map((skill) => (
                          <span key={skill} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium border border-indigo-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {tSteps && tSteps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">{t('questDetail.stepsTitle')}</h3>
                      <ol className="space-y-3">
                        {tSteps.map((step: string, idx: number) => (
                          <li key={idx} className="flex gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-slate-700 text-[15px] leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('questDetail.chatTitle')}</h2>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">{t('questDetail.chatJoinFirst')}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4 h-80 overflow-y-auto mb-4 space-y-3">
                        {messages.length === 0 ? (
                          <p className="text-slate-500 text-center py-8">{t('questDetail.chatEmpty')}</p>
                        ) : (
                          messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-lg ${
                                msg.user_id === profile?.id
                                  ? 'bg-indigo-100 ml-8'
                                  : 'bg-white border border-slate-200 mr-8'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-sm text-slate-800">
                                  {msg.user_id === profile?.id
                                    ? t('questDetail.chatYou')
                                    : <>{roleEmoji(members.find(mm => mm.user_id === msg.user_id)?.role)} {privacyName(memberProfiles[msg.user_id]?.name) || `${t('questDetail.chatUser')} ${msg.user_id.slice(0, 8)}`}</>}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatTime(msg.created_at ?? '')}
                                </span>
                              </div>
                              <p className="text-slate-700">{msg.content}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder={t('questDetail.chatPlaceholder')}
                          disabled={sendingMessage}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={sendingMessage || !messageText.trim()}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingMessage ? t('questDetail.chatSending') : t('questDetail.chatSend')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">{t('questDetail.filesTitle')}</h2>
                  <p className="text-xs text-slate-400 mb-4">{t('questDetail.filesSubtitle')}</p>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <p className="text-slate-600">{t('questDetail.filesJoinFirst')}</p>
                    </div>
                  ) : (
                    <div>
                      {/* Upload area */}
                      <div className="mb-5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,video/mp4,text/plain,text/markdown,.doc,.docx"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                          id="quest-file-upload"
                        />
                        <label
                          htmlFor="quest-file-upload"
                          className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
                            uploadingFile
                              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                              : 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400 hover:bg-indigo-50'
                          }`}
                        >
                          {uploadingFile ? (
                            <>
                              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                              <span className="text-sm font-medium text-indigo-600">{t('questDetail.filesUploading')}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-3xl">📎</span>
                              <span className="text-sm font-medium text-indigo-600">{t('questDetail.filesUploadClick')}</span>
                              <span className="text-xs text-slate-400">
                                {t('questDetail.filesMaxSize')}
                              </span>
                            </>
                          )}
                        </label>
                      </div>

                      {/* File list */}
                      {files.length === 0 ? (
                        <p className="text-slate-400 text-center py-6 text-sm">{t('questDetail.filesEmpty')}</p>
                      ) : (
                        <div className="space-y-2">
                          {files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition group"
                            >
                              <span className="text-2xl flex-shrink-0">{getFileIcon(file.file_type)}</span>
                              <a
                                href={file.file_url ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0"
                              >
                                <div className="font-semibold text-slate-800 truncate text-sm hover:text-indigo-600 transition">
                                  {file.file_name || t('questDetail.filesUnnamed')}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <span>{ALLOWED_TYPES[file.file_type ?? ''] || t('questDetail.filesFileLabel')}</span>
                                  {file.file_size && <span>· {formatBytes(file.file_size)}</span>}
                                  <span>· {formatDateNumeric(file.created_at ?? file.uploaded_at ?? '')}</span>
                                </div>
                              </a>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a
                                  href={file.file_url ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition text-xs font-medium"
                                  title={t('questDetail.filesDownload')}
                                >
                                  ⬇️
                                </a>
                                {file.user_id === profile?.id && (
                                  <button
                                    onClick={() => handleDeleteFile(file)}
                                    disabled={deletingFileId === file.id}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    title={t('questDetail.filesDelete')}
                                  >
                                    {deletingFileId === file.id ? '⏳' : '🗑️'}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Milestones Tab */}
              {activeTab === 'milestones' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('questDetail.milestonesTitle')}</h2>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">{t('questDetail.milestonesJoinFirst')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {milestones.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">{t('questDetail.milestonesEmpty')}</p>
                      ) : (
                        milestones.map((milestone) => (
                          <div
                            key={milestone.id}
                            className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                          >
                            <input
                              type="checkbox"
                              checked={milestone.completed ?? false}
                              onChange={() => handleToggleMilestone(milestone.id, milestone.completed ?? false)}
                              disabled={!isCreator && !isMentor}
                              className="w-5 h-5 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div
                                className={`font-semibold ${
                                  milestone.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                }`}
                              >
                                {milestone.title}
                              </div>
                              {milestone.description && (
                                <div className="text-sm text-slate-600">{milestone.description}</div>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">
                              {formatDateNumeric(milestone.created_at ?? '')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('questDetail.membersTitle')}</h2>
                  <div className="space-y-2">
                    {members.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">{t('questDetail.membersEmpty')}</p>
                    ) : (
                      members.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            {memberProfiles[member.user_id]?.avatar_url ? (
                              <img src={memberProfiles[member.user_id].avatar_url!} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {(memberProfiles[member.user_id]?.name || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800">
                                {roleEmoji(member.role)} {privacyName(memberProfiles[member.user_id]?.name) || member.user_id.slice(0, 8)}
                                {member.user_id === profile?.id && ` (${t('questDetail.chatYou')})`}
                              </div>
                              <div className="text-xs text-slate-500 capitalize">{member.status}</div>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            member.role === 'creator' ? 'bg-purple-100 text-purple-700' :
                            member.role === 'mentor' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Proof Tab */}
              {activeTab === 'proof' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">{t('questDetail.proofTitle')}</h2>

                  {/* Learner: submit or view own proof */}
                  {isLearner && (
                    <div className="mb-6">
                      {currentMember?.proof_submitted ? (
                        <div className="bg-slate-50 rounded-lg p-6 mb-4">
                          <h3 className="font-semibold text-slate-800 mb-2">{t('questDetail.proofYourSubmitted')}</h3>
                          <p className="text-slate-600 mb-3">
                            {t('questDetail.proofType')} {typeof currentMember.proof_submitted === 'object' && 'type' in currentMember.proof_submitted ? (currentMember.proof_submitted as any).type : t('questDetail.proofUnknown')}
                          </p>
                          {typeof currentMember.proof_submitted === 'object' && 'content' in currentMember.proof_submitted && (
                            <p className="text-slate-700 bg-white p-3 rounded border border-slate-200 mb-3 italic">
                              "{(currentMember.proof_submitted as any).content}"
                            </p>
                          )}
                          <div className={`p-4 rounded-lg ${
                            currentMember.proof_verified
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-yellow-50 border border-yellow-200'
                          }`}>
                            <p className="font-semibold text-slate-800">
                              {currentMember.proof_verified ? t('questDetail.proofVerified') : t('questDetail.proofPending')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-6">
                          <p className="text-slate-600 mb-4">{t('questDetail.proofSubmitHint')}</p>
                          <textarea
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder={t('questDetail.proofPlaceholder')}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                            rows={4}
                          />
                          <button
                            onClick={handleSubmitProof}
                            disabled={submittingProof || !proofText.trim()}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingProof ? t('questDetail.proofSubmitting') : t('questDetail.proofSubmitBtn')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Creator/Mentor: review submitted proofs */}
                  {(isCreator || isMentor) && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-3">{t('questDetail.proofReviewTitle')}</h3>
                      {members.filter((m) => m.role === 'learner' && m.proof_submitted).length === 0 ? (
                        <div className="bg-slate-50 rounded-lg p-6 text-center">
                          <p className="text-slate-500">{t('questDetail.proofNoSubmissions')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {members
                            .filter((m) => m.role === 'learner' && m.proof_submitted)
                            .map((m) => (
                              <div key={m.user_id} className="bg-white border border-slate-200 rounded-xl p-5">
                                <div className="flex items-center gap-3 mb-3">
                                  {memberProfiles[m.user_id]?.avatar_url ? (
                                    <img src={memberProfiles[m.user_id].avatar_url!} alt="" className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                      {(memberProfiles[m.user_id]?.name || '?')[0].toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-slate-800">
                                      {privacyName(memberProfiles[m.user_id]?.name) || m.user_id.slice(0, 8)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {m.proof_submitted_at ? formatDateNumeric(m.proof_submitted_at) : ''}
                                    </p>
                                  </div>
                                </div>

                                {/* Show proof content */}
                                {typeof m.proof_submitted === 'object' && 'content' in m.proof_submitted && (
                                  <div className="bg-slate-50 p-4 rounded-lg mb-4">
                                    <p className="text-xs text-slate-500 mb-1 uppercase font-semibold">
                                      {(m.proof_submitted as any).type}
                                    </p>
                                    <p className="text-slate-700">{(m.proof_submitted as any).content}</p>
                                  </div>
                                )}

                                {/* Status / Actions */}
                                {m.proof_verified ? (
                                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                    <p className="text-green-700 font-semibold text-sm">✅ {t('questDetail.proofVerified')}</p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex gap-3">
                                      <button
                                        onClick={() => handleVerifyProof(m.user_id, true)}
                                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm"
                                      >
                                        ✅ {t('questDetail.proofApprove')}
                                      </button>
                                      <button
                                        onClick={() => setRejectingUserId(m.user_id)}
                                        className="flex-1 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition font-semibold text-sm"
                                      >
                                        🔄 {t('questDetail.proofAskChanges')}
                                      </button>
                                    </div>

                                    {/* Ask for Changes feedback panel */}
                                    {rejectingUserId === m.user_id && (
                                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                                        <label className="block text-sm font-semibold text-amber-800 mb-2">
                                          {t('questDetail.proofFeedbackRequired')}
                                        </label>
                                        <textarea
                                          value={rejectFeedback}
                                          onChange={(e) => setRejectFeedback(e.target.value)}
                                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                          rows={3}
                                          placeholder={t('questDetail.proofFeedbackPlaceholder')}
                                        />
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() => {
                                              if (!rejectFeedback.trim()) return;
                                              handleVerifyProof(m.user_id, false, rejectFeedback.trim());
                                            }}
                                            disabled={!rejectFeedback.trim()}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {t('questDetail.proofFeedbackSubmit')}
                                          </button>
                                          <button
                                            onClick={() => { setRejectingUserId(null); setRejectFeedback(''); }}
                                            className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition text-sm"
                                          >
                                            {t('questDetail.cancel')}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Not a member at all */}
                  {!isMember && (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">{t('questDetail.proofOnlyLearners')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-bold text-slate-800 mb-4">{t('questDetail.sidebarTitle')}</h2>

            {!isMember && (
              <button
                onClick={handleJoinQuest}
                disabled={joiningQuest}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold mb-5 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-sm"
              >
                {joiningQuest ? t('questDetail.sidebarJoining') : t('questDetail.sidebarJoin')}
              </button>
            )}

            {isMember && (
              <div className="mb-5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-center">
                <span className="text-green-700 font-semibold text-sm">{t('questDetail.sidebarRole', { role: currentMember?.role })}</span>
              </div>
            )}

            <div className="space-y-4 divide-y divide-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{t('questDetail.sidebarMembers')}</span>
                <span className="text-lg font-bold text-slate-800">{members.length}</span>
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-slate-500">{t('questDetail.xpReward')}</span>
                <span className="text-lg font-bold text-indigo-600">⭐ {quest.reward_xp}</span>
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-slate-500">{t('questDetail.sidebarStatus')}</span>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                  quest.status === 'published' ? 'bg-green-100 text-green-700' :
                  quest.status === 'completed' ? 'bg-slate-200 text-slate-600' :
                  quest.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>{quest.status?.replace('_', ' ')}</span>
              </div>

              {quest.category && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm text-slate-500">{t('questDetail.category')}</span>
                  <span className="text-sm font-semibold text-slate-700">{quest.category}</span>
                </div>
              )}

              {!quest.is_virtual && quest.location && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm text-slate-500">{t('questDetail.sidebarLocation')}</span>
                  <span className="text-sm text-slate-800">{quest.location}</span>
                </div>
              )}
            </div>

            {/* Video Call section in sidebar */}
            {isMember && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('questDetail.videoCallTitle')}</p>
                {activeCallUsers.length > 0 && !showVideoCall ? (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-slate-600 font-medium">
                        {t('questDetail.videoCallCount', { n: activeCallUsers.length })}
                      </span>
                    </div>
                    <button
                      onClick={handleStartCall}
                      className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold text-sm shadow-sm"
                    >
                      {t('questDetail.videoCallJoinActive')}
                    </button>
                  </div>
                ) : !showVideoCall ? (
                  <button
                    onClick={handleStartCall}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-semibold text-sm shadow-sm"
                  >
                    📹 Start Video Call
                  </button>
                ) : (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-center">
                    <span className="text-red-700 font-semibold text-xs">{t('questDetail.videoCallInCall')}</span>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {t('questDetail.videoCallDesc')}
                </p>
              </div>
            )}

            {/* Share buttons in sidebar */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('questDetail.shareTitle')}</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center p-2.5 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition text-sm" title="Facebook">
                  f
                </a>
                <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center p-2.5 bg-black text-white rounded-lg hover:opacity-90 transition text-sm" title="X (Twitter)">
                  𝕏
                </a>
                <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center p-2.5 bg-[#0A66C2] text-white rounded-lg hover:opacity-90 transition text-sm" title="LinkedIn">
                  in
                </a>
                <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center p-2.5 bg-[#25D366] text-white rounded-lg hover:opacity-90 transition text-sm" title="WhatsApp">
                  💬
                </a>
              </div>
              <button
                onClick={handleCopyLink}
                className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-center"
              >
                {t('questDetail.shareCopyLink')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Call Overlay */}
      {showVideoCall && quest && profile && (
        <QuestVideoCall
          questId={questId!}
          questTitle={tTitle}
          questSteps={tSteps}
          userName={profile.name || t('questDetail.defaultUser')}
          userAvatar={profile.avatar_url ?? undefined}
          rewardXP={quest.reward_xp ?? 0}
          onClose={handleLeaveCall}
        />
      )}
    </div>
  );
};

export default QuestDetailPage;
