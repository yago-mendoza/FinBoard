/* ── CSV Validator ── */
const Validator = (() => {

  const DATETIME_RE = /^\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;

  /**
   * Validate raw CSV text. Returns:
   *   { rows[], errors[], warnings[], summary{}, canProceed }
   */
  function validateCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const errors = [];
    const warnings = [];
    const rows = [];

    if (lines.length < 2) {
      errors.push({ row: 0, msg: 'File is empty or has no data rows.' });
      return { rows, errors, warnings, summary: {}, canProceed: false };
    }

    // Detect header
    const header = lines[0].toLowerCase();
    const hasHeader = header.includes('datetime') || header.includes('symbol');
    const startIdx = hasHeader ? 1 : 0;

    if (!hasHeader) {
      warnings.push({ row: 1, msg: 'No header row detected. Treating first line as data.' });
    }

    const types = new Set();
    const platforms = new Set();
    const symbols = new Set();
    let buyCount = 0;
    let sellCount = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowNum = i + 1;
      const parts = line.split('|');

      // Column count
      if (parts.length < 8) {
        errors.push({ row: rowNum, msg: `Expected 8 columns, found ${parts.length}.` });
        continue;
      }
      if (parts.length > 8) {
        warnings.push({ row: rowNum, msg: `Extra columns detected (${parts.length}), ignoring extras.` });
      }

      const [datetime, type, platform, action, symbol, quantity, price, balance] = parts.map(s => s.trim());

      // Datetime format
      if (!DATETIME_RE.test(datetime)) {
        errors.push({ row: rowNum, msg: `Invalid datetime "${datetime}". Expected YY-MM-DD-HH-MM.` });
      } else {
        const dp = datetime.split('-').map(Number);
        const m = dp[1], d = dp[2], h = dp[3], min = dp[4];
        if (m < 1 || m > 12) errors.push({ row: rowNum, msg: `Month ${m} out of range (1-12).` });
        if (d < 1 || d > 31) errors.push({ row: rowNum, msg: `Day ${d} out of range (1-31).` });
        if (h > 23) errors.push({ row: rowNum, msg: `Hour ${h} out of range (0-23).` });
        if (min > 59) errors.push({ row: rowNum, msg: `Minute ${min} out of range (0-59).` });
      }

      // TYPE
      const typeUpper = type.toUpperCase();
      if (!Config.VALID_TYPES.includes(typeUpper)) {
        errors.push({ row: rowNum, msg: `Invalid TYPE "${type}". Must be one of: ${Config.VALID_TYPES.join(', ')}.` });
      } else {
        types.add(typeUpper);
      }

      // ACTION
      const actionLower = action.toLowerCase();
      if (!Config.VALID_ACTIONS.includes(actionLower)) {
        errors.push({ row: rowNum, msg: `Invalid ACTION "${action}". Must be one of: ${Config.VALID_ACTIONS.join(', ')}.` });
      } else {
        if (actionLower === 'buy') buyCount++;
        else sellCount++;
      }

      // PLATFORM
      if (!platform || platform.length < 2) {
        warnings.push({ row: rowNum, msg: `Platform "${platform}" seems too short.` });
      }
      platforms.add(platform.toUpperCase());

      // SYMBOL
      if (!symbol || symbol.length === 0) {
        errors.push({ row: rowNum, msg: 'Symbol is empty.' });
      } else {
        symbols.add(symbol.toUpperCase());
      }

      // QUANTITY
      const qtyClean = quantity.replace('+', '');
      const qtyNum = parseFloat(qtyClean);
      if (isNaN(qtyNum) || qtyNum === 0) {
        errors.push({ row: rowNum, msg: `Invalid QUANTITY "${quantity}". Must be a non-zero number.` });
      }

      // PRICE
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        errors.push({ row: rowNum, msg: `Invalid PRICE "${price}". Must be a non-negative number.` });
      }

      // BALANCE
      const balNum = parseFloat(balance);
      if (isNaN(balNum)) {
        errors.push({ row: rowNum, msg: `Invalid BALANCE "${balance}". Must be a number.` });
      }

      // Sign consistency
      if (!isNaN(qtyNum) && !isNaN(balNum) && Config.VALID_ACTIONS.includes(actionLower)) {
        if (actionLower === 'buy' && balNum > 0) {
          warnings.push({ row: rowNum, msg: 'Buy transaction has positive balance (expected negative).' });
        }
        if (actionLower === 'sel' && balNum < 0) {
          warnings.push({ row: rowNum, msg: 'Sell transaction has negative balance (expected positive).' });
        }
      }

      rows.push({
        rowNum,
        datetime, type: typeUpper, platform: platform.toUpperCase(),
        action: actionLower, symbol: symbol.toUpperCase(),
        quantity: qtyNum, price: priceNum, balance: balNum,
      });
    }

    const summary = {
      totalRows: rows.length,
      types: [...types],
      platforms: [...platforms],
      symbols: [...symbols],
      buyCount,
      sellCount,
    };

    return {
      rows,
      errors,
      warnings,
      summary,
      canProceed: errors.length === 0 && rows.length > 0,
    };
  }

  /**
   * Post-validation: detect duplicates, crypto mismatch, etc.
   */
  function categorizeResults(result, hasCrypto) {
    const { rows, warnings } = result;

    // Duplicate detection (same datetime + symbol + action)
    const seen = new Map();
    for (const r of rows) {
      const key = `${r.datetime}|${r.symbol}|${r.action}`;
      if (seen.has(key)) {
        warnings.push({
          row: r.rowNum,
          msg: `Possible duplicate of row ${seen.get(key)} (same datetime, symbol, action).`,
        });
      } else {
        seen.set(key, r.rowNum);
      }
    }

    // Crypto mismatch
    const hasCRP = result.summary.types.includes('CRP');
    if (!hasCrypto && hasCRP) {
      warnings.push({
        row: 0,
        msg: 'Crypto transactions (CRP) found but crypto is disabled in settings. They will still be loaded.',
      });
    }
    if (hasCrypto && !hasCRP) {
      warnings.push({
        row: 0,
        msg: 'Crypto is enabled but no CRP transactions found in the CSV.',
      });
    }

    return result;
  }

  return { validateCSV, categorizeResults };
})();
