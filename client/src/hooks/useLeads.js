import { useState, useEffect, useCallback, useMemo } from 'react';
import { leadsService } from '../services/api';
import { safeAmount, isWonStage } from '../utils/helpers';

export function useLeads({ enabled = true } = {}) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 100, total: 0 });

    const fetchLeads = useCallback(async (params = {}) => {
        setLoading(true);
        try {
            // Default to get all (limit 10000) for client-side compat if no params
            const fetchParams = { limit: 10000, ...params };
            const response = await leadsService.getAll(fetchParams);

            // Transform data to match existing UI structure where needed
            const transformedLeads = response.data.map(lead => ({
                ...lead,
                clientName: lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}`.trim() : lead.title || 'Unknown',
                stage: lead.status,
                inquiryDate: new Date(lead.createdAt).toISOString().split('T')[0],
                manager: lead.assignee ? lead.assignee.username : 'Unassigned',
                phone: lead.contact?.phone || '',
                source: lead.source?.name || ''
            }));

            setLeads(transformedLeads);
            setPagination(response.pagination);
            setError(null);
        } catch (err) {
            console.error('Error fetching leads:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (enabled) {
            fetchLeads();
        } else {
            setLoading(false);
        }
    }, [fetchLeads, enabled]);

    const addLead = async (leadData) => {
        try {
            const newLead = await leadsService.create(leadData);
            await fetchLeads(); // Refresh list
            return newLead;
        } catch (err) {
            throw err;
        }
    };

    const updateLead = async (id, leadData) => {
        try {
            const updatedLead = await leadsService.update(id, leadData);
            await fetchLeads();
            return updatedLead;
        } catch (err) {
            throw err;
        }
    };

    const deleteLead = async (id) => {
        try {
            await leadsService.delete(id);
            await fetchLeads();
        } catch (err) {
            throw err;
        }
    };

    const deleteAllLeads = async () => {
        try {
            await leadsService.deleteAll();
            await fetchLeads();
        } catch (err) {
            throw err;
        }
    };

    const addLeadNote = async (id, note, type = 'NOTE') => {
        try {
            await leadsService.addNote(id, { content: note, type });
            // No need to refetch all leads for a note, usually
        } catch (err) {
            throw err;
        }
    };

    const stats = useMemo(() => {
        const won = leads.filter((d) => isWonStage(d.stage));
        const revenue = won.reduce((sum, d) => sum + safeAmount(d.amount), 0);
        const pipe = leads
            .filter((d) =>
                ['proposal', 'negotiation'].some((k) => (d.stage || '').toLowerCase().includes(k))
            )
            .reduce((sum, d) => sum + safeAmount(d.amount), 0);
        const conversion = leads.length > 0 ? ((won.length / leads.length) * 100).toFixed(1) : 0;
        return { revenue, pipe, total: leads.length, conversion, wonCount: won.length };
    }, [leads]);

    return {
        leads,
        loading,
        error,
        pagination,
        fetchLeads,
        addLead,
        updateLead,
        deleteLead,
        deleteAllLeads,
        addLeadNote,
        stats
    };
}
