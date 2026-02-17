import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, DollarSign, Calendar, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency, safeAmount } from '../../utils/helpers';
import { leadsService } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

export default function PaymentDetailModal({ lead, onClose, onUpdate }) {
    const { t } = useLanguage();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('Mid-payment'); // Advance, Mid-payment, Final, Custom
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize payments - include advanceAmount as a legacy payment if no Payment records exist
    const initializePayments = () => {
        const currentPayments = Array.isArray(lead?.payments) ? lead.payments : [];

        // Check if there's already an 'Advance' payment recorded to avoid duplication
        const hasAdvancePayment = currentPayments.some(p =>
            p.type === 'Advance' ||
            p.type === 'Advance (Initial)' ||
            (p.notes && p.notes.toLowerCase().includes('initial booking'))
        );

        // If no explicit advance payment record exists, but we have an advanceAmount on the lead,
        // show it as a legacy payment
        if (lead?.advanceAmount && lead.advanceAmount > 0 && !hasAdvancePayment) {
            const legacyPayment = {
                id: 'legacy-advance',
                amount: lead.advanceAmount,
                date: lead.bookedAt || lead.createdAt || new Date().toISOString(),
                type: 'Advance (Initial)',
                notes: 'Initial booking payment',
                isLegacy: true
            };
            return [legacyPayment, ...currentPayments];
        }

        return currentPayments;
    };

    const [payments, setPayments] = useState(initializePayments());

    // Update local state when prop changes
    useEffect(() => {
        setPayments(initializePayments());
    }, [lead]);

    const totalValue = safeAmount(lead?.finalAmount || lead?.amount);
    const totalPaid = payments.reduce((sum, p) => sum + safeAmount(p.amount), 0);
    const remaining = totalValue - totalPaid;

    const handleAddPayment = async () => {
        if (!amount || !date) return;

        if (Number(amount) > remaining) {
            alert(`Payment amount cannot exceed remaining balance (${formatCurrency(remaining)})`);
            return;
        }

        setIsSubmitting(true);
        try {
            const paymentData = {
                amount: Number(amount),
                date: new Date(date).toISOString(),
                type,
                notes
            };

            // Call API
            const response = await leadsService.addPayment(lead.id, paymentData);

            if (response.status) {
                // Update local state with returned payment
                const newPayment = response.data;
                const updatedPayments = [...payments, newPayment];
                setPayments(updatedPayments);

                // Notify parent
                if (onUpdate) onUpdate(lead.id, { payments: updatedPayments });

                // Reset form
                setAmount('');
                setNotes('');
                // Keep type or reset?
            }
        } catch (error) {
            console.error("Failed to add payment", error);
            alert("Failed to add payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePayment = async (paymentId) => {
        // Don't allow deleting legacy advance payment
        if (paymentId === 'legacy-advance') {
            alert("Cannot delete the initial advance payment. This is a legacy booking payment.");
            return;
        }

        if (!confirm("Are you sure you want to delete this payment?")) return;
        try {
            await leadsService.deletePayment(lead.id, paymentId);
            const updatedPayments = payments.filter(p => p.id !== paymentId);
            setPayments(updatedPayments);
            if (onUpdate) onUpdate(lead.id, { payments: updatedPayments });
        } catch (error) {
            console.error("Failed to delete payment", error);
            alert("Failed to delete payment");
        }
    };

    const getPaymentTypeLabel = (type) => {
        const labels = {
            'Advance': t('advanceInitial'),
            'Advance (Initial)': t('advanceInitial'),
            'Mid-payment': t('midPayment'),
            'Final': t('finalPayment'),
            'Custom': t('custom')
        };
        return labels[type] || type;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{t('paymentHistory')}</h2>
                        <p className="text-sm text-gray-500">{lead?.clientName} - {lead?.eventType}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <p className="text-xs text-gray-500 font-medium uppercase">{t('totalValue')}</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalValue)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <p className="text-xs text-gray-500 font-medium uppercase">{t('collected')}</p>
                            <p className={`text-xl font-bold mt-1 ${totalPaid >= totalValue ? 'text-green-600' : 'text-blue-600'}`}>
                                {formatCurrency(totalPaid)}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <p className="text-xs text-gray-500 font-medium uppercase">{t('remaining')}</p>
                            <p className={`text-xl font-bold mt-1 ${remaining > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                {formatCurrency(Math.max(0, remaining))}
                            </p>
                        </div>
                    </div>

                    {/* Add Payment Form */}
                    <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> {t('addPayment')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{t('amount')}</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rs</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                {/* Dynamic Remaining Balance Indicator */}
                                <div className="mt-1 text-xs text-gray-500">
                                    {t('remainingAfterPayment')}: <span className={`font-bold ${remaining - (Number(amount) || 0) < 0 ? 'text-red-500' : 'text-gray-700'}`}>
                                        {formatCurrency(Math.max(0, remaining - (Number(amount) || 0)))}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{t('date')}</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{t('type')}</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Advance">{t('advanceInitial')}</option>
                                    <option value="Mid-payment">{t('midPayment')}</option>
                                    <option value="Final">{t('finalPayment')}</option>
                                    <option value="Custom">{t('custom')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{t('notesOptional')}</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Bank Transfer ID..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleAddPayment}
                                disabled={isSubmitting || !amount || Number(amount) > remaining}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t('adding') : t('addPayment')}
                            </button>
                        </div>
                    </div>

                    {/* History List */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3 ml-1">{t('paymentHistory')}</h3>
                        {payments.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-dashed">
                                {t('noPaymentsRecorded')}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {payments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((payment) => (
                                    <div key={payment.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${payment.type.includes('Advance') ? 'bg-purple-100 text-purple-600' :
                                                payment.type === 'Final' ? 'bg-green-100 text-green-600' :
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                <DollarSign className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{getPaymentTypeLabel(payment.type)}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> {new Date(payment.date).toLocaleDateString()}
                                                    </span>
                                                    {payment.notes && (
                                                        <span className="flex items-center gap-1">
                                                            • <FileText className="w-3 h-3" /> {payment.notes}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold text-gray-900">{formatCurrency(payment.amount)}</span>
                                            {!payment.isLegacy && (
                                                <button
                                                    onClick={() => handleDeletePayment(payment.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
