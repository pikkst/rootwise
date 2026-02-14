import React, { useState } from 'react';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useQuests } from '../hooks/useQuests';
import { profileToUser } from '../types';

const ProfilePage: React.FC = () => {
  const { profile, updateProfile } = useAuth();
  const { quests } = useQuests();
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Local edit state
  const [editName, setEditName] = useState(profile?.name ?? '');
  const [editAge, setEditAge] = useState(profile?.age ?? 0);
  const [editRole, setEditRole] = useState<'Sage' | 'Seeker' | 'Hybrid'>(profile?.role ?? 'Hybrid');
  const [editSkills, setEditSkills] = useState<string[]>(profile?.skills ?? []);
  const [editInterests, setEditInterests] = useState<string[]>(profile?.interests ?? []);
  const [editAvatar, setEditAvatar] = useState(profile?.avatar_url ?? '');

  if (!profile) return null;

  const currentUser = profileToUser(profile);
  const completedQuests = quests.filter(
    (q) => q.status === 'completed' && q.participants.includes(profile.id)
  ).length;

  const startEditing = () => {
    setEditName(profile.name);
    setEditAge(profile.age ?? 0);
    setEditRole(profile.role);
    setEditSkills([...profile.skills]);
    setEditInterests([...profile.interests]);
    setEditAvatar(profile.avatar_url ?? '');
    setIsEditingProfile(true);
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await updateProfile({
      name: editName,
      age: editAge,
      role: editRole,
      skills: editSkills,
      interests: editInterests,
      avatar_url: editAvatar || null,
    });
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

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={`${currentUser.name} - Rootwise Profile`} description="Your Rootwise profile." path="/profile" />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
          <div className="absolute -bottom-16 left-8">
            <div className="relative group">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-32 h-32 rounded-3xl border-4 border-white object-cover shadow-lg bg-slate-100"
              />
              {isEditingProfile && (
                <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-white text-xs font-bold">Change Image</span>
                </div>
              )}
            </div>
          </div>
          <div className="absolute bottom-4 right-8">
            {!isEditingProfile ? (
              <button
                onClick={startEditing}
                className="px-6 py-2 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-xl font-bold hover:bg-white/30 transition-all"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="px-6 py-2 bg-slate-800/40 backdrop-blur-md text-white rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  form="profile-form"
                  type="submit"
                  className="px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-20 px-8 pb-10">
          {!isEditingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">
                    {currentUser.name}, {currentUser.age || '?'}
                  </h2>
                  <p className="text-indigo-600 font-semibold">{currentUser.role}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-3">Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.skills.map((s) => (
                      <span key={s} className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium">
                        {s}
                      </span>
                    ))}
                    {currentUser.skills.length === 0 && (
                      <span className="text-slate-400 text-sm">No skills added yet.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.interests.map((i) => (
                      <span key={i} className="px-4 py-1 bg-slate-50 text-slate-600 rounded-full text-sm font-medium">
                        {i}
                      </span>
                    ))}
                    {currentUser.interests.length === 0 && (
                      <span className="text-slate-400 text-sm">No interests added yet.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-bold mb-4">Legacy Stats</h4>
                  <div className="space-y-4">
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
              </div>
            </div>
          ) : (
            <form id="profile-form" onSubmit={handleProfileUpdate} className="space-y-6 max-w-2xl">
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
                <label className="text-sm font-bold text-slate-600">Avatar URL</label>
                <input
                  type="text"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
