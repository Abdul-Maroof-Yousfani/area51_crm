/**
 * Parses CSV text into a 2D array of rows/columns
 */
export function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      currentRow.push(currentValue.trim());
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentValue += char;
    }
  }
  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    if (currentRow.length > 0) rows.push(currentRow);
  }
  return rows;
}
