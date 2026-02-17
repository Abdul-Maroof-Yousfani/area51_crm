import prisma from '../util/prisma.js';
import bcrypt from 'bcryptjs';

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: { id: true, username: true, email: true, role: true, is_active: true, created_at: true }
        });
        if (!user) return res.status(404).json({ status: false, message: 'User not found' });
        res.json({ status: true, data: user });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, role: true, is_active: true, created_at: true },
            orderBy: { username: 'asc' }
        });
        res.json({ status: true, data: users });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

export const newUser = async (req, res) => {
    try {
        const { email, name, role } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: false, message: 'User already exists' });
        }

        // Generate random password
        const tempPassword = Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        const newUser = await prisma.user.create({
            data: {
                username: name,
                email,
                role: role || 'Sales',
                password_hash,
                is_active: true
            }
        });

        // In a real app, send email here. For now, return the temp password/link.
        const resetLink = `http://localhost:3000/reset-password?email=${email}&code=mock-code`;

        // We will simulate the "Cloud Function" response structure slightly to make frontend migration easier if needed,
        // but strictly speaking we return standard JSON.

        res.status(201).json({
            status: true,
            message: 'User created successfully',
            data: {
                user: { id: newUser.id, email: newUser.email, username: newUser.username },
                tempPassword,
                resetLink
            }
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ status: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);

        await prisma.$transaction(async (tx) => {
            // 1. Delete Sessions
            await tx.sessions.deleteMany({ where: { user_id: userId } });

            // 2. Delete Notifications
            await tx.notification.deleteMany({ where: { userId: userId } });

            // 3. Unassign Leads
            await tx.lead.updateMany({
                where: { assignedTo: userId },
                data: { assignedTo: null }
            });

            // 4. Unassign Activities (keep history but remove link)
            await tx.leadActivity.updateMany({
                where: { userId: userId },
                data: { userId: null }
            });

            // 5. Delete User
            await tx.user.delete({ where: { id: userId } });
        });

        res.json({ status: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ status: false, message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id, username, role, is_active } = req.body;
        // Basic update
        const updated = await prisma.user.update({
            where: { id: parseInt(id) },
            data: { username, role, is_active }
        });
        res.json({ status: true, message: 'User updated', data: updated });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

export default {
    getUserById,
    getUsers,
    newUser,
    deleteUser,
    updateUser
};
