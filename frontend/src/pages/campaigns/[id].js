/**
 * Campaign Detail Page
 * View campaign details and submit testing evidence
 * 
 * Uses:
 * - useCampaigns for campaign data
 * - useCampaignSubmissions for submission management
 * - SubmissionForm for tester input
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '@/stores/authStore';
import useCampaigns from '@/hooks/useCampaigns';
import useCampaignSubmissions from '@/hooks/useCampaignSubmissions';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { SubmissionForm } from '@/components/campaigns';
import {
  ExclamationTriangleIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  CheckIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id: campaignId } = router.query;
  const { currentUser } = useUser();
  const { getCampaign, loading: campaignLoading, error: campaignError } = useCampaigns();
  const { getSubmissionsByCampaign, createSubmission, loading: submissionLoading } = useCampaignSubmissions();

  const [campaign, setCampaign] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [userSubmission, setUserSubmission] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fetch campaign and submissions
  useEffect(() => {
    if (!campaignId) return;

    const loadData = async () => {
      try {
        const camp = await getCampaign(campaignId);
        setCampaign(camp);

        const subs = await getSubmissionsByCampaign(campaignId);
        setSubmissions(subs || []);

        if (currentUser) {
          const userSub = subs?.find(s => s.testerId === currentUser.uid);
          setUserSubmission(userSub);
        }
      } catch (err) {
        console.error('Failed to load campaign:', err);
      }
    };

    loadData();
  }, [campaignId, currentUser, getCampaign, getSubmissionsByCampaign]);

  const handleSubmit = async (data) => {
    if (!currentUser) {
      router.push(`/login?redirectTo=/campaigns/${campaignId}`);
      return;
    }

    setSubmitError(null);
    try {
      const submissionData = {
        ...data,
        campaignId,
        testerId: currentUser.uid,
      };

      const newSubmissionId = await createSubmission(submissionData);
      
      // Reload submissions
      const updated = await getSubmissionsByCampaign(campaignId);
      setSubmissions(updated || []);
      
      const newSub = updated?.find(s => s.id === newSubmissionId);
      setUserSubmission(newSub);
      setShowSubmissionForm(false);
    } catch (error) {
      console.error('Submission error:', error);
      setSubmitError(error.message || 'Failed to submit');
    }
  };

  if (!campaignId) return null;

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
        <Head>
          <title>Campaign Not Found</title>
        </Head>
        <div className="max-w-4xl mx-auto px-4">
          <Card className="p-8 text-center">
            <ExclamationTriangleIcon className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Campaign Not Found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">This campaign could not be found or is no longer available.</p>
            <Button onClick={() => router.push('/campaigns')}>Back to Campaigns</Button>
          </Card>
        </div>
      </div>
    );
  }

  const deadline = new Date(campaign.deadline);
  const now = new Date();
  const isOpen = campaign.status === 'open' && deadline > now;
  const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  const spotsRemaining = campaign.maxSubmissions - (campaign.stats?.totalSubmissions || 0);
  const passedScenarios = submissions.filter(s => s.status === 'approved').length;

  return (
    <>
      <Head>
        <title>{campaign.title} - Testing Campaign</title>
        <meta name="description" content={campaign.description} />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-300 mb-8"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Campaigns
          </button>

          {/* Header Card */}
          <Card className="p-6 mb-6">
            <div className="space-y-4">
              {/* Title and Status */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{campaign.title}</h1>
                  {campaign.projectId && (
                    <p className="text-gray-600 dark:text-gray-400 mt-2">for project {campaign.projectId}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isOpen && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      <CheckIcon className="w-4 h-4" />
                      Open
                    </span>
                  )}
                  {!isOpen && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      Closed
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Reward</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${campaign.budget?.perSubmission || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isOpen ? 'Time Left' : 'Ended'}
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {daysRemaining > 0 ? `${daysRemaining} days` : 'Closed'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Submissions</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {campaign.stats?.totalSubmissions || 0} / {campaign.maxSubmissions}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">About This Campaign</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{campaign.description}</p>
          </Card>

          {/* Test Scenarios */}
          {campaign.testScenarios && campaign.testScenarios.length > 0 && (
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                What to Test ({campaign.testScenarios.length} scenarios)
              </h2>
              <div className="space-y-4">
                {campaign.testScenarios.map((scenario, idx) => (
                  <div key={scenario.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                      {idx + 1}. {scenario.title}
                    </h3>
                    <ol className="space-y-1 mb-3 text-sm text-blue-800 dark:text-blue-200">
                      {scenario.steps?.map((step, stepIdx) => (
                        <li key={stepIdx} className="ml-4">
                          {stepIdx + 1}. {step}
                        </li>
                      ))}
                    </ol>
                    {scenario.expectedResult && (
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-semibold">Expected:</span> {scenario.expectedResult}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Requirements */}
          {campaign.requirements && campaign.requirements.length > 0 && (
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Requirements</h2>
              <ul className="space-y-2">
                {campaign.requirements.map((req, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">•</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{req.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{req.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* User's Submission */}
          {userSubmission && (
            <Card className="p-6 mb-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-3 mb-3">
                <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-green-900 dark:text-green-200">Your Submission</h3>
              </div>
              <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                Status: <span className="font-medium capitalize">{userSubmission.status}</span>
              </p>
              {userSubmission.results?.overallRating > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-green-800 dark:text-green-200">Rating:</span>
                  <span className="font-semibold text-green-900 dark:text-green-200">
                    {userSubmission.results.overallRating}/5 ⭐
                  </span>
                </div>
              )}
              {userSubmission.approvalNotes && (
                <p className="text-sm text-green-800 dark:text-green-200 mt-2 p-2 bg-green-100 dark:bg-green-900/50 rounded">
                  {userSubmission.approvalNotes}
                </p>
              )}
            </Card>
          )}

          {/* Submission Form or CTA */}
          {!userSubmission && isOpen && spotsRemaining > 0 ? (
            <>
              {!showSubmissionForm ? (
                <Card className="p-6 mb-6">
                  <div className="flex items-start gap-4">
                    <SparklesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to Test?</h2>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Complete the test scenarios above and submit your findings with proof.
                      </p>
                      {submitError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{submitError}</p>
                      )}
                      {!currentUser ? (
                        <Button onClick={() => router.push(`/login?redirectTo=/campaigns/${campaignId}`)}>
                          Sign In to Submit
                        </Button>
                      ) : (
                        <Button onClick={() => setShowSubmissionForm(true)}>
                          Start Submission
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ) : (
                <SubmissionForm
                  campaign={campaign}
                  onSubmit={handleSubmit}
                  isLoading={submissionLoading}
                />
              )}
            </>
          ) : !isOpen && !userSubmission ? (
            <Card className="p-6 mb-6 bg-gray-100 dark:bg-gray-800">
              <p className="text-gray-700 dark:text-gray-300">
                This campaign is no longer accepting submissions.
              </p>
            </Card>
          ) : null}

          {/* Submission Stats */}
          {submissions.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                <SparklesIcon className="inline w-5 h-5 mr-2" />
                Submissions ({submissions.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Approved</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{campaign.stats?.approvedSubmissions || 0}</p>
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">
                    {submissions.filter(s => s.status === 'submitted').length}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <p className="text-xs text-purple-600 dark:text-purple-400">Avg Rating</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                    {campaign.stats?.averageRating ? `${campaign.stats.averageRating}★` : '–'}
                  </p>
                </div>
              </div>

              {/* Recent Submissions */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {submissions.slice(0, 10).map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {sub.results?.overallRating && `⭐${sub.results.overallRating}/5`}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      sub.status === 'approved'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : sub.status === 'rejected'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
