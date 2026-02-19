import { useState } from 'react';
import { parseCSV } from '../utils/csv';
import { leadsService } from '../services/api';

/**
 * Matches CSV source text to existing source names (case-insensitive)
 * Returns the matched source name or the original if no match
 */
const matchSource = (csvSource, existingSources) => {
  if (!csvSource) return '';
  const sourceNames = existingSources.map(s => s.name);

  // Exact match (case-insensitive)
  const exactMatch = sourceNames.find(
    name => name.toLowerCase() === csvSource.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  // Partial match (source name contains CSV value or vice versa)
  const partialMatch = sourceNames.find(name => {
    const csvLower = csvSource.toLowerCase();
    const nameLower = name.toLowerCase();
    return nameLower.includes(csvLower) || csvLower.includes(nameLower);
  });
  if (partialMatch) return partialMatch;

  // Common aliases
  const aliases = {
    'walk-in': 'Walkin',
    'walk in': 'Walkin',
    'walkin': 'Walkin',
    'whatsapp': 'Whatsapp Official Number',
    'wa': 'Whatsapp Official Number',
    'meta': 'Meta Lead Gen',
    'facebook': 'Meta Lead Gen',
    'fb': 'Meta Lead Gen',
    'instagram': 'Instagram Message',
    'ig': 'Instagram Message',
    'insta': 'Instagram Message',
    'referral': 'Reference',
    'ref': 'Reference',
    'reference': 'Reference',
    'landline': 'Landline',
    'phone': 'Mobile Number',
    'mobile': 'Mobile Number',
    'cell': 'Mobile Number',
    'returning': 'Previous client',
    'repeat': 'Previous client',
    'existing': 'Previous client'
  };

  const aliasMatch = aliases[csvSource.toLowerCase()];
  if (aliasMatch && sourceNames.includes(aliasMatch)) {
    return aliasMatch;
  }

  // No match - return original (will show as untagged)
  return csvSource;
};

const INITIAL_PROGRESS = {
  open: false,
  total: 0,
  current: 0,
  successCount: 0,
  failedRows: [],
  done: false,
  unmatchedSources: [],
};

export function useCsvUpload(sources = [], onImportDone = null) {
  const [importProgress, setImportProgress] = useState(INITIAL_PROGRESS);

  const closeImportModal = () => {
    setImportProgress(INITIAL_PROGRESS);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const rows = parseCSV(evt.target.result);
        const headerIndex = rows.findIndex((row) =>
          row.join(' ').toLowerCase().includes('client name')
        );

        if (headerIndex === -1) {
          alert('Invalid CSV: Could not find "Client Name" header');
          return;
        }

        const headers = rows[headerIndex].map((h) => h.replace(/"/g, '').trim().toLowerCase());
        const get = (row, ...keys) => {
          for (const k of keys) {
            const idx = headers.findIndex((h) => h.includes(k));
            if (idx > -1 && row[idx]) return row[idx].replace(/"/g, '').trim();
          }
          return '';
        };

        const leadsToImport = [];

        /**
         * KEY FIX: Excel exports comma-formatted numbers WITHOUT quotes in CSV.
         * e.g. 1,450,000 → ["1", "450", "000"] (3 separate cells).
         *
         * IMPORTANT: Only merge at the specific AMOUNT column — not at every
         * pure-digit cell — because phone numbers (e.g. 3030523775) are also
         * pure-digit and would incorrectly merge with the following amount fragment.
         */
        const normalizeRow = (row) => {
          // Find the amount column in the header
          const amtIdx = headers.findIndex(
            (h) => h === 'amount' || h === 'quotation amount' || h.startsWith('amount')
          );
          if (amtIdx < 0 || amtIdx >= row.length) return row;

          const cell = (row[amtIdx] || '').trim();

          // Relaxed check: The first part might be "Rs 1" or just "1". 
          // We rely on the *continued* presence of 3-digit chunks to identify a split.

          // Count how many following cells are exactly-3-digit groups
          let j = amtIdx + 1;
          while (j < row.length && /^\d{3}$/.test((row[j] || '').trim())) j++;

          if (j === amtIdx + 1) return row; // nothing to merge

          // Re-build row: merge the split cells back into one amount cell
          const merged = row.slice(amtIdx, j).join('');
          return [
            ...row.slice(0, amtIdx),
            merged,
            ...row.slice(j)
          ];
        };

        const cleanNumber = (val) => {
          if (!val) return '';
          return String(val).replace(/[^\d.]/g, '');
        };

        rows.slice(headerIndex + 1).forEach((row) => {
          if (row.length < 2) return;

          // Normalize first so split number cells don't offset subsequent columns
          const r = normalizeRow(row);

          const name = get(r, 'client name', 'name');
          if (!name) return;

          leadsToImport.push({
            clientName: name,
            amount: cleanNumber(get(r, 'amount', 'quotation')),
            quotationAmount: cleanNumber(get(r, 'amount', 'quotation')),
            clientBudget: cleanNumber(get(r, 'budget', 'client budget')),
            status: get(r, 'status') || 'New',
            notes: get(r, 'notes'),
            phone: get(r, 'phone', 'contact', 'mobile', 'cell'),
            email: get(r, 'email', 'mail'),
            source: get(r, 'source'),  // now reads correct column after normalization
            manager: get(r, 'manager'),
            inquiryDate: get(r, 'date', 'inquiry date'),
            eventDate: get(r, 'event date', 'eventdate', 'function date'),
            eventType: get(r, 'event type', 'eventtype', 'function type', 'occasion'),
            guests: get(r, 'guests', 'pax', 'headcount', 'attendees'),
            venue: get(r, 'venue', 'location')
          });
        });

        if (leadsToImport.length === 0) {
          alert('No valid leads found in CSV');
          return;
        }

        // Open modal and start import
        setImportProgress({
          open: true,
          total: leadsToImport.length,
          current: 0,
          successCount: 0,
          failedRows: [],
          done: false,
          unmatchedSources: [],
        });

        // Import all leads via API (which processes them server-side)
        // We split into chunks to show progress on the frontend
        const CHUNK_SIZE = 10;
        let successCount = 0;
        const failedRows = [];
        let processed = 0;

        for (let i = 0; i < leadsToImport.length; i += CHUNK_SIZE) {
          const chunk = leadsToImport.slice(i, i + CHUNK_SIZE);
          const chunkStartIndex = i; // CSV data row index (0-based within leadsToImport)

          try {
            const result = await leadsService.import(chunk);

            // result.data = { successCount, failedCount, errors: [{row, error}] }
            successCount += result.data?.successCount ?? chunk.length;

            // Map errors back to their absolute row numbers
            if (result.data?.errors?.length > 0) {
              result.data.errors.forEach((err, errIdx) => {
                // 'errors' array is in order of failed items in the chunk
                // We reconstruct their index by looking at 'results' if available, else estimate
                const absRowNumber = headerIndex + 1 + chunkStartIndex + errIdx + 2; // +2: 1 for header row, 1 for 1-based index
                failedRows.push({
                  rowNumber: absRowNumber,
                  clientName: err.row || chunk[errIdx]?.clientName || '—',
                  error: err.error,
                });
              });
              // Correct successCount from server response
              successCount = successCount - (result.data?.failedCount ?? 0);
            }
          } catch (chunkErr) {
            // Entire chunk failed
            chunk.forEach((lead, ci) => {
              const absRowNumber = headerIndex + 1 + chunkStartIndex + ci + 2;
              failedRows.push({
                rowNumber: absRowNumber,
                clientName: lead.clientName,
                error: chunkErr.message,
              });
            });
          }

          processed += chunk.length;

          // Update progress in state
          setImportProgress(prev => ({
            ...prev,
            current: processed,
            successCount,
            failedRows: [...failedRows],
          }));
        }

        // Mark done
        setImportProgress(prev => ({
          ...prev,
          current: leadsToImport.length,
          successCount,
          failedRows: [...failedRows],
          done: true,
        }));

        // Refresh leads data without page reload
        if (typeof onImportDone === 'function') {
          onImportDone();
        }

      } catch (error) {
        console.error('Import failed:', error);
        setImportProgress(prev => ({
          ...prev,
          done: true,
          failedRows: [...prev.failedRows, { rowNumber: '?', clientName: 'Unknown', error: error.message }],
        }));
      } finally {
        // Reset file input so the same file can be re-selected
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  return { importProgress, closeImportModal, handleFileUpload };
}
