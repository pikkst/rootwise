import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!questId || !profile?.id) return;
    fetchQuestDetails();
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

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('quest_messages')
        .select('*')
        .eq('quest_id', questId)
        .order('created_at', { ascending: true });
      setMessages((messagesData as QuestMessage[]) ?? []);

      // Fetch files
      const { data: filesData } = await supabase
        .from('quest_files')
        .select('*')
        .eq('quest_id', questId)
        .order('created_at', { ascending: false });
      setFiles((filesData as QuestFile[]) ?? []);

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from('quest_milestones')
        .select('*')
        .eq('quest_id', questId)
        .order('created_at', { ascending: true });
      setMilestones((milestonesData as QuestMilestone[]) ?? []);
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

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={`${quest.title} - Rootwise`} description={quest.description ?? ''} path={`/quests/${questId}`} />

      {/* Header */}
      <header className="mb-8">
        <button
          onClick={() => navigate('/quests')}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold mb-4"
        >
          ← Back to Quests
        </button>
        <h1 className="text-4xl font-bold text-slate-800">{quest.title}</h1>
        <div className="flex gap-2 mt-3">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-full">
            {quest.quest_type}
          </span>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-semibold rounded-full">
            {quest.status}
          </span>
          {quest.is_virtual && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
              Virtual
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
            <div className="flex border-b border-slate-200">
              {(['overview', 'chat', 'files', 'milestones', 'members', 'proof'] as Tab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 px-4 text-center font-semibold transition ${
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

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">About This Quest</h2>
                  <p className="text-slate-600 mb-6">{quest.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">XP Reward</div>
                      <div className="text-2xl font-bold text-indigo-600">{quest.reward_xp}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="text-sm text-slate-600">Category</div>
                      <div className="text-2xl font-bold text-slate-800">{quest.category}</div>
                    </div>
                  </div>

                  {quest.skills_required && quest.skills_required.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-slate-800 mb-2">Required Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {quest.skills_required.map((skill) => (
                          <span key={skill} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {quest.steps && quest.steps.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">Steps</h3>
                      <ol className="space-y-2">
                        {quest.steps.map((step: string, idx: number) => (
                          <li key={idx} className="text-slate-600 flex gap-2">
                            <span className="font-bold text-indigo-600">{idx + 1}.</span>
                            <span>{step}</span>
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
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Files & Resources</h2>

                  {!isMember ? (
                    <div className="bg-slate-50 rounded-lg p-6 text-center">
                      <p className="text-slate-600">Join this quest to view and upload files</p>
                    </div>
                  ) : (
                    <div>
                      {files.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No files yet</p>
                      ) : (
                        <div className="space-y-2">
                          {files.map((file) => (
                            <a
                              key={file.id}
                              href={file.file_url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                            >
                              <span className="text-lg">📄</span>
                              <div className="flex-1">
                                <div className="font-semibold text-slate-800">{file.file_name}</div>
                                <div className="text-xs text-slate-500">
                                  {new Date(file.created_at ?? '').toLocaleDateString()}
                                </div>
                              </div>
                              <span className="text-xs text-indigo-600">Download →</span>
                            </a>
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
                            placeholder="Describe your proof of completion..."
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                            rows={4}
                          />
                          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                            Submit Proof
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
                onClick={() => {
                  if (!profile) navigate('/auth');
                  // handleJoinQuest
                }}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold mb-4"
              >
                Join Quest
              </button>
            )}

            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-600">Members</div>
                <div className="text-2xl font-bold text-slate-800">{members.length}</div>
              </div>

              <div>
                <div className="text-sm text-slate-600">XP Reward</div>
                <div className="text-2xl font-bold text-indigo-600">{quest.reward_xp}</div>
              </div>

              <div>
                <div className="text-sm text-slate-600">Status</div>
                <div className="text-lg font-bold text-slate-800 capitalize">{quest.status}</div>
              </div>

              {!quest.is_virtual && quest.location && (
                <div>
                  <div className="text-sm text-slate-600">Location</div>
                  <div className="text-sm text-slate-800">{quest.location}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestDetailPage;
