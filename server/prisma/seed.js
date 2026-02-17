
import prisma from '../src/util/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
    const email = 'admin@example.com';
    const password = 'password123';
    const username = 'admin';

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (!existingUser) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        await prisma.user.create({
            data: {
                username,
                email,
                password_hash,
                role: 'Admin',
                is_active: true,
            },
        });
        console.log(`User ${email} created.`);
    } else {
        console.log(`User ${email} already exists.`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
