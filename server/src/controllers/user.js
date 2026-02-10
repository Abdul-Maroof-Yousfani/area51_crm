import prisma from '../util/prisma.js';

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: { id: true, username: true, email: true, role: true }
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
            select: { id: true, username: true, email: true, role: true },
            orderBy: { username: 'asc' }
        });
        res.json({ status: true, data: users });
    } catch (error) {
        res.status(500).json({ status: false, message: error.message });
    }
};

export const newUser = (req, res) => {
    res.json({ message: 'newUser placeholder' });
};

export const deleteUser = (req, res) => {
    res.json({ message: 'deleteUser placeholder' });
};

export const updateUser = (req, res) => {
    res.json({ message: 'updateUser placeholder' });
};

export default {
    getUserById,
    getUsers,
    newUser,
    deleteUser,
    updateUser
};
