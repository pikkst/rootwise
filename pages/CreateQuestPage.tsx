import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQuests } from '../hooks/useQuests';
import { supabase } from '../services/supabase';
import { PLAN_LIMITS, isPro, canCreateUserQuest } from '../services/planService';
import { trackEvent } from '../services/analyticsService';
import { QuestRarity } from '../types';

const CATEGORIES = ['Technology', 'Environment', 'Finance', 'Arts', 'Lifestyle', 'Education', 'History'];

const RARITY_OPTIONS: QuestRarity[] = ['common', 'rare', 'epic', 'legendary'];

const ALIGNMENT_QUESTIONS_KEYS = [
  'createQuest.alignQ1',
  'createQuest.alignQ2',
  'createQuest.alignQ3',
  'createQuest.alignQ4',
] as const;

// ----------------------------------------------------------------

const CreateQuestPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { createQuest } = useQuests();
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ---- form state ----
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Education');
  const [questType, setQuestType] = useState<'solo' | 'duo' | 'team'>('duo');
  const [isVirtual, setIsVirtual] = useState(true);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [rarity, setRarity] = useState<QuestRarity>('common');
  const [steps, setSteps] = useState<string[]>(['', '']);
  const [alignment, setAlignment] = useState([false, false, false, false]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ---- async state ----
  const [submitting, setSubmitting] = useState(false);
  const [userCreatedCount, setUserCreatedCount] = useState<number | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);
  const freeMax = PLAN_LIMITS.free.maxUserCreatedQuests;

  // Fetch user's existing custom quest count once
  React.useEffect(() => {
    if (!profile) return;
    supabase
      .rpc('count_user_created_quests')
      .then(({ data }) => setUserCreatedCount(data ?? 0));
  }, [profile]);

  // ---- handlers ----
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', t('createQuest.imageTooBig'));
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addStep = () => setSteps((s) => [...s, '']);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, val: string) => setSteps((s) => s.map((v, idx) => (idx === i ? val : v)));
  const toggleAlignment = (i: number) =>
    setAlignment((a) => a.map((v, idx) => (idx === i ? !v : v)));

  const validate = (): string | null => {
    if (!title.trim()) return t('createQuest.validationTitle');
    if (description.trim().length < 20) return t('createQuest.validationDesc');
    const filled = steps.filter((s) => s.trim()).length;
    if (filled < 2) return t('createQuest.validationSteps');
    if (!alignment.every(Boolean)) return t('createQuest.validationAlignment');
    return null;
  };

  const handleSubmit = useCallback(async () => {
    if (!profile) { navigate('/auth'); return; }

    // Plan gate
    if (userCreatedCount !== null && !canCreateUserQuest(plan, userCreatedCount)) {
      setShowUpgrade(true);
      return;
    }

    const err = validate();
    if (err) { showToast('error', err); return; }

    // Non-pro can only create common rarity
    const finalRarity: QuestRarity = hasPro ? rarity : 'common';

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      // Upload cover image if provided
      if (imageFile && profile) {
        const ext = imageFile.name.split('.').pop();
        const path = `quest-images/${profile.id}/custom-${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('profile-media')
          .upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (!uploadError && uploadData) {
          const { data: pub } = supabase.storage.from('profile-media').getPublicUrl(uploadData.path);
          imageUrl = pub.publicUrl;
        }
      }

      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await createQuest({
        title: title.trim(),
        description: description.trim(),
        category,
        quest_type: questType,
        is_virtual: isVirtual,
        steps: steps.filter((s) => s.trim()),
        skills_required: skills,
        age_range_min: ageMin ? parseInt(ageMin) : null,
        age_range_max: ageMax ? parseInt(ageMax) : null,
        reward_xp: questType === 'solo' ? 75 : questType === 'duo' ? 150 : 200,
        rarity: finalRarity,
        image_url: imageUrl,
        created_by: profile.id,
        status: 'published',
        location: null,
        address_lat: null,
        address_lng: null,
        community_id: null,
        is_user_created: true,
      } as any);

      void trackEvent('user_quest_created', {
        category,
        questType,
        rarity: finalRarity,
        hasImage: !!imageUrl,
      });

      showToast('success', t('createQuest.successToast'));
      navigate('/quests');
    } catch (e) {
      console.error('Create quest error:', e);
      showToast('error', t('createQuest.errorToast'));
    }
    setSubmitting(false);
  }, [
    profile, plan, hasPro, rarity, userCreatedCount,
    title, description, category, questType, isVirtual,
    steps, skillsInput, ageMin, ageMax, imageFile, alignment,
    createQuest, navigate, showToast, t,
  ]);

  if (!profile) return null;

  const atLimit = !hasPro && userCreatedCount !== null && userCreatedCount >= freeMax;

  return (
    <div className="max-w-3xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title={t('createQuest.seoTitle')}
        description={t('createQuest.seoDesc')}
        path="/quests/create"
      />

      {/* Header */}
      <div className="mb-10">
        <button
          onClick={() => navigate('/quests')}
          className="text-sm text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-4 transition-colors"
        >
          ← {t('createQuest.backToQuests')}
        </button>
        <h1 className="text-4xl font-black text-slate-800 mb-2">{t('createQuest.title')}</h1>
        <p className="text-slate-500 text-lg">{t('createQuest.subtitle')}</p>

        {/* Free plan banner */}
        {!hasPro && (
          <div className={`mt-4 flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-medium ${
            atLimit ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span>{atLimit ? '🔒' : '💡'}</span>
            <span>
              {atLimit
                ? t('createQuest.freeLimitReached', { n: userCreatedCount, max: freeMax })
                : t('createQuest.freeInfo', { used: userCreatedCount ?? 0, max: freeMax })
              }
            </span>
            {atLimit && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="ml-auto underline font-bold"
              >
                {t('common.upgrade')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* ── SECTION 1: Basic Info ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-black flex items-center justify-center">1</span>
            {t('createQuest.step1Title')}
          </h2>

          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t('createQuest.labelTitle')} <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder={t('createQuest.titlePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-slate-800 placeholder-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{title.length}/120</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {t('createQuest.labelDescription')} <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={800}
                placeholder={t('createQuest.descPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition text-slate-800 placeholder-slate-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{description.length}/800</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('createQuest.labelCategory')}
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      category === cat
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {t(`quests.category${cat}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Quest Mechanics ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-black flex items-center justify-center">2</span>
            {t('createQuest.step2Title')}
          </h2>

          <div className="space-y-6">
            {/* Quest Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('createQuest.labelType')}</label>
              <div className="grid grid-cols-3 gap-3">
                {(['solo', 'duo', 'team'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setQuestType(type)}
                    className={`relative flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all ${
                      questType === type
                        ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100'
                        : 'border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <span className="text-2xl">{type === 'solo' ? '🧑' : type === 'duo' ? '👴👧' : '👥'}</span>
                    <span className="text-sm font-bold text-slate-700 capitalize">{t(`createQuest.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}</span>
                    {type === 'duo' && (
                      <span className="absolute -top-2 -right-1 text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                        {t('createQuest.bestTag')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Virtual toggle */}
            <div className="flex items-center justify-between py-4 px-5 bg-slate-50 rounded-2xl">
              <div>
                <p className="font-semibold text-slate-700">{t('createQuest.labelVirtual')}</p>
                <p className="text-xs text-slate-400">{t('createQuest.virtualHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVirtual((v) => !v)}
                className={`relative w-12 h-7 rounded-full transition-colors ${isVirtual ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isVirtual ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('createQuest.labelAgeRange')}</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  min={5} max={120}
                  placeholder={t('createQuest.labelAgeMin')}
                  className="w-28 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="number"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  min={5} max={120}
                  placeholder={t('createQuest.labelAgeMax')}
                  className="w-28 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center"
                />
                <span className="text-xs text-slate-400">{t('createQuest.ageOptional')}</span>
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('createQuest.labelSkills')}</label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder={t('createQuest.skillsPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {skillsInput && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {skillsInput.split(',').map((s, i) => s.trim() && (
                    <span key={i} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                      {s.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rarity */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {t('createQuest.labelRarity')}
                {!hasPro && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">{t('createQuest.rarityHint')}</span>
                )}
              </label>
              <div className="flex gap-2 flex-wrap">
                {RARITY_OPTIONS.map((r) => {
                  const locked = !hasPro && r !== 'common';
                  const colors: Record<QuestRarity, string> = {
                    common: 'bg-slate-100 text-slate-600 border-slate-200',
                    rare: 'bg-sky-100 text-sky-700 border-sky-300',
                    epic: 'bg-purple-100 text-purple-700 border-purple-300',
                    legendary: 'bg-amber-100 text-amber-700 border-amber-300',
                  };
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setRarity(r)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${colors[r]} ${
                        rarity === r ? 'ring-2 ring-offset-1 ring-indigo-400 shadow-md' : ''
                      } ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-sm'}`}
                    >
                      {t(`rarity.${r}`)} {locked && '🔒'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Quest Steps ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-black flex items-center justify-center">3</span>
            {t('createQuest.step3Title')}
          </h2>
          <p className="text-sm text-slate-500 mb-6">{t('createQuest.stepsHint')}</p>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 text-xs font-black flex items-center justify-center mt-2.5">
                  {i + 1}
                </div>
                <textarea
                  rows={2}
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={t('createQuest.stepPlaceholder', { n: i + 1 })}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none text-sm text-slate-800 placeholder-slate-400"
                />
                {steps.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="mt-3 text-slate-400 hover:text-rose-500 text-lg leading-none transition-colors"
                    aria-label={t('createQuest.removeStep')}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {steps.length < 10 && (
            <button
              type="button"
              onClick={addStep}
              className="mt-4 flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-lg leading-none">+</span>
              {t('createQuest.addStep')}
            </button>
          )}
        </section>

        {/* ── SECTION 4: Platform Alignment ── */}
        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-200 p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-black flex items-center justify-center">4</span>
            {t('createQuest.alignmentTitle')}
          </h2>
          <p className="text-sm text-slate-600 mb-6">{t('createQuest.alignmentDesc')}</p>

          <div className="space-y-3">
            {ALIGNMENT_QUESTIONS_KEYS.map((key, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleAlignment(i)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                  alignment[i]
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-black border-2 transition-all ${
                  alignment[i] ? 'bg-white border-white text-emerald-600' : 'border-slate-300 text-transparent'
                }`}>
                  ✓
                </div>
                <span className="text-sm font-semibold">{t(key)}</span>
              </button>
            ))}
          </div>

          {!alignment.every(Boolean) && alignment.some(Boolean) && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
              ⚠️ {t('createQuest.alignmentWarning')}
            </p>
          )}
        </section>

        {/* ── SECTION 5: Cover Image ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-sm font-black flex items-center justify-center">5</span>
            {t('createQuest.imageTitle')}
          </h2>
          <p className="text-sm text-slate-500 mb-5">{t('createQuest.imageHint')}</p>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageChange}
          />

          {imagePreview ? (
            <div className="relative group">
              <img
                src={imagePreview}
                alt="Quest cover preview"
                className="w-full h-48 object-cover rounded-2xl border border-slate-200"
              />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-3 right-3 bg-white/90 text-rose-500 w-8 h-8 rounded-full flex items-center justify-center shadow hover:bg-white text-lg font-bold"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <span className="text-4xl">🖼️</span>
              <span className="text-sm font-semibold">{t('createQuest.imageUpload')}</span>
            </button>
          )}
        </section>

        {/* ── SUBMIT ── */}
        <div className="flex flex-col gap-3 pt-2">
          {atLimit && (
            <p className="text-center text-sm text-rose-600 font-semibold">
              🔒 {t('createQuest.freeLimitReached', { n: userCreatedCount, max: freeMax })}
            </p>
          )}
          <button
            type="button"
            disabled={submitting || atLimit}
            onClick={() => void handleSubmit()}
            className="w-full py-5 bg-indigo-600 text-white font-black text-lg rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-300/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t('createQuest.submitting')}
              </>
            ) : (
              <>🚀 {t('createQuest.submitBtn')}</>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/quests')}
            className="py-3 text-slate-500 text-sm font-semibold hover:text-slate-800 transition-colors"
          >
            {t('createQuest.backToQuests')}
          </button>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={t('createQuest.upgradeFeature')}
        requiredPlan="pro"
      />
    </div>
  );
};

export default CreateQuestPage;
