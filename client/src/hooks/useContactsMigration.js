import { useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, appId } from '../lib/firebase';
import { contactService } from '../services/api';
import { normalizePakPhone } from '../utils/helpers';

/**
 * Hook to migrate contacts from Firebase to PostgreSQL
 * Fetches all contacts from Firebase and bulk creates them in PostgreSQL
 */
export function useContactsMigration() {
    const [migrating, setMigrating] = useState(false);
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        success: 0,
        skipped: 0,
        skippedDuplicate: 0,
        skippedInvalid: 0,
        failed: 0
    });
    const [error, setError] = useState(null);

    const migrateContacts = useCallback(async () => {
        setMigrating(true);
        setError(null);
        setProgress({
            current: 0,
            total: 0,
            success: 0,
            skipped: 0,
            skippedDuplicate: 0,
            skippedInvalid: 0,
            failed: 0
        });

        try {
            // Step 1: Fetch all contacts from Firebase
            console.log('Fetching contacts from Firebase...');
            const contactsRef = collection(db, 'artifacts', appId, 'public', 'data', 'contacts');
            const snapshot = await getDocs(contactsRef);

            const firebaseContacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`Found ${firebaseContacts.length} contacts in Firebase`);

            if (firebaseContacts.length === 0) {
                return { success: 0, skipped: 0, failed: 0, total: 0 };
            }

            setProgress(prev => ({ ...prev, total: firebaseContacts.length }));

            // Step 2: Get ALL existing contacts from PostgreSQL to avoid duplicates
            let existingContacts = [];
            try {
                let cursor = null;
                let hasMore = true;

                console.log('Fetching existing contacts from PostgreSQL...');
                while (hasMore) {
                    const result = await contactService.getAll(cursor, 100);
                    existingContacts = [...existingContacts, ...result.data];
                    hasMore = result.pagination.hasMore;
                    cursor = result.pagination.nextCursor;
                }
                console.log(`Fetched ${existingContacts.length} existing contacts from PostgreSQL`);
            } catch (e) {
                console.error('Failed to fetch existing contacts:', e);
                // Continue migration even if fetch fails
            }

            const existingPhones = new Set(existingContacts.map(c => c.phone));
            const existingEmails = new Set(existingContacts.map(c => c.email).filter(Boolean));

            let success = 0;
            let skippedDuplicate = 0;
            let skippedInvalid = 0;
            let failed = 0;

            // Step 3: Migrate each contact
            for (let i = 0; i < firebaseContacts.length; i++) {
                const contact = firebaseContacts[i];

                try {
                    // Try to normalize phone, falling back to original if invalid but non-empty
                    let phone = normalizePakPhone(contact.phone);

                    if (!phone && contact.phone) {
                        // Strip non-digits and '+' if present
                        const cleaned = String(contact.phone).replace(/[^0-9+]/g, '');
                        // Allow if strictly digits and length >= 7 (local number)
                        if (cleaned.length >= 7) phone = cleaned;
                    }

                    if (!phone) {
                        // Skip if no valid phone found
                        console.warn(`Skipping invalid phone: ${contact.firstName} (${contact.phone})`);
                        skippedInvalid++;
                        setProgress(prev => ({
                            ...prev,
                            current: i + 1,
                            skipped: skippedDuplicate + skippedInvalid,
                            skippedInvalid
                        }));
                        continue;
                    }

                    // Check for duplicates in our set first
                    if (existingPhones.has(phone)) {
                        console.log(`Skipping duplicate phone: ${phone} (${contact.firstName})`);
                        skippedDuplicate++;
                        setProgress(prev => ({
                            ...prev,
                            current: i + 1,
                            skipped: skippedDuplicate + skippedInvalid,
                            skippedDuplicate
                        }));
                        continue;
                    }

                    const email = contact.email || null;
                    if (email && existingEmails.has(email)) {
                        console.log(`Skipping duplicate email: ${email} (${contact.firstName})`);
                        skippedDuplicate++;
                        setProgress(prev => ({
                            ...prev,
                            current: i + 1,
                            skipped: skippedDuplicate + skippedInvalid,
                            skippedDuplicate
                        }));
                        continue;
                    }

                    // Prepare contact data for PostgreSQL
                    const contactData = {
                        firstName: contact.firstName || 'Unknown',
                        lastName: contact.lastName || '',
                        email: email,
                        phone: phone
                    };

                    // Create in PostgreSQL
                    await contactService.create(contactData);

                    // Add to existing sets to prevent duplicates in same batch
                    existingPhones.add(phone);
                    if (email) existingEmails.add(email);

                    success++;
                    setProgress(prev => ({ ...prev, current: i + 1, success }));
                } catch (err) {
                    // Handle 409 Conflict (Duplicate) as skipped
                    if (err.message && err.message.includes('already exists')) {
                        console.log(`Skipping duplicate (API 409): ${contact.phone}`);
                        skippedDuplicate++;
                        setProgress(prev => ({
                            ...prev,
                            current: i + 1,
                            skipped: skippedDuplicate + skippedInvalid,
                            skippedDuplicate
                        }));
                        continue;
                    }

                    console.error(`Failed to migrate contact: ${contact.firstName}`, err);
                    failed++;
                    setProgress(prev => ({ ...prev, current: i + 1, failed }));
                }
            }

            console.log('Migration complete:', { success, skippedDuplicate, skippedInvalid, failed, total: firebaseContacts.length });
            return { success, skippedDuplicate, skippedInvalid, failed, total: firebaseContacts.length };
        } catch (err) {
            console.error('Migration error:', err);
            setError(err.message);
            throw err;
        } finally {
            setMigrating(false);
        }
    }, []);

    return {
        migrateContacts,
        migrating,
        progress,
        error
    };
}
