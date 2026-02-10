import React, { useState, useMemo } from 'react';
import { Trash2, Loader, Plus, Globe, Pencil, Check, X, Lock, Zap, Users, TrendingUp, ChevronRight } from 'lucide-react';



export default function SourcesView({ sources, leads = [], onAdd, onUpdate, onDelete, onSourceClick }) {
  const [val, setVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState('');


  const handleAdd = async () => {
    if (!val.trim()) return;
    setLoading(true);
    await onAdd(val);
    setVal('');
    setLoading(false);
  };

  const startEdit = (source) => {
    setEditingId(source.id);
    setEditVal(source.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditVal('');
  };

  const saveEdit = async (id) => {
    if (!editVal.trim()) return;
    await onUpdate(id, editVal.trim());
    setEditingId(null);
    setEditVal('');
  };

  // Calculate stats for each source
  const sourceStats = useMemo(() => {
    const stats = {};
    sources.forEach(s => {
      const sourceLeads = leads.filter(l => l.source === s.name);
      const booked = sourceLeads.filter(l => l.stage === 'Booked').length;
      stats[s.id] = {
        total: sourceLeads.length,
        booked,
        conversionRate: sourceLeads.length > 0 ? (booked / sourceLeads.length) * 100 : 0
      };
    });
    return stats;
  }, [sources, leads]);

  const handleSourceClick = (source) => {
    if (onSourceClick && !editingId) {
      onSourceClick(source);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Manage Sources</h2>
            <p className="text-xs text-gray-500">{sources.length} lead sources</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 border p-2 md:p-3 rounded-lg text-sm"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="New Source Name"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            className="bg-blue-600 text-white px-4 md:px-6 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
          >
            {loading ? <Loader className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {sources.map((s) => {
          const stats = sourceStats[s.id] || { total: 0, booked: 0, conversionRate: 0 };

          return (
            <div
              key={s.id}
              onClick={() => handleSourceClick(s)}
              className={`p-3 md:p-4 rounded-xl border shadow-sm transition-all ${s.isIntegration
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                : 'bg-white'
                } ${!editingId ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''}`}
            >
              {editingId === s.id && !s.isIntegration ? (
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 border p-2 rounded-lg text-sm font-medium"
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(s.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); saveEdit(s.id); }}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg flex-shrink-0"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {s.isIntegration && (
                        <Zap className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="font-bold text-sm md:text-base truncate">{s.name}</span>
                      {s.isIntegration && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          INTEGRATION
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {s.isIntegration ? (
                        <div
                          className="p-1.5 text-gray-400 flex-shrink-0"
                          title="Integration sources cannot be modified"
                        >
                          <Lock className="w-4 h-4" />
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg flex-shrink-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Users className="w-3 h-3" />
                      <span className="font-medium">{stats.total}</span>
                      <span>leads</span>
                    </div>
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="font-medium">{stats.booked}</span>
                      <span>booked</span>
                    </div>
                    {stats.total > 0 && (
                      <div className={`font-medium ${stats.conversionRate >= 5 ? 'text-green-600' :
                        stats.conversionRate >= 2 ? 'text-yellow-600' : 'text-gray-400'
                        }`}>
                        {stats.conversionRate.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {sources.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No sources yet. Add your first lead source above.
        </div>
      )}


    </div>
  );
}
