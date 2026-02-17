const API_BASE_URL = 'http://localhost:3006/api';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
        credentials: 'include'
    };

    const response = await fetch(url, config);

    if (response.status === 401 && !url.includes('/logout')) {
        window.dispatchEvent(new Event('auth:unauthorized'));
    }

    return response;
};

export const authService = {
    async signup(username, email, password, role) {
        const response = await fetchWithAuth(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Signup failed');
        if (data.data?.token) localStorage.setItem('token', data.data.token);
        return data;
    },

    async login(email, password) {
        const response = await fetchWithAuth(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');
        if (data.data?.token) localStorage.setItem('token', data.data.token);
        return data;
    },

    async logout() {
        const token = localStorage.getItem('token');
        const response = await fetchWithAuth(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        localStorage.removeItem('token');
        return response.json();
    },

    getToken() {
        return localStorage.getItem('token');
    },

    isAuthenticated() {
        return !!localStorage.getItem('token');
    }
};

export const contactService = {
    async getAll(cursor = null, limit = 100) {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', cursor);
        params.append('limit', limit.toString());

        const url = `${API_BASE_URL}/contacts${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetchWithAuth(url, {
            headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch contacts');
        return {
            data: data.data || [],
            pagination: data.pagination || { nextCursor: null, hasMore: false, total: 0 }
        };
    },

    async getById(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/contacts/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch contact');
        return data.data;
    },

    async create(contactData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create contact');
        return data.data;
    },

    async update(id, contactData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(contactData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update contact');
        return data.data;
    },

    async delete(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/contacts/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete contact');
        return data;
    },

    async deleteAll() {
        const response = await fetchWithAuth(`${API_BASE_URL}/contacts`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete all contacts');
        return data;
    }
};

export const sourcesService = {
    async getAll() {
        const response = await fetchWithAuth(`${API_BASE_URL}/sources`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch sources');
        return data.data || [];
    },

    async getById(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/sources/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch source');
        return data.data;
    },

    async create(name) {
        const response = await fetchWithAuth(`${API_BASE_URL}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create source');
        return data.data;
    },

    async update(id, name) {
        const response = await fetchWithAuth(`${API_BASE_URL}/sources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update source');
        return data.data;
    },

    async delete(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/sources/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete source');
        return data;
    }
};

export const leadsService = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        const response = await fetchWithAuth(`${API_BASE_URL}/leads?${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch leads');
        return data;
    },

    async getById(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch lead');
        return data.data;
    },

    async create(leadData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create lead');
        return data.data;
    },

    async update(id, leadData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update lead');
        return data.data;
    },

    async delete(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete lead');
        return data;
    },

    async deleteAll() {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/all`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete all leads');
        return data;
    },

    async import(leadsData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: leadsData })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to import leads');
        return data;
    },

    async addNote(id, noteData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}/timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to add note');
        return data.data;
    },

    async getTimeline(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}/timeline`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch timeline');
        return data.data;
    },

    async addPayment(id, paymentData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to add payment');
        return data; // Return full response { status, message, data }
    },

    async deletePayment(id, paymentId) {
        const response = await fetchWithAuth(`${API_BASE_URL}/leads/${id}/payments/${paymentId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete payment');
        return data;
    }
};

export const userService = {
    async getAll() {
        const response = await fetchWithAuth(`${API_BASE_URL}/users`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch users');
        return data.data;
    },

    async invite(userData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to invite user');
        return data; // returns full response { status, message, data: { user, tempPassword, resetLink } }
    },

    async delete(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete user');
        return data;
    }
};

export const settingsService = {
    async get(key) {
        const response = await fetchWithAuth(`${API_BASE_URL}/settings/${key}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch settings');
        return data.data;
    },

    async update(key, value) {
        const response = await fetchWithAuth(`${API_BASE_URL}/settings/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update settings');
        return data.data;
    }
};

export const maintenanceService = {
    async resetDatabase() {
        const response = await fetchWithAuth(`${API_BASE_URL}/maintenance/reset`, {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to reset database');
        return data;
    },

    async migrateContacts() {
        const response = await fetchWithAuth(`${API_BASE_URL}/maintenance/migrate-contacts`, {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to migrate contacts');
        return data;
    },

    async consolidateSources() {
        const response = await fetchWithAuth(`${API_BASE_URL}/maintenance/consolidate-sources`, {
            method: 'POST'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to consolidate sources');
        return data;
    }
};

export const notificationsService = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications?${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch notifications');
        return data; // returns array directly based on controller
    },

    async markAsRead(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${id}/read`, {
            method: 'PATCH'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to mark notification as read');
        return data;
    },

    async markAllAsRead(userData) {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/read-all`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to mark all as read');
        return data;
    },

    async delete(id) {
        const response = await fetchWithAuth(`${API_BASE_URL}/notifications/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete notification');
        return data;
    }
};

export default authService;
