import { useState, useEffect } from 'react';
import { userService } from '../services/api';

export function useUsers({ enabled = true } = {}) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await userService.getAll();
                setUsers(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching users:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (enabled) {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [enabled]);

    return { users, loading, error };
}
