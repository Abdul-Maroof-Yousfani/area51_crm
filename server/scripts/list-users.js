import prisma from '../src/util/prisma.js';

async function main() {
    try {
        const users = await prisma.user.findMany();
        console.log('Users found:', users.length);
        users.forEach(user => {
            console.log(`ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Active: ${user.is_active}`);
        });
    } catch (error) {
        console.error('Error listing users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
