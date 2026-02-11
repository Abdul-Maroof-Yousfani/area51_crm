import { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  Search,
  Filter,
  Calendar,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';
import { useLanguage } from '../../hooks';

// eslint-disable-next-line no-unused-vars
export default function AuditLogsView({ leads, currentUser }) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [dateRange, setDateRange] = useState('7'); // days
  const [expandedLog, setExpandedLog] = useState(null);

  // Fetch audit logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'ai_audit_logs');

        // Calculate date filter
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

        const q = query(
          logsRef,
          where('timestamp', '>=', Timestamp.fromDate(daysAgo)),
          orderBy('timestamp', 'desc'),
          limit(500)
        );

        const snapshot = await getDocs(q);
        const logsData = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [dateRange]);

  // Get unique users from logs
  const users = useMemo(() => {
    const unique = [...new Set(logs.map(l => l.userName).filter(Boolean))];
    return unique.sort();
  }, [logs]);

  // Get interaction types
  const interactionTypes = [
    { value: 'all', label: t('allTypes') },
    { value: 'query', label: t('aiQuery') },
    { value: 'suggestion', label: t('aiSuggestion') },
    { value: 'auto_greeting', label: t('autoGreeting') },
    { value: 'quote_reminder', label: t('quoteReminder') },
    { value: 'lead_summary', label: t('leadSummary') }
  ];

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterType !== 'all' && log.type !== filterType) return false;
      if (filterUser !== 'all' && log.userName !== filterUser) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          log.query?.toLowerCase().includes(search) ||
          log.response?.toLowerCase().includes(search) ||
          log.userName?.toLowerCase().includes(search) ||
          log.leadName?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [logs, filterType, filterUser, searchTerm]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-PK', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'query': return <MessageSquare className="w-4 h-4" />;
      case 'suggestion': return <Sparkles className="w-4 h-4" />;
      case 'auto_greeting': return <Brain className="w-4 h-4" />;
      case 'quote_reminder': return <Clock className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'query': return 'bg-blue-100 text-blue-700';
      case 'suggestion': return 'bg-purple-100 text-purple-700';
      case 'auto_greeting': return 'bg-green-100 text-green-700';
      case 'quote_reminder': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type) => {
    const found = interactionTypes.find(t => t.value === type);
    return found?.label || type || 'AI Interaction';
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-600" />
          {t('aiAuditLogs')}
        </h1>
        <p className="text-xs md:text-sm text-gray-500">
          {t('viewAiHistory')}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchLogs')}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:border-purple-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="text-sm border rounded-lg px-3 py-2 outline-none focus:border-purple-400"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {interactionTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <select
              className="text-sm border rounded-lg px-3 py-2 outline-none focus:border-purple-400"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="all">{t('allUsers')}</option>
              {users.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              className="text-sm border rounded-lg px-3 py-2 outline-none focus:border-purple-400"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="1">{t('last24Hours')}</option>
              <option value="7">{t('last7Days')}</option>
              <option value="30">{t('last30Days')}</option>
              <option value="90">{t('last90Days')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium">{t('noAuditLogs')}</p>
            <p className="text-sm">{t('auditLogsPlaceholder')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                {/* Log Header */}
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    {/* Type Icon */}
                    <div className={`p-2 rounded-lg ${getTypeColor(log.type)}`}>
                      {getTypeIcon(log.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                          {getTypeLabel(log.type)}
                        </span>
                        {log.leadName && (
                          <span className="text-xs text-gray-500">
                            {t('lead')}: {log.leadName}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-900 mt-1 line-clamp-2">
                        {log.query || log.action || 'AI interaction'}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.userName || 'System'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {log.tokenCount && (
                          <span className="text-purple-500">
                            {log.tokenCount} tokens
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div className="flex-shrink-0">
                      {expandedLog === log.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedLog === log.id && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Query */}
                    {log.query && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">{t('queryInput')}</p>
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">{log.query}</p>
                      </div>
                    )}

                    {/* Response */}
                    {log.response && (
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-purple-700 mb-1">{t('aiResponse')}</p>
                        <p className="text-sm text-purple-900 whitespace-pre-wrap">{log.response}</p>
                      </div>
                    )}

                    {/* Context/Metadata */}
                    {(log.context || log.metadata) && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">{t('contextMetadata')}</p>
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(log.context || log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Additional Info */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {log.model && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {t('model')}: {log.model}
                        </span>
                      )}
                      {log.latencyMs && (
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {t('latency')}: {log.latencyMs}ms
                        </span>
                      )}
                      {log.success !== undefined && (
                        <span className={`px-2 py-1 rounded ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {log.success ? t('success') : t('failed')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
          {filteredLogs.length} {t('auditLogEntries')}
        </div>
      </div>
    </div>
  );
}
