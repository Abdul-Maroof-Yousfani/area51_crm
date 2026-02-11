import React from 'react';
import { DollarSign, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { StatCard } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useLanguage } from '../../contexts/LanguageContext';

export default function DashboardView({ stats, onShowRevenue }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          title={t('totalRevenue')}
          value={formatCurrency(stats.revenue)}
          icon={DollarSign}
          color="bg-green-500"
          onClick={onShowRevenue}
        />
        <StatCard
          title={t('pipelineValue')}
          value={formatCurrency(stats.pipe)}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title={t('totalLeads')}
          value={stats.total}
          icon={Users}
          color="bg-purple-500"
        />
        <StatCard
          title={t('conversionRate')}
          value={`${stats.conversion}%`}
          icon={CheckCircle}
          color="bg-orange-500"
        />
      </div>
    </div>
  );
}
