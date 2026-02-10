import prisma from '../util/prisma.js';
import Joi from 'joi';

// Validation schemas
const sourceSchema = Joi.object({
    name: Joi.string().min(1).max(100).required()
});

const updateSourceSchema = Joi.object({
    name: Joi.string().min(1).max(100).required()
});

// Get all sources
export const getSources = async (req, res) => {
    try {
        const sources = await prisma.sources.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({ status: true, data: sources });
    } catch (error) {
        console.error('Get Sources Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Get source by ID
export const getSourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const source = await prisma.sources.findUnique({
            where: { id: parseInt(id) }
        });

        if (!source) {
            return res.status(404).json({ status: false, message: 'Source not found' });
        }

        return res.status(200).json({ status: true, data: source });
    } catch (error) {
        console.error('Get Source Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Create new source
export const createSource = async (req, res) => {
    try {
        const { error, value } = sourceSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const { name } = value;

        // Check if source name already exists
        const existingSource = await prisma.sources.findUnique({
            where: { name }
        });

        if (existingSource) {
            return res.status(409).json({ status: false, message: 'Source with this name already exists' });
        }

        const newSource = await prisma.sources.create({
            data: { name }
        });

        return res.status(201).json({ status: true, message: 'Source created successfully', data: newSource });
    } catch (error) {
        console.error('Create Source Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Update source
export const updateSource = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateSourceSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        // Check if source exists
        const existingSource = await prisma.sources.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingSource) {
            return res.status(404).json({ status: false, message: 'Source not found' });
        }

        // Check for duplicate name if being updated
        if (value.name) {
            const duplicate = await prisma.sources.findFirst({
                where: {
                    AND: [
                        { id: { not: parseInt(id) } },
                        { name: value.name }
                    ]
                }
            });

            if (duplicate) {
                return res.status(409).json({ status: false, message: 'Source name already in use' });
            }
        }

        const updatedSource = await prisma.sources.update({
            where: { id: parseInt(id) },
            data: value
        });

        return res.status(200).json({ status: true, message: 'Source updated successfully', data: updatedSource });
    } catch (error) {
        console.error('Update Source Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete source
export const deleteSource = async (req, res) => {
    try {
        const { id } = req.params;

        const existingSource = await prisma.sources.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingSource) {
            return res.status(404).json({ status: false, message: 'Source not found' });
        }

        await prisma.sources.delete({
            where: { id: parseInt(id) }
        });

        return res.status(200).json({ status: true, message: 'Source deleted successfully' });
    } catch (error) {
        console.error('Delete Source Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};


