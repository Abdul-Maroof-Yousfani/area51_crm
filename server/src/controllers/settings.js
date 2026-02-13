import prisma from '../util/prisma.js';

// Get a setting by key
export const getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await prisma.appSetting.findUnique({
            where: { key }
        });

        if (!setting) {
            return res.status(200).json({ status: true, data: null });
        }

        return res.status(200).json({ status: true, data: setting.value });
    } catch (error) {
        console.error('Get Setting Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};

// Update a setting
export const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        const setting = await prisma.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });

        return res.status(200).json({ status: true, message: 'Setting updated', data: setting.value });
    } catch (error) {
        console.error('Update Setting Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};
