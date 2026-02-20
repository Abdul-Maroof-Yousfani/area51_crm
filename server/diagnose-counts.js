import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import prisma from './src/util/prisma.js';

async function diagnose() {
    try {
        console.log('Checking database connection...');
        await prisma.$connect();
        console.log('Connected.');

        const contactCount = await prisma.contact.count();
        console.log(`Prisma Contact Count: ${contactCount}`);

        const leadCount = await prisma.lead.count();
        console.log(`Prisma Lead Count: ${leadCount}`);

        // Check if there are any filters or soft deletes (unlikely but good to check)
        const sampleContacts = await prisma.contact.findMany({ take: 5 });
        console.log('Sample Contacts:', JSON.stringify(sampleContacts, null, 2));

    } catch (error) {
        console.error('DIAGNOSTIC ERROR:', error);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
