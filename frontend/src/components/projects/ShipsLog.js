/**
 * ShipsLog — structured project updates with signal filtering
 *
 * Builders post typed updates (milestone, revenue, users, etc.) with
 * optional metrics and media. Backers filter by signal level.
 * Low-signal updates (bugfix, development) are collapsed by default.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase/clientApp';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Card } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { Input, Textarea, Select } from '@/components/common/Input';
import { LoadingSpinner } from '@/components/common/LoadingStates';
import { useUser } from '@/stores/authStore';
import StructuredUpdateCard, { UPDATE_TYPES } from './StructuredUpdateCard';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  FunnelIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High Signal' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'users', label: 'Users' },
  { id: 'launch', label: 'Launches' },
];

export default function ShipsLog({ projectSlug, canEdit }) {
  const { currentUser } = useUser();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showLowSignal, setShowLowSignal] = useState(false);

  // Form state
  const [updateType, setUpdateType] = useState('milestone');
  const [message, setMessage] = useState('');
  const [metrics, setMetrics] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!projectSlug) return;

    const q = query(
      collection(db, 'ships_logs'),
      where('projectSlug', '==', projectSlug),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(newLogs);
      setLoading(false);
    }, (error) => {
      console.warn('Ships log unavailable:', error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectSlug]);

  // Filtered + sorted logs
  const { highSignal, lowSignal, filteredLogs } = useMemo(() => {
    const high = [];
    const low = [];

    for (const log of logs) {
      const type = UPDATE_TYPES[log.type] || UPDATE_TYPES.development;
      if (type.weight === 'low') {
        low.push(log);
      } else {
        high.push(log);
      }
    }

    let filtered = [...logs];
    if (activeFilter !== 'all') {
      if (activeFilter === 'high') {
        filtered = high;
      } else {
        filtered = logs.filter((l) => l.type === activeFilter);
      }
    }

    return { highSignal: high, lowSignal: low, filteredLogs: filtered };
  }, [logs, activeFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/projects/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectSlug,
          message: message.trim(),
          type: updateType,
          metrics: Object.fromEntries(
            Object.entries(metrics).filter(([, v]) => v !== '' && v != null)
          ),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to post update');
      }

      setMessage('');
      setMetrics({});
      setUpdateType('milestone');
    } catch (error) {
      console.error('Error posting update:', error);
      alert(error.message || 'Failed to post update.');
    } finally {
      setSubmitting(false);
    }
  };

  const addMetricField = () => {
    const key = prompt('Metric name (e.g. users, mrr, dau):');
    if (!key || !key.trim()) return;
    setMetrics((prev) => ({ ...prev, [key.trim().toLowerCase()]: '' }));
  };

  const updateMetricValue = (key, value) => {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  };

  const removeMetric = (key) => {
    setMetrics((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const lowSignalCount = lowSignal.length;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <ChatBubbleLeftRightIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">The Ship's Log</h2>
        {highSignal.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {highSignal.length} high signal
          </span>
        )}
      </div>

      {/* Post form — builders only */}
      {canEdit && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Select
              value={updateType}
              onChange={(e) => setUpdateType(e.target.value)}
              className="w-auto"
            >
              {Object.entries(UPDATE_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </Select>
            {UPDATE_TYPES[updateType]?.weight === 'high' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                High signal — notifies backers
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                updateType === 'milestone' ? 'e.g. Deployed v2 with cross-chain swaps' :
                updateType === 'revenue' ? 'e.g. Hit $5k MRR this month' :
                updateType === 'users' ? 'e.g. Crossed 10,000 active users' :
                updateType === 'launch' ? 'e.g. Launched on mainnet!' :
                'What changed?'
              }
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-touch text-sm"
              disabled={submitting}
            />
            <Button
              type="submit"
              disabled={!message.trim() || submitting}
              loading={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white min-h-touch min-w-touch flex items-center justify-center"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </Button>
          </div>

          {/* Metrics */}
          <div className="space-y-2">
            {Object.entries(metrics).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 text-right">{key}:</span>
                <input
                  type={key === 'revenue' || key === 'mrr' || key === 'arr' ? 'number' : 'text'}
                  value={val}
                  onChange={(e) => updateMetricValue(key, e.target.value)}
                  placeholder={
                    key === 'revenue' ? '$' :
                    key === 'users' || key === 'dau' || key === 'mau' ? 'count' :
                    'value'
                  }
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeMetric(key)}
                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:text-red-400"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addMetricField}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 flex items-center gap-1"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add metric
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            High-signal updates (milestones, revenue, users, launches) appear
            prominently and notify backers. Low-signal updates are collapsed by default.
          </p>
        </form>
      )}

      {/* Filter pills */}
      {logs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 overflow-x-auto">
          <FunnelIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mr-1" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                activeFilter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Update list */}
      <div className="space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredLogs.length === 0 && !showLowSignal ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8 italic">
            {activeFilter !== 'all'
              ? `No ${activeFilter} updates yet.`
              : 'No updates yet. Post the first one!'}
          </p>
        ) : (
          <>
            {/* High + medium signal updates */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
              <div className="space-y-1">
                {filteredLogs
                  .filter((l) => {
                    const type = UPDATE_TYPES[l.type] || UPDATE_TYPES.development;
                    return type.weight !== 'low';
                  })
                  .map((log) => (
                    <StructuredUpdateCard key={log.id} update={log} />
                  ))}
              </div>
            </div>

            {/* Low signal toggle */}
            {lowSignalCount > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowLowSignal(!showLowSignal)}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-300 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors w-full"
                >
                  <div className="flex-1 h-px bg-gray-200" />
                  {showLowSignal ? 'Hide' : `Show ${lowSignalCount}`} development & bug fix updates
                  <div className="flex-1 h-px bg-gray-200" />
                </button>

                {showLowSignal && (
                  <div className="space-y-1 mt-2">
                    {filteredLogs
                      .filter((l) => {
                        const type = UPDATE_TYPES[l.type] || UPDATE_TYPES.development;
                        return type.weight === 'low';
                      })
                      .map((log) => (
                        <StructuredUpdateCard key={log.id} update={log} isCompact />
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
