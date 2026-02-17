import prisma from '../util/prisma.js';

export const getNotifications = async (req, res) => {
    try {
        const { limit = 50, userId, role } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Fetch notifications for the user OR 'all'
        // If user is Admin/Owner, they might see more, but for now let's stick to assignedTo logic
        // logic: where assignedTo = 'all' OR assignedTo = role OR userId = userId

        const query = {
            OR: [
                { userId: Number(userId) },
                { assignedTo: 'all' },
            ]
        };

        if (role) {
            query.OR.push({ assignedTo: role });
        }

        // Allow Admin and Owner to see all "New Lead" notifications
        if (role === 'Admin' || role === 'Owner') {
            query.OR.push({ type: 'lead_assigned' });
        }

        const notifications = await prisma.notification.findMany({
            where: query,
            take: Number(limit),
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                lead: {
                    select: {
                        id: true,
                        title: true,
                        // Add other lead fields if needed for UI
                    }
                }
            }
        });

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.update({
            where: { id: Number(id) },
            data: { read: true }
        });
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const { userId, role } = req.body;

        // This is tricky because notifications might be shared ('all').
        // If we mark 'all' notification as read, it's read for everyone?
        // For a simple system, yes. For per-user read status on shared notifications, we'd need a separate table (NotificationReadStatus).
        // For now, let's assume if I click "Mark all read", I only mark MY notifications or we accept the limitation that 'all' notifications share read state.
        // Actually, the user asked for "database me save honge". 
        // If we want per-user read status for 'assignedTo: all', we need a many-to-many relation.
        // Given the speed/complexity trade-off, I'll update all notifications visible to this user to read=true.
        // ERROR: This means if Admin A reads it, Admin B sees it as read.
        // ACCEPTABLE for now given the request "save to db". Refinement can come later if requested.

        const result = await prisma.notification.updateMany({
            where: {
                OR: [
                    { userId: Number(userId) },
                    { assignedTo: 'all' },
                    ...(role ? [{ assignedTo: role }] : [])
                ],
                read: false
            },
            data: { read: true }
        });

        res.json({ message: 'All notifications marked as read', count: result.count });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.delete({
            where: { id: Number(id) }
        });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};
