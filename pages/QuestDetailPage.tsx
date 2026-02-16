import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { DbQuest, QuestMember, QuestMessage, QuestFile, QuestMilestone, Profile } from '../types';

type Tab = 'overview' | 'chat' | 'files' | 'milestones' | 'members' | 'proof';

interface MessageWithAuthor extends QuestMessage {
  author?: Profile;
}

const QuestDetailPage: React.FC = () => {
  const { questId } = useParams<{ questId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();

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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
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
      showToast('error', 'Failed to load quest details');
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
        showToast('error', 'Failed to send message');
      } else {
        setMessageText('');
        await fetchQuestDetails();
        showToast('success', 'Message sent!');
      }
    } catch (err) {
      showToast('error', 'An error occurred');
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
        showToast('error', 'Failed to update milestone');
      } else {
        await fetchQuestDetails();
        showToast('success', 'Milestone updated!');
      }
    } catch (err) {
      showToast('error', 'An error occurred');
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
        status: 'active',
        joined_at: new Date().toISOString(),
        proof_submitted: null,
        proof_verified: false,
      });

      if (error) {
        showToast('error', error.message || 'Failed to join quest');
      } else {
        showToast('success', 'Successfully joined the quest!');
        await fetchQuestDetails();
      }
    } catch (err) {
      showToast('error', 'An error occurred while joining');
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
        showToast('error', 'Failed to submit proof');
      } else {
        setProofText('');
        await fetchQuestDetails();
        showToast('success', 'Proof submitted! Waiting for mentor verification.');
      }
    } catch (err) {
      showToast('error', 'An error occurred');
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !questId || !profile?.id || uploadingFile) return;

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      showToast('error', `File type not supported. Allowed: images, PDF, MP4, text documents.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size
    const maxSize = getMaxSize(file.type);
    if (file.size > maxSize) {
      showToast('error', `File too large. Maximum size for this type: ${formatBytes(maxSize)}`);
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
      showToast('success', `"${file.name}" uploaded successfully!`);
    } catch (err: any) {
      console.error('File upload error:', err);
      showToast('error', err?.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: QuestFile) => {
    if (!profile?.id || deletingFileId) return;

    // Only uploader can delete
    if (file.user_id !== profile.id) {
      showToast('error', 'You can only delete your own files.');
      return;
    }

    if (!window.confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return;

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
      showToast('success', 'File deleted.');
    } catch (err: any) {
      console.error('File delete error:', err);
      showToast('error', err?.message || 'Failed to delete file');
    } finally {
      setDeletingFileId(null);
    }
  };

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
          <p className="text-slate-600 mb-4">Quest not found</p>
          <button
            onClick={() => navigate('/quests')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Quests
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
  const shareText = `Check out this quest on Rootwise: "${quest.title}" — ${quest.description?.slice(0, 100) ?? ''}...`;

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(questUrl)}`,
    twitter: `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(questUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(questUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${questUrl}`)}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(questUrl);
      showToast('success', 'Link copied to clipboard!');
    } catch {
      showToast('error', 'Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: quest.title, text: shareText, url: questUrl });
      } catch { /* user cancelled */ }
    } else {
      setShowShareMenu((v) => !v);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-32">
      <SEOHead title={`${quest.title} - Rootwise`} description={quest.description ?? ''} path={`/quests/${questId}`} />

      {/* Header */}
      <header className="mb-8">
        <button
          onClick={() => navigate('/quests')}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold mb-4 inline-flex items-center gap-1"
        >
          ← Back to Quests
        </button>

        {/* Quest image banner */}
        {quest.image_url && (
          <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden mb-6">
            <img src={quest.image_url} alt={quest.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 leading-tight">{quest.title}</h1>
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
              🌐 Virtual
            </span>
          )}

          {/* Share button */}
          <div className="relative ml-auto" data-share-menu>
            <button
              onClick={handleNativeShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition"
            >
              📤 Share
            </button>

            {showShareMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 min-w-[200px]">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Share this quest</p>
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
                  🔗 Copy link
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

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
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                )
              )}
            </div>

            <div className="p-4 sm:p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-3">About This Quest</h2>
                  <p className="text-slate-600 leading-relaxed mb-6 text-[15px]">{quest.description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-4 border border-indigo-100">
                      <div className="text-xs font-medium text-indigo-500 uppercase tracking-wide mb-1">XP Reward</div>
                      <div className="text-2xl font-bold text-indigo-600">⭐ {quest.reward_xp}</div>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Category</div>
                      <div className="text-lg font-bold text-slate-800">{quest.category}</div>
                    </div>
                  </div>

                  {quest.skills_required && quest.skills_required.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">Required Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {quest.skills_required.map((skill) => (
                          <span key={skill} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium border border-indigo-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {quest.steps && quest.steps.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Steps to Complete</h3>
                      <ol className="space-y-3">
                        {quest.steps.map((step: string, idx: number) => (
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Quest Chat</h2>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">Join this quest to participate in the chat</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4 h-80 overflow-y-auto mb-4 space-y-3">
                        {messages.length === 0 ? (
                          <p className="text-slate-500 text-center py-8">No messages yet. Be the first to chat!</p>
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
                                  {msg.user_id === profile?.id ? 'You' : `User ${msg.user_id.slice(0, 8)}`}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {new Date(msg.created_at ?? '').toLocaleTimeString()}
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
                          placeholder="Type a message..."
                          disabled={sendingMessage}
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={sendingMessage || !messageText.trim()}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingMessage ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1">Files & Resources</h2>
                  <p className="text-xs text-slate-400 mb-4">Images, PDFs, articles, videos (MP4)</p>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <p className="text-slate-600">Join this quest to view and upload files</p>
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
                              <span className="text-sm font-medium text-indigo-600">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-3xl">📎</span>
                              <span className="text-sm font-medium text-indigo-600">Click to upload a file</span>
                              <span className="text-xs text-slate-400">
                                Images (10 MB) · PDF (20 MB) · MP4 (100 MB) · Text (5 MB)
                              </span>
                            </>
                          )}
                        </label>
                      </div>

                      {/* File list */}
                      {files.length === 0 ? (
                        <p className="text-slate-400 text-center py-6 text-sm">No files uploaded yet. Be the first!</p>
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
                                  {file.file_name || 'Unnamed file'}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                  <span>{ALLOWED_TYPES[file.file_type ?? ''] || 'File'}</span>
                                  {file.file_size && <span>· {formatBytes(file.file_size)}</span>}
                                  <span>· {new Date(file.created_at ?? file.uploaded_at ?? '').toLocaleDateString()}</span>
                                </div>
                              </a>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <a
                                  href={file.file_url ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition text-xs font-medium"
                                  title="Download"
                                >
                                  ⬇️
                                </a>
                                {file.user_id === profile?.id && (
                                  <button
                                    onClick={() => handleDeleteFile(file)}
                                    disabled={deletingFileId === file.id}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition text-xs opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    title="Delete"
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Milestones</h2>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">Join this quest to track progress</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {milestones.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No milestones yet</p>
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
                              {new Date(milestone.created_at ?? '').toLocaleDateString()}
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Quest Members</h2>
                  <div className="space-y-2">
                    {members.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">No members yet</p>
                    ) : (
                      members.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                          <div>
                            <div className="font-semibold text-slate-800 capitalize">{member.role}</div>
                            <div className="text-xs text-slate-500">{member.status}</div>
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Proof & Verification</h2>

                  {!isLearner ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">Only learners can submit proof</p>
                    </div>
                  ) : (
                    <div>
                      {currentMember?.proof_submitted ? (
                        <div className="bg-slate-50 rounded-lg p-6 mb-4">
                          <h3 className="font-semibold text-slate-800 mb-2">Your Submitted Proof</h3>
                          <p className="text-slate-600 mb-3">
                            Proof Type: {typeof currentMember.proof_submitted === 'object' && 'type' in currentMember.proof_submitted ? (currentMember.proof_submitted as any).type : 'Unknown'}
                          </p>
                          <div className={`p-4 rounded-lg ${
                            currentMember.proof_verified
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-yellow-50 border border-yellow-200'
                          }`}>
                            <p className="font-semibold text-slate-800">
                              {currentMember.proof_verified ? '✓ Verified' : '⏳ Pending Review'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-6">
                          <p className="text-slate-600 mb-4">Submit proof of completion for verification</p>
                          <textarea
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Describe your proof of completion (e.g., project link, certificate, description)..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                            rows={4}
                          />
                          <button
                            onClick={handleSubmitProof}
                            disabled={submittingProof || !proofText.trim()}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingProof ? 'Submitting...' : 'Submit Proof'}
                          </button>
                        </div>
                      )}
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
            <h2 className="text-lg font-bold text-slate-800 mb-4">Quest Info</h2>

            {!isMember && (
              <button
                onClick={handleJoinQuest}
                disabled={joiningQuest}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold mb-5 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-sm"
              >
                {joiningQuest ? 'Joining...' : '🚀 Join Quest'}
              </button>
            )}

            {isMember && (
              <div className="mb-5 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-center">
                <span className="text-green-700 font-semibold text-sm">✓ You're a {currentMember?.role}</span>
              </div>
            )}

            <div className="space-y-4 divide-y divide-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Members</span>
                <span className="text-lg font-bold text-slate-800">{members.length}</span>
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-slate-500">XP Reward</span>
                <span className="text-lg font-bold text-indigo-600">⭐ {quest.reward_xp}</span>
              </div>

              <div className="flex items-center justify-between pt-3">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                  quest.status === 'published' ? 'bg-green-100 text-green-700' :
                  quest.status === 'completed' ? 'bg-slate-200 text-slate-600' :
                  quest.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-700'
                }`}>{quest.status?.replace('_', ' ')}</span>
              </div>

              {quest.category && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm text-slate-500">Category</span>
                  <span className="text-sm font-semibold text-slate-700">{quest.category}</span>
                </div>
              )}

              {!quest.is_virtual && quest.location && (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-sm text-slate-500">📍 Location</span>
                  <span className="text-sm text-slate-800">{quest.location}</span>
                </div>
              )}
            </div>

            {/* Share buttons in sidebar */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Share Quest</p>
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
                🔗 Copy link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestDetailPage;
