/* ── CSV Parser (pipe-delimited) ── */
const Parser = (() => {

  /**
   * Parse a pipe-delimited CSV string.
   * Format: DATETIME|TYPE|PLATFORM|ACTION|SYMBOL|QUANTITY|PRICE|BALANCE
   * DATETIME: YY-MM-DD-HH-MM
   */
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Skip header line
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('datetime') || header.includes('symbol');
    const startIdx = hasHeader ? 1 : 0;

    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('|');
      if (parts.length < 8) continue;

      const [datetime, type, platform, action, symbol, quantity, price, balance] = parts;

      // Parse datetime: YY-MM-DD-HH-MM -> proper date
      const dtParts = datetime.split('-');
      if (dtParts.length < 5) continue;

      const year = 2000 + parseInt(dtParts[0], 10);
      const month = parseInt(dtParts[1], 10) - 1;
      const day = parseInt(dtParts[2], 10);
      const hour = parseInt(dtParts[3], 10);
      const minute = parseInt(dtParts[4], 10);
      const dateObj = new Date(year, month, day, hour, minute);

      // Build date string directly from parsed components (timezone-safe)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      rows.push({
        date: dateStr,                                    // YYYY-MM-DD (local, no TZ shift)
        datetime: dateObj.toISOString(),                  // Full ISO

        dateObj,
        type: type.trim().toUpperCase(),
        platform: platform.trim().toUpperCase(),
        action: action.trim().toLowerCase(),              // 'buy' or 'sel'
        symbol: symbol.trim().toUpperCase(),
        quantity: parseFloat(quantity.replace('+', '')),   // Remove leading +
        price: parseFloat(price),
        balance: parseFloat(balance),
      });
    }

    return rows.sort((a, b) => a.dateObj - b.dateObj);
  }

  /**
   * Merge stock + crypto arrays into one sorted array.
   */
  function merge(stockRows, cryptoRows) {
    const all = [...stockRows, ...cryptoRows];
    return all.sort((a, b) => a.dateObj - b.dateObj);
  }

  /**
   * Read a File object and return parsed rows.
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(parseCSV(e.target.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  return { parseCSV, merge, readFile };
})();
