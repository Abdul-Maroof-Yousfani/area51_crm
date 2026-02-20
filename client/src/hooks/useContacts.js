import { useState, useEffect, useCallback } from 'react';
import { contactService } from '../services/api';

export function useContacts({ enabled = true } = {}) {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(enabled); // Only load if enabled
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [totalCount, setTotalCount] = useState(0);

    // Fetch contacts with optional cursor for pagination
    const fetchContacts = useCallback(async (cursor = null, append = false, search = '') => {
        setLoading(true);
        setError(null);
        try {
            const result = await contactService.getAll(cursor, 10000, search);

            if (append) {
                setContacts(prev => [...prev, ...result.data]);
            } else {
                setContacts(result.data);
            }

            setHasMore(result.pagination.hasMore);
            setNextCursor(result.pagination.nextCursor);
            setTotalCount(result.pagination.total);
            return result.data;
        } catch (err) {
            setError(err.message);
            console.error('Failed to fetch contacts:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Load more contacts (for lazy loading if needed)
    const loadMore = useCallback(async () => {
        if (hasMore && nextCursor && !loading) {
            await fetchContacts(nextCursor, true);
        }
    }, [hasMore, nextCursor, loading, fetchContacts]);

    // Search contacts (replaces list)
    const searchContacts = useCallback(async (query) => {
        return await fetchContacts(null, false, query);
    }, [fetchContacts]);

    useEffect(() => {
        if (enabled) {
            fetchContacts();
        } else {
            setLoading(false);
        }
    }, [fetchContacts, enabled]);

    const addContact = useCallback(async (contactData) => {
        try {
            const newContact = await contactService.create(contactData);
            setContacts(prev => [newContact, ...prev]);
            setTotalCount(prev => prev + 1);
            return newContact;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateContact = useCallback(async (id, contactData) => {
        try {
            const updated = await contactService.update(id, contactData);
            setContacts(prev => prev.map(c => c.id === id ? updated : c));
            return updated;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteContact = useCallback(async (id) => {
        try {
            await contactService.delete(id);
            setContacts(prev => prev.filter(c => c.id !== id));
            setTotalCount(prev => prev - 1);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteAllContacts = useCallback(async () => {
        try {
            await contactService.deleteAll();
            setContacts([]);
            setTotalCount(0);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        contacts,
        loading,
        error,
        hasMore,
        totalCount,
        fetchContacts: (cursor, append) => fetchContacts(cursor, append, ''),
        searchContacts,
        loadMore,
        addContact,
        updateContact,
        deleteContact,
        deleteAllContacts
    };
}
