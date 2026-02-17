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
    const fetchContacts = useCallback(async (cursor = null, append = false) => {
        setLoading(true);
        setError(null);
        try {
            const result = await contactService.getAll(cursor, 100);

            if (append) {
                setContacts(prev => [...prev, ...result.data]);
            } else {
                setContacts(result.data);
            }

            setHasMore(result.pagination.hasMore);
            setNextCursor(result.pagination.nextCursor);
            setTotalCount(result.pagination.total);
        } catch (err) {
            setError(err.message);
            console.error('Failed to fetch contacts:', err);
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

    // Fetch all pages to get complete data set
    const fetchAllContacts = useCallback(async () => {
        console.log('[useContacts] Fetching all contacts...');
        setLoading(true);
        setError(null);
        try {
            let allContacts = [];
            let cursor = null;
            let hasMoreData = true;

            while (hasMoreData) {
                console.log('[useContacts] Fetching page, cursor:', cursor);
                const result = await contactService.getAll(cursor, 1000); // Fetch in larger batches
                console.log('[useContacts] Received result:', result);
                allContacts = [...allContacts, ...result.data];
                hasMoreData = result.pagination.hasMore;
                cursor = result.pagination.nextCursor;

                // Safety break
                if (allContacts.length > 100000) {
                    console.warn('[useContacts] Safety break: exceeding 100k contacts, stopping fetch.');
                    break;
                }
            }

            console.log('[useContacts] Total contacts fetched:', allContacts.length);
            setContacts(allContacts);
            setHasMore(false);
            setNextCursor(null);
            setTotalCount(allContacts.length);
        } catch (err) {
            console.error('[useContacts] Error fetching contacts:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            fetchAllContacts();
        } else {
            setLoading(false);
        }
    }, [fetchAllContacts, enabled]);

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
        fetchContacts,
        fetchAllContacts,
        loadMore,
        addContact,
        updateContact,
        deleteContact,
        deleteAllContacts
    };
}
