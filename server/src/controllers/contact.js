import prisma from '../util/prisma.js';
import Joi from 'joi';

// Validation schemas
const contactSchema = Joi.object({
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().max(100).allow('', null),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().min(7).max(20).required(),
    notes: Joi.string().allow('', null)
});

const updateContactSchema = Joi.object({
    firstName: Joi.string().min(1).max(100),
    lastName: Joi.string().max(100).allow('', null),
    email: Joi.string().email().allow('', null),
    phone: Joi.string().min(7).max(20),
    notes: Joi.string().allow('', null)
}).min(1);

// Get all contacts with pagination
export const getContacts = async (req, res) => {
    try {
        const { cursor, limit = 100 } = req.query;
        const take = Math.min(parseInt(limit) || 100, 1000); // Max 1000 per request

        // Build query conditions
        const whereCondition = cursor ? { id: { gt: parseInt(cursor) } } : {};

        // Get paginated contacts
        const contacts = await prisma.contact.findMany({
            where: whereCondition,
            take: take + 1, // Fetch one extra to check if there are more
            orderBy: { id: 'asc' }
        });

        // Get total count
        const total = await prisma.contact.count();

        // Check if there are more records
        const hasMore = contacts.length > take;
        const data = hasMore ? contacts.slice(0, take) : contacts;
        const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

        return res.status(200).json({
            status: true,
            data,
            pagination: {
                nextCursor,
                hasMore,
                total,
                returned: data.length
            }
        });
    } catch (error) {
        console.error('Get Contacts Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Get contact by ID
export const getContactById = async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await prisma.contact.findUnique({
            where: { id: parseInt(id) }
        });

        if (!contact) {
            return res.status(404).json({ status: false, message: 'Contact not found' });
        }

        return res.status(200).json({ status: true, data: contact });
    } catch (error) {
        console.error('Get Contact Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Create new contact
export const createContact = async (req, res) => {
    try {
        const { error, value } = contactSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const { firstName, lastName, email, phone } = value;

        // Build OR conditions dynamically to ignore null/empty values
        const orConditions = [];
        if (email) orConditions.push({ email });
        if (phone) orConditions.push({ phone });

        // Check if email or phone already exists
        if (orConditions.length > 0) {
            const existingContact = await prisma.contact.findFirst({
                where: {
                    OR: orConditions
                }
            });

            if (existingContact) {
                return res.status(409).json({ status: false, message: 'Contact with this email or phone already exists' });
            }
        }

        const newContact = await prisma.contact.create({
            data: { firstName, lastName, email, phone }
        });

        return res.status(201).json({ status: true, message: 'Contact created successfully', data: newContact });
    } catch (error) {
        console.error('Create Contact Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Update contact
export const updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateContactSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        // Check if contact exists
        const existingContact = await prisma.contact.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingContact) {
            return res.status(404).json({ status: false, message: 'Contact not found' });
        }

        // Check for duplicate email/phone if being updated
        if (value.email || value.phone) {
            const duplicate = await prisma.contact.findFirst({
                where: {
                    AND: [
                        { id: { not: parseInt(id) } },
                        {
                            OR: [
                                value.email ? { email: value.email } : {},
                                value.phone ? { phone: value.phone } : {}
                            ].filter(obj => Object.keys(obj).length > 0)
                        }
                    ]
                }
            });

            if (duplicate) {
                return res.status(409).json({ status: false, message: 'Email or phone already in use by another contact' });
            }
        }

        const updatedContact = await prisma.contact.update({
            where: { id: parseInt(id) },
            data: value
        });

        return res.status(200).json({ status: true, message: 'Contact updated successfully', data: updatedContact });
    } catch (error) {
        console.error('Update Contact Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete contact
export const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;

        const existingContact = await prisma.contact.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingContact) {
            return res.status(404).json({ status: false, message: 'Contact not found' });
        }

        await prisma.contact.delete({
            where: { id: parseInt(id) }
        });

        return res.status(200).json({ status: true, message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Delete Contact Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

// Delete all contacts
export const deleteAllContacts = async (req, res) => {
    try {
        const result = await prisma.contact.deleteMany({});
        return res.status(200).json({
            status: true,
            message: `All contacts deleted successfully`,
            deletedCount: result.count
        });
    } catch (error) {
        console.error('Delete All Contacts Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};
