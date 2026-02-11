const API_BASE_URL = 'http://localhost:3006/api';

export const authService = {
    async signup(username, email, password, role) {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email, password, role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Signup failed');
        if (data.data?.token) localStorage.setItem('token', data.data.token);
        return data;
    },

    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Login failed');
        if (data.data?.token) localStorage.setItem('token', data.data.token);
        return data;
    },

    async logout() {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            credentials: 'include'
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
        const response = await fetch(url, {
            credentials: 'include',
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
        const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch contact');
        return data.data;
    },

    async create(contactData) {
        const response = await fetch(`${API_BASE_URL}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(contactData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create contact');
        return data.data;
    },

    async update(id, contactData) {
        const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(contactData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update contact');
        return data.data;
    },

    async delete(id) {
        const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete contact');
        return data;
    },

    async deleteAll() {
        const response = await fetch(`${API_BASE_URL}/contacts`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete all contacts');
        return data;
    }
};

export const sourcesService = {
    async getAll() {
        const response = await fetch(`${API_BASE_URL}/sources`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch sources');
        return data.data || [];
    },

    async getById(id) {
        const response = await fetch(`${API_BASE_URL}/sources/${id}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch source');
        return data.data;
    },

    async create(name) {
        const response = await fetch(`${API_BASE_URL}/sources`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create source');
        return data.data;
    },

    async update(id, name) {
        const response = await fetch(`${API_BASE_URL}/sources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update source');
        return data.data;
    },

    async delete(id) {
        const response = await fetch(`${API_BASE_URL}/sources/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete source');
        return data;
    }
};

export const leadsService = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${API_BASE_URL}/leads?${query}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch leads');
        return data;
    },

    async getById(id) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch lead');
        return data.data;
    },

    async create(leadData) {
        const response = await fetch(`${API_BASE_URL}/leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(leadData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to create lead');
        return data.data;
    },

    async update(id, leadData) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(leadData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to update lead');
        return data.data;
    },

    async delete(id) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete lead');
        return data;
    },

    async deleteAll() {
        const response = await fetch(`${API_BASE_URL}/leads/all`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete all leads');
        return data;
    },

    async addNote(id, noteData) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}/timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(noteData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to add note');
        return data.data;
    },

    async getTimeline(id) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}/timeline`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch timeline');
        return data.data;
    },

    async addPayment(id, paymentData) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(paymentData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to add payment');
        return data; // Return full response { status, message, data }
    },

    async deletePayment(id, paymentId) {
        const response = await fetch(`${API_BASE_URL}/leads/${id}/payments/${paymentId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete payment');
        return data;
    }
};

export const userService = {
    async getAll() {
        const response = await fetch(`${API_BASE_URL}/users`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch users');
        return data.data;
    }
};

export default authService;
