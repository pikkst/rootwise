import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserReport } from '../types';
import { supabase } from '../services/supabase';
import { formatDateTime } from '../utils/formatDate';

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const initialType = (searchParams.get('type') || 'user') as UserReport['report_type'];
  const initialTargetUserId = searchParams.get('targetUserId') || '';
  const initialTargetPostId = searchParams.get('targetPostId') || '';

  const [reportType, setReportType] = useState<UserReport['report_type']>(initialType);
  const [severity, setSeverity] = useState<UserReport['severity']>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId);
  const [targetPostId, setTargetPostId] = useState(initialTargetPostId);
  const [submitting, setSubmitting] = useState(false);
  const [myReports, setMyReports] = useState<UserReport[]>([]);

  const reportTypeOptions: UserReport['report_type'][] = useMemo(
    () => ['user', 'post', 'bug', 'suggestion', 'other'],
    []
  );

  const loadMyReports = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('user_reports')
      .select('*')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return;
    setMyReports((data as UserReport[]) ?? []);
  };

  useEffect(() => {
    void loadMyReports();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      showToast('error', t('reports.signInFirst'));
      return;
    }
    if (!title.trim() || !description.trim()) {
      showToast('error', t('reports.titleRequired'));
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('user_reports').insert({
      reporter_id: user.id,
      report_type: reportType,
      severity,
      title: title.trim(),
      description: description.trim(),
      target_user_id: targetUserId.trim() || null,
      target_post_id: targetPostId.trim() || null,
      source_path: window.location.pathname,
      status: 'open',
    });

    if (error) {
      showToast('error', error.message || t('reports.failedToast'));
      setSubmitting(false);
      return;
    }

    showToast('success', t('reports.submittedToast'));
    setTitle('');
    setDescription('');
    if (reportType === 'bug' || reportType === 'suggestion' || reportType === 'other') {
      setTargetUserId('');
      setTargetPostId('');
    }
    setSubmitting(false);
    await loadMyReports();
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title={t('reports.seoTitle')} description={t('reports.seoDesc')} path="/reports" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">{t('reports.title')}</h1>
        <p className="text-slate-500 mt-2">{t('reports.subtitle')}</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 mb-8">
        <h2 className="text-lg font-bold mb-5">{t('reports.createReport')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.typeLabel')}</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as UserReport['report_type'])}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {reportTypeOptions.map((type) => (
                  <option key={type} value={type}>{t(`reports.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.severityLabel')}</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as UserReport['severity'])}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="low">{t('reports.severityLow')}</option>
                <option value="medium">{t('reports.severityMedium')}</option>
                <option value="high">{t('reports.severityHigh')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.targetUserLabel')}</label>
              <input
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder={t('reports.uuidPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.targetPostLabel')}</label>
              <input
                value={targetPostId}
                onChange={(e) => setTargetPostId(e.target.value)}
                placeholder={t('reports.uuidPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.titleLabel')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('reports.titlePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 block mb-2">{t('reports.descriptionLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('reports.descPlaceholder')}
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-60"
          >
            {submitting ? t('reports.submitting', 'Submitting...') : t('reports.submitBtn')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
        <h2 className="text-lg font-bold mb-5">{t('reports.myReports')}</h2>
        {myReports.length === 0 ? (
          <p className="text-slate-500">{t('reports.noReports')}</p>
        ) : (
          <div className="space-y-3">
            {myReports.map((report) => (
              <div key={report.id} className="border border-slate-200 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{report.report_type}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">{report.status}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(report.created_at)}</span>
                </div>
                <p className="font-semibold text-slate-800">{report.title}</p>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{report.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
