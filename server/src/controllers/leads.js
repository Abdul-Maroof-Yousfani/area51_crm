import prisma from '../util/prisma.js';
import Joi from 'joi';
import { getIO } from '../util/socket.js';

// Validation schemas
const leadSchema = Joi.object({
    title: Joi.string().allow('', null),
    quotationAmount: Joi.number().allow(null).default(0),
    clientBudget: Joi.number().required(),
    status: Joi.string().allow('', null).default('New'),
    probability: Joi.number().allow(null).default(0),
    expectedCloseDate: Joi.date().allow(null),
    notes: Joi.string().allow('', null),
    contactId: Joi.number().required(),
    sourceId: Joi.number().allow(null),
    assignedTo: Joi.number().allow(null),
    // Booking/Event fields
    guests: Joi.number().allow(null),
    venue: Joi.string().allow('', null),
    eventType: Joi.string().allow('', null),
    eventDate: Joi.date().allow(null),
    finalAmount: Joi.number().allow(null),
    advanceAmount: Joi.number().allow(null),
    // Site visit fields
    siteVisitDate: Joi.date().allow(null),
    siteVisitTime: Joi.string().allow('', null)
});

const updateLeadSchema = Joi.object({
    title: Joi.string().allow('', null),
    quotationAmount: Joi.number().allow(null),
    clientBudget: Joi.number(),
    status: Joi.string().allow('', null),
    probability: Joi.number().allow(null),
    expectedCloseDate: Joi.date().allow(null),
    notes: Joi.string().allow('', null),
    contactId: Joi.number(),
    sourceId: Joi.number().allow(null),
    assignedTo: Joi.number().allow(null),
    // Booking/Event fields
    guests: Joi.number().allow(null),
    venue: Joi.string().allow('', null),
    eventType: Joi.string().allow('', null),
    eventDate: Joi.date().allow(null),
    finalAmount: Joi.number().allow(null),
    advanceAmount: Joi.number().allow(null),
    // Site visit fields
    siteVisitDate: Joi.date().allow(null),
    siteVisitTime: Joi.string().allow('', null),
    // Booking Details
    bookingNotes: Joi.string().allow('', null),
    bookedAt: Joi.date().allow(null),
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
        console.log('📥 Received lead creation request:', JSON.stringify(req.body, null, 2));

        const { error, value } = leadSchema.validate(req.body);
        if (error) {
            console.error('❌ Validation Error:', error.details[0].message);
            console.error('❌ Validation Details:', error.details);
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

        // Create Notification in DB
        const notification = await prisma.notification.create({
            data: {
                type: 'lead_assigned',
                message: `New Lead: ${newLead.title || 'Received'}`,
                leadId: newLead.id,
                userId: newLead.assignedTo || null, // Specific user or null
                assignedTo: newLead.assignedTo ? null : 'Admin', // If no specific user, assign to Admin (and Owner via logic)
                priority: 'high'
            }
        });

        // Emit new lead event (and include notification data if possible, or emit separate event)
        try {
            const io = getIO();
            console.log('📢 Emitting new-lead event for lead:', newLead.id);
            // We emit the lead, and also the notification so frontend can add it to state immediately
            io.emit('new-lead', { lead: newLead, notification });
        } catch (socketError) {
            console.error('Socket emit error:', socketError);
            // Don't fail the request if socket fails
        }

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
        // Handle relations separately and clean up data
        const { contactId, sourceId, assignedTo, ...cleanData } = value;

        // Whitelist allowed fields to prevent unknown argument errors
        const allowedFields = [
            'title', 'quotationAmount', 'clientBudget', 'status', 'probability', 'expectedCloseDate',
            'notes', 'guests', 'venue', 'eventType', 'eventDate',
            'finalAmount', 'advanceAmount', 'siteVisitDate', 'siteVisitTime',
            'bookingNotes', 'bookedAt', 'bookedBy', 'createdAt', 'updatedAt',
            'stageUpdatedAt', 'stageUpdatedBy'
        ];

        const updateData = {};

        // Only copy allowed fields
        Object.keys(cleanData).forEach(key => {
            if (allowedFields.includes(key)) {
                updateData[key] = cleanData[key];
            }
        });

        console.log('🔄 Update Lead Payload:', JSON.stringify(cleanData, null, 2));
        console.log('🔍 Prisma Update Data:', JSON.stringify(updateData, null, 2));

        // 1. Handle Contact (Required in schema, but optional in update payload)
        if (contactId) {
            updateData.contact = { connect: { id: parseInt(contactId) } };
        }

        // 2. Handle Source (Optional)
        if (sourceId !== undefined) {
            if (sourceId) {
                updateData.source = { connect: { id: parseInt(sourceId) } };
            } else {
                updateData.source = { disconnect: true };
            }
        }

        // 3. Handle Assignee (Optional)
        if (assignedTo !== undefined) {
            if (assignedTo) {
                updateData.assignee = { connect: { id: parseInt(assignedTo) } };
            } else {
                updateData.assignee = { disconnect: true };
            }
        }

        const updatedLead = await prisma.lead.update({
            where: { id: parseInt(id) },
            data: updateData,
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

// Import leads from CSV (Bulk)
export const importLeads = async (req, res) => {
    try {
        const { leads } = req.body; // Expecting an array of lead objects
        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ status: false, message: 'Invalid or empty leads data' });
        }

        let successCount = 0;
        let failedCount = 0;
        const errors = [];
        const results = [];

        // Process leads sequentially to handle potential race conditions with contact creation
        for (const leadData of leads) {
            try {
                // 1. Resolve/Create Contact
                let contactId = leadData.contactId;

                // If no contactId provided, try to find or create based on phone/name
                if (!contactId) {
                    const phone = leadData.phone ? String(leadData.phone).trim() : null;
                    const name = leadData.clientName || leadData.title || 'Unknown Client';

                    // Try finding by phone first if available
                    let existingContact = null;
                    if (phone) {
                        existingContact = await prisma.contact.findUnique({
                            where: { phone }
                        });
                    }

                    if (existingContact) {
                        contactId = existingContact.id;
                    } else {
                        // Create new contact
                        // Check if email is provided and unique, otherwise ignore email to avoid unique constraint error
                        let email = leadData.email || null;
                        if (email) {
                            const existingEmail = await prisma.contact.findUnique({ where: { email } });
                            if (existingEmail) email = null; // Don't use duplicate email
                        }

                        // Split name
                        const parts = name.split(' ');
                        const firstName = parts[0];
                        const lastName = parts.slice(1).join(' ') || '';

                        const newContact = await prisma.contact.create({
                            data: {
                                firstName,
                                lastName,
                                phone: phone || `unknown-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Phone is unique required, generate dummy if missing
                                email
                            }
                        });
                        contactId = newContact.id;
                    }
                }

                if (!contactId) {
                    throw new Error('Could not identify or create contact');
                }

                // 2. Resolve Source
                let sourceId = leadData.sourceId;
                if (!sourceId && leadData.source) {
                    const sourceName = leadData.source;
                    const source = await prisma.sources.findFirst({
                        where: { name: { equals: sourceName, mode: 'insensitive' } }
                    });

                    if (source) {
                        sourceId = source.id;
                    } else {
                        // Optionally create source? For now, leave null if not found
                    }
                }

                // 3. Resolve Manager (AssignedTo)
                let assignedTo = leadData.assignedTo;
                if (!assignedTo && leadData.manager) {
                    const managerName = leadData.manager;
                    const user = await prisma.user.findFirst({
                        where: { username: { equals: managerName, mode: 'insensitive' } }
                    });
                    if (user) assignedTo = user.id;
                }

                // 4. Create Lead
                const newLead = await prisma.lead.create({
                    data: {
                        title: leadData.title || leadData.clientName || 'New Imported Lead',
                        quotationAmount: leadData.quotationAmount || leadData.amount ? parseFloat(leadData.quotationAmount || leadData.amount) : 0,
                        clientBudget: leadData.clientBudget ? parseFloat(leadData.clientBudget) : 0,
                        status: leadData.status || 'New',
                        notes: leadData.notes || '',
                        contactId: contactId,
                        sourceId: sourceId, // Can be null
                        assignedTo: assignedTo, // Can be null

                        // Event details
                        eventType: leadData.eventType || null,
                        eventDate: leadData.eventDate ? new Date(leadData.eventDate) : null,
                        venue: leadData.venue || null,
                        guests: leadData.guests ? parseInt(leadData.guests) : null,

                        // Timestamps
                        createdAt: leadData.inquiryDate ? new Date(leadData.inquiryDate) : new Date()
                    }
                });

                successCount++;
                results.push({ status: 'success', id: newLead.id, title: newLead.title });

            } catch (err) {
                console.error('Import error for row:', leadData, err);
                failedCount++;
                errors.push({
                    row: leadData.clientName || 'Unknown',
                    error: err.message
                });
                results.push({ status: 'failed', error: err.message });
            }
        }

        return res.status(200).json({
            status: true,
            message: `Import processed. Success: ${successCount}, Failed: ${failedCount}`,
            data: { successCount, failedCount, errors }
        });

    } catch (error) {
        console.error('Import Leads Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};
