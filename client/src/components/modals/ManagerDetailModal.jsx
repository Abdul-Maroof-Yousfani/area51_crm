import React, { useState, useMemo } from 'react';
import { X, UserCircle, Sparkles, ListFilter, Loader } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { safeAmount, formatCurrency } from '../../utils/helpers';
import { callGemini } from '../../utils/ai';
import { COLORS } from '../../lib/constants';

export default function ManagerDetailModal({ manager, data, onClose, onViewLeads }) {
  const [aiCoachResult, setAiCoachResult] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const managerData = useMemo(() => {
    return data.filter((d) => d.manager === manager);
  }, [data, manager]);

  const stats = useMemo(() => {
    const total = managerData.length;
    const won = managerData.filter((d) => (d.stage || '').toLowerCase() === 'won');
    const lost = managerData.filter((d) => (d.stage || '').toLowerCase() === 'lost');
    const revenue = won.reduce((sum, d) => sum + safeAmount(d.amount), 0);
    const pipeline = managerData
      .filter((d) =>
        ['proposal', 'negotiation'].includes((d.stage || '').toLowerCase())
      )
      .reduce((sum, d) => sum + safeAmount(d.amount), 0);

    const avgDeal = won.length > 0 ? revenue / won.length : 0;
    const convRate = total > 0 ? ((won.length / total) * 100).toFixed(1) : 0;

    const lossReasons = {};
    lost.forEach((d) => {
      const notes = (d.notes || '').toLowerCase();
      let reason = 'Other';
      if (notes.includes('budget') || notes.includes('expensive')) reason = 'Budget';
      else if (notes.includes('location') || notes.includes('far')) reason = 'Location';
      else if (notes.includes('date') || notes.includes('booked')) reason = 'Availability';
      else if (notes.includes('response') || notes.includes('answering')) reason = 'No Response';

      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    });
    const lossData = Object.entries(lossReasons).map(([name, value]) => ({ name, value }));

    const pipelineData = [
      {
        name: 'New',
        value: managerData.filter((d) => (d.stage || '').toLowerCase() === 'new lead').length
      },
      {
        name: 'Active',
        value: managerData.filter((d) =>
          ['proposal', 'negotiation'].includes((d.stage || '').toLowerCase())
        ).length
      },
      { name: 'Won', value: won.length },
      { name: 'Lost', value: lost.length }
    ];

    return {
      total,
      won: won.length,
      revenue,
      pipeline,
      avgDeal,
      convRate,
      lossData,
      pipelineData
    };
  }, [managerData]);

  const runAiCoach = async () => {
    setLoadingAi(true);
    const prompt = `
      You are an elite Sales Manager Coach. Analyze the performance of manager "${manager}" based on these stats:
      - Total Revenue: ${stats.revenue}
      - Conversion Rate: ${stats.convRate}%
      - Average Deal Size: ${stats.avgDeal}
      - Deal Funnel: ${JSON.stringify(stats.pipelineData)}
      - Loss Reasons Breakdown: ${JSON.stringify(stats.lossData)}

      Provide 3 constructive, high-impact coaching tips to help this manager improve. Focus on their weak points (e.g. if high loss due to budget, suggest value selling).
    `;
    const text = await callGemini(prompt);
    setAiCoachResult(text);
    setLoadingAi(false);
  };

  if (!manager) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-scale-in flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <UserCircle className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{manager}</h2>
              <p className="text-sm text-gray-500">Performance Overview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <p className="text-xs font-bold text-green-600 uppercase">Total Revenue</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                {formatCurrency(stats.revenue)}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs font-bold text-blue-600 uppercase">Conversion Rate</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">{stats.convRate}%</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
              <p className="text-xs font-bold text-purple-600 uppercase">Avg Deal Size</p>
              <p className="text-2xl font-bold text-purple-800 mt-1">
                {formatCurrency(stats.avgDeal)}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <p className="text-xs font-bold text-orange-600 uppercase">Open Pipeline</p>
              <p className="text-2xl font-bold text-orange-800 mt-1">
                {formatCurrency(stats.pipeline)}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-indigo-900">AI Performance Coach</h3>
              </div>
              {!aiCoachResult && !loadingAi && (
                <button
                  onClick={runAiCoach}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-3 h-3" /> Analyze Performance
                </button>
              )}
            </div>

            {loadingAi && (
              <div className="flex items-center gap-3 text-indigo-600 animate-pulse">
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Generating coaching tips...</span>
              </div>
            )}

            {aiCoachResult && (
              <div className="bg-white/60 p-4 rounded-lg text-sm text-indigo-900 leading-relaxed whitespace-pre-line border border-indigo-100">
                {aiCoachResult}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Personal Funnel</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pipelineData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={30}>
                      {stats.pipelineData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={['#94a3b8', '#3b82f6', '#10b981', '#ef4444'][index]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4">
                Loss Analysis (Why deals fail)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.lossData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {stats.lossData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <button
            onClick={() => onViewLeads(manager)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ListFilter className="w-4 h-4" />
            View All Leads for {manager}
          </button>
        </div>
      </div>
    </div>
  );
}
