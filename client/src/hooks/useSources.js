import { useState, useEffect, useCallback } from 'react';
import { sourcesService } from '../services/api';

export function useSources({ enabled = true } = {}) {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);

    // Fetch all sources on mount
    const fetchSources = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await sourcesService.getAll();
            setSources(data);
        } catch (err) {
            setError(err.message);
            console.error('Failed to fetch sources:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            fetchSources();
        } else {
            setLoading(false);
        }
    }, [fetchSources, enabled]);

    const addSource = useCallback(async (name) => {
        try {
            const newSource = await sourcesService.create(name);
            setSources(prev => [newSource, ...prev]);
            return newSource;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateSource = useCallback(async (id, name) => {
        try {
            const updated = await sourcesService.update(id, name);
            setSources(prev => prev.map(s => s.id === id ? updated : s));
            return updated;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteSource = useCallback(async (id) => {
        try {
            await sourcesService.delete(id);
            setSources(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    return {
        sources,
        loading,
        error,
        fetchSources,
        addSource,
        updateSource,
        deleteSource
    };
}
