
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkContacts() {
    try {
        const count = await prisma.contact.count();
        console.log(`Total contacts in DB: ${count}`);
        if (count > 0) {
            const first = await prisma.contact.findFirst();
            console.log('First contact:', first);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkContacts();
