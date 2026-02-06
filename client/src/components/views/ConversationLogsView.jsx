import { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  Search,
  Filter,
  User,
  Phone,
  ChevronRight,
  ArrowLeft,
  Clock,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../../lib/firebase';

// eslint-disable-next-line no-unused-vars
export default function ConversationLogsView({ leads, currentUser }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');

  // Get unique employees
  const employees = useMemo(() => {
    const unique = [...new Set(leads.map(l => l.manager).filter(Boolean))];
    return unique.sort();
  }, [leads]);

  // Filter leads with messages
  const leadsWithMessages = useMemo(() => {
    return leads
      .filter(l => l.hasUnreadMessages || l.lastMessageAt)
      .filter(l => {
        if (filterEmployee !== 'all' && l.manager !== filterEmployee) return false;
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            l.clientName?.toLowerCase().includes(search) ||
            l.phone?.includes(search) ||
            l.manager?.toLowerCase().includes(search)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.lastMessageAt?.toDate?.() || new Date(0);
        const dateB = b.lastMessageAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
  }, [leads, searchTerm, filterEmployee]);

  // Load messages for selected lead
  useEffect(() => {
    if (!selectedLead) {
      setMessages([]);
      return;
    }

    setLoading(true);

    const messagesRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'leads',
      selectedLead.id,
      'messages'
    );

    const unsubscribe = onSnapshot(
      query(messagesRef, orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
        const msgs = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .reverse(); // Show oldest first
        setMessages(msgs);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedLead]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString();
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Conversation Logs</h1>
        <p className="text-xs md:text-sm text-gray-500">View all WhatsApp conversations between employees and leads</p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Conversations List */}
        <div className={`${selectedLead ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 bg-white rounded-xl border shadow-sm overflow-hidden`}>
          {/* Search & Filter */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Filter className="w-4 h-4 text-gray-400 my-auto" />
              <select
                className="flex-1 text-sm border rounded-lg px-2 py-1.5 outline-none"
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {leadsWithMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No conversations found</p>
              </div>
            ) : (
              leadsWithMessages.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`w-full p-3 border-b text-left hover:bg-gray-50 transition-colors ${
                    selectedLead?.id === lead.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {lead.clientName?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-900 truncate">{lead.clientName}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                          {formatTimestamp(lead.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{lead.lastMessagePreview || 'No messages'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {lead.manager || 'Unassigned'}
                        </span>
                        {lead.hasUnreadMessages && (
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 my-auto" />
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
            {leadsWithMessages.length} conversations
          </div>
        </div>

        {/* Message View */}
        <div className={`${selectedLead ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-white rounded-xl border shadow-sm overflow-hidden`}>
          {selectedLead ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="md:hidden p-2 hover:bg-white/50 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedLead.clientName?.[0] || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{selectedLead.clientName}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />
                      {selectedLead.phone}
                      <span className="text-gray-300">•</span>
                      <User className="w-3 h-3" />
                      {selectedLead.manager || 'Unassigned'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedLead.stage === 'Booked' ? 'bg-green-100 text-green-700' :
                      selectedLead.stage === 'New' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedLead.stage}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.direction === 'outbound'
                            ? 'bg-green-500 text-white rounded-br-md'
                            : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.text || msg.message}</p>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${
                          msg.direction === 'outbound' ? 'text-green-100' : 'text-gray-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(msg.timestamp)}
                          {msg.type === 'auto_greeting' && (
                            <span className="ml-1 px-1 py-0.5 bg-white/20 rounded text-[9px]">Auto</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Info */}
              <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center">
                <p>This is a read-only view of the conversation history</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a lead from the list to view their messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
