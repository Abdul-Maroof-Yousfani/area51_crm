import prisma from '../util/prisma.js';
import Joi from 'joi';

// Validation schemas
const leadSchema = Joi.object({
    title: Joi.string().max(200).allow('', null),
    amount: Joi.number().min(0).default(0),
    status: Joi.string().valid('New', 'Contacted', 'Qualified', 'Site Visit Scheduled', 'Quoted', 'Negotiating', 'Booked', 'Lost').default('New'),
    probability: Joi.number().min(0).max(100).default(0),
    expectedCloseDate: Joi.date().iso().allow(null),
    notes: Joi.string().allow('', null),
    contactId: Joi.number().required(),
    sourceId: Joi.number().allow(null),
    assignedTo: Joi.number().allow(null),
    // Booking/Event fields
    guests: Joi.number().integer().min(0).allow(null),
    venue: Joi.string().max(200).allow('', null),
    eventType: Joi.string().max(100).allow('', null),
    eventDate: Joi.date().iso().allow(null),
    finalAmount: Joi.number().min(0).allow(null),
    advanceAmount: Joi.number().min(0).allow(null),
    // Site visit fields
    siteVisitDate: Joi.date().iso().allow(null),
    siteVisitTime: Joi.string().max(50).allow('', null)
});

const updateLeadSchema = Joi.object({
    title: Joi.string().max(200).allow('', null),
    amount: Joi.number().min(0),
    status: Joi.string().valid('New', 'Contacted', 'Qualified', 'Site Visit Scheduled', 'Quoted', 'Negotiating', 'Booked', 'Lost'),
    probability: Joi.number().min(0).max(100),
    expectedCloseDate: Joi.date().iso().allow(null),
    notes: Joi.string().allow('', null),
    contactId: Joi.number(),
    sourceId: Joi.number().allow(null),
    assignedTo: Joi.number().allow(null),
    // Booking/Event fields
    guests: Joi.number().integer().min(0).allow(null),
    venue: Joi.string().max(200).allow('', null),
    eventType: Joi.string().max(100).allow('', null),
    eventDate: Joi.date().iso().allow(null),
    finalAmount: Joi.number().min(0).allow(null),
    advanceAmount: Joi.number().min(0).allow(null),
    // Site visit fields
    siteVisitDate: Joi.date().iso().allow(null),
    siteVisitTime: Joi.string().max(50).allow('', null),
    // Booking Details
    bookingNotes: Joi.string().allow('', null),
    bookedAt: Joi.date().iso().allow(null),
    bookedBy: Joi.string().allow('', null)
}).min(1).unknown(true); // Allow unknown fields from frontend

// Get all leads with pagination and filtering
export const getLeads = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, assignedTo, search, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build where clause
        const where = {};
        if (status) where.status = status;
        if (assignedTo) where.assignedTo = parseInt(assignedTo);

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
                { contact: { lastName: { contains: search, mode: 'insensitive' } } },
                { contact: { phone: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        // Get leads
        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take,
                include: {
                    contact: true,
                    source: true,
                    payments: true,
                    assignee: {
                        select: { id: true, username: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.lead.count({ where })
        ]);

        return res.status(200).json({
            status: true,
            data: leads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error('Get Leads Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Get lead by ID
export const getLeadById = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(id) },
            include: {
                contact: true,
                source: true,
                payments: true,
                assignee: {
                    select: { id: true, username: true, email: true }
                }
            }
        });

        if (!lead) {
            return res.status(404).json({ status: false, message: 'Lead not found' });
        }

        return res.status(200).json({ status: true, data: lead });
    } catch (error) {
        console.error('Get Lead Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Create new lead
export const createLead = async (req, res) => {
    try {
        const { error, value } = leadSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        // Verify contact exists
        const contactExists = await prisma.contact.findUnique({
            where: { id: value.contactId }
        });
        if (!contactExists) {
            return res.status(404).json({ status: false, message: 'Contact not found' });
        }

        // Create lead
        const newLead = await prisma.lead.create({
            data: value,
            include: {
                contact: true,
                source: true,
                assignee: {
                    select: { id: true, username: true }
                }
            }
        });

        return res.status(201).json({ status: true, message: 'Lead created successfully', data: newLead });
    } catch (error) {
        console.error('Create Lead Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Update lead
export const updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateLeadSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        // Check if lead exists
        const existingLead = await prisma.lead.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingLead) {
            return res.status(404).json({ status: false, message: 'Lead not found' });
        }

        // Update lead
        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(id) },
            data: value,
            include: {
                contact: true,
                source: true,
                assignee: {
                    select: { id: true, username: true }
                }
            }
        });

        return res.status(200).json({ status: true, message: 'Lead updated successfully', data: updatedLead });
    } catch (error) {
        console.error('Update Lead Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete lead
export const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;

        const existingLead = await prisma.lead.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingLead) {
            return res.status(404).json({ status: false, message: 'Lead not found' });
        }

        await prisma.lead.delete({
            where: { id: parseInt(id) }
        });

        return res.status(200).json({ status: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Delete Lead Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete all leads
export const deleteAllLeads = async (req, res) => {
    try {
        await prisma.lead.deleteMany({});
        return res.status(200).json({ status: true, message: 'All leads deleted successfully' });
    } catch (error) {
        console.error('Delete All Leads Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Add note to lead
export const addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, type = 'NOTE', userId } = req.body;

        if (!content) {
            return res.status(400).json({ status: false, message: 'Content is required' });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(id) }
        });

        if (!lead) {
            return res.status(404).json({ status: false, message: 'Lead not found' });
        }

        const activity = await prisma.leadActivity.create({
            data: {
                leadId: parseInt(id),
                content,
                type,
                userId: userId ? parseInt(userId) : null
            },
            include: {
                user: {
                    select: { id: true, username: true, email: true }
                }
            }
        });

        return res.status(201).json({ status: true, message: 'Note added successfully', data: activity });
    } catch (error) {
        console.error('Add Note Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Get lead timeline
export const getLeadTimeline = async (req, res) => {
    try {
        const { id } = req.params;

        const activities = await prisma.leadActivity.findMany({
            where: { leadId: parseInt(id) },
            include: {
                user: {
                    select: { id: true, username: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json({ status: true, data: activities });
    } catch (error) {
        console.error('Get Timeline Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Add payment to lead
export const addPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, date, type, notes } = req.body;

        if (!amount || !date || !type) {
            return res.status(400).json({ status: false, message: 'Amount, Date and Type are required' });
        }

        const lead = await prisma.lead.findUnique({
            where: { id: parseInt(id) }
        });

        if (!lead) {
            return res.status(404).json({ status: false, message: 'Lead not found' });
        }

        const payment = await prisma.payment.create({
            data: {
                leadId: parseInt(id),
                amount: parseFloat(amount),
                date: new Date(date),
                type,
                notes
            }
        });

        return res.status(201).json({ status: true, message: 'Payment added successfully', data: payment });
    } catch (error) {
        console.error('Add Payment Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete payment
export const deletePayment = async (req, res) => {
    try {
        const { id, paymentId } = req.params;

        const payment = await prisma.payment.findUnique({
            where: { id: parseInt(paymentId) }
        });

        if (!payment) {
            return res.status(404).json({ status: false, message: 'Payment not found' });
        }

        await prisma.payment.delete({
            where: { id: parseInt(paymentId) }
        });

        return res.status(200).json({ status: true, message: 'Payment deleted successfully' });
    } catch (error) {
        console.error('Delete Payment Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};
