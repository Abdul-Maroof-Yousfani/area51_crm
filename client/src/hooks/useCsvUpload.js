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

export function useCsvUpload(sources = []) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const rows = parseCSV(evt.target.result);
        const headerIndex = rows.findIndex((row) =>
          row.join(' ').toLowerCase().includes('client name')
        );

        if (headerIndex === -1) {
          alert('Invalid CSV: Could not find "Client Name" header');
          setUploading(false);
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
        let unmatchedSources = new Set();

        rows.slice(headerIndex + 1).forEach((row) => {
          if (row.length < 2) return;
          const name = get(row, 'client name', 'name');
          if (!name) return;

          const rawSource = get(row, 'source');
          const matchedSource = matchSource(rawSource, sources);

          // Track unmatched sources for reporting
          if (rawSource && matchedSource === rawSource && !sources.find(s => s.name === rawSource)) {
            unmatchedSources.add(rawSource);
          }

          leadsToImport.push({
            clientName: name,
            amount: get(row, 'amount'),
            status: get(row, 'status') || 'New', // Backend handles mapping/defaults
            notes: get(row, 'notes'),
            phone: get(row, 'phone', 'contact', 'mobile', 'cell'),
            email: get(row, 'email', 'mail'),
            source: matchedSource,
            manager: get(row, 'manager'),
            inquiryDate: get(row, 'date', 'inquiry date'),
            // Event details
            eventDate: get(row, 'event date', 'eventdate', 'function date'),
            eventType: get(row, 'event type', 'eventtype', 'function type', 'occasion'),
            guests: get(row, 'guests', 'pax', 'headcount', 'attendees'),
            venue: get(row, 'venue', 'location')
          });
        });

        if (leadsToImport.length > 0) {
          const result = await leadsService.import(leadsToImport);
          let message = result.message || `Imported ${leadsToImport.length} leads.`;

          if (unmatchedSources.size > 0) {
            message += `\n\nUnmatched sources (saved as text): ${[...unmatchedSources].join(', ')}`;
          }
          alert(message);

          // Reload page or trigger refresh?
          // Ideally we should trigger a refresh via context, but strict reload ensures data is fresh
          window.location.reload();
        } else {
          alert('No valid leads found in CSV');
        }

      } catch (error) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}`);
      } finally {
        setUploading(false);
        // Reset file input
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  return { uploading, handleFileUpload };
}
