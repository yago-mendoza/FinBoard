/* ── Portfolio Engine ── */
const Portfolio = (() => {

  /**
   * Adjust pre-split transactions so all quantities/prices are in post-split terms.
   * Balance (cash spent/received) is unchanged.
   * Idempotent: skips transactions already marked as split-adjusted.
   */
  function applySplits(transactions) {
    const splits = Config.SPLITS;
    if (!splits || Object.keys(splits).length === 0) return transactions;

    return transactions.map(tx => {
      if (tx._split) return tx; // Already adjusted (e.g. restored from localStorage)

      const symbolSplits = splits[tx.symbol];
      if (!symbolSplits) return tx;

      // Cumulative ratio for all splits that happened after this transaction
      let ratio = 1;
      for (const split of symbolSplits) {
        if (tx.date < split.date) {
          ratio *= split.ratio;
        }
      }

      if (ratio === 1) return tx;

      return {
        ...tx,
        quantity: tx.quantity * ratio,
        price: tx.price / ratio,
        _split: true,
      };
    });
  }

  /**
   * Compute current holdings from transactions.
   * Uses average cost basis method.
   * Returns array of holding objects.
   */
  function computeHoldings(transactions) {
    const map = {}; // symbol -> { qty, totalCost, realized, buys, sells, type, platform }

    for (const tx of transactions) {
      const sym = tx.symbol;
      if (!map[sym]) {
        map[sym] = {
          symbol: sym,
          type: tx.type,
          platforms: new Set(),
          quantity: 0,
          totalCost: 0,    // Running weighted cost
          realized: 0,
          transactions: 0,
          firstDate: tx.date,
          lastDate: tx.date,
        };
      }

      const h = map[sym];
      h.platforms.add(tx.platform);
      h.transactions++;
      h.lastDate = tx.date;

      if (tx.action === 'buy') {
        h.totalCost += Math.abs(tx.balance);
        h.quantity += tx.quantity;
      } else {
        // Sell: compute realized P&L using average cost
        const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
        const soldQty = Math.abs(tx.quantity);
        const costOfSold = avgCost * soldQty;
        const proceeds = Math.abs(tx.balance);
        h.realized += proceeds - costOfSold;
        h.totalCost -= costOfSold;
        h.quantity -= soldQty;
      }
    }

    return Object.values(map).map(h => ({
      symbol: h.symbol,
      type: h.type,
      platforms: Array.from(h.platforms),
      quantity: Math.max(0, h.quantity), // Clamp rounding errors
      avgCost: h.quantity > 0 ? h.totalCost / h.quantity : 0,
      totalCost: Math.max(0, h.totalCost),
      realized: h.realized,
      transactions: h.transactions,
      firstDate: h.firstDate,
      lastDate: h.lastDate,
      // These get filled after live prices are loaded
      currentPrice: null,
      marketValue: null,
      unrealized: null,
      unrealizedPct: null,
    }));
  }

  /**
   * Apply live prices to holdings.
   */
  function applyPrices(holdings, livePrices) {
    return holdings.map(h => {
      const priceData = livePrices[h.symbol];
      if (!priceData || h.quantity <= 0) return h;

      const currentPrice = priceData.price;
      const marketValue = currentPrice * h.quantity;
      const unrealized = marketValue - h.totalCost;
      const unrealizedPct = h.totalCost > 0 ? (unrealized / h.totalCost) * 100 : 0;

      return { ...h, currentPrice, marketValue, unrealized, unrealizedPct };
    });
  }

  /**
   * Compute portfolio-level KPIs.
   */
  const DUST_THRESHOLD = 0.001;

  function computeKPIs(holdings) {
    let totalValue = 0;
    let totalCost = 0;
    let totalCostPriced = 0;
    let totalUnrealized = null;
    let totalRealized = 0;
    let priced = 0;

    for (const h of holdings) {
      // Always count realized P&L (includes fully closed positions)
      totalRealized += h.realized;
      if (h.quantity < DUST_THRESHOLD) continue;
      totalCost += h.totalCost;
      if (h.marketValue != null) {
        totalValue += h.marketValue;
        totalCostPriced += h.totalCost;
        totalUnrealized = (totalUnrealized || 0) + h.unrealized;
        priced++;
      }
    }

    const positionsTotal = holdings.filter(h => h.quantity >= DUST_THRESHOLD).length;

    return {
      totalValue,
      totalCost,
      totalCostPriced,
      totalUnrealized,
      totalUnrealizedPct: totalCostPriced > 0 && totalUnrealized != null ? (totalUnrealized / totalCostPriced) * 100 : null,
      totalRealized,
      totalPL: totalUnrealized != null ? totalUnrealized + totalRealized : null,
      positionsTotal,
      positionsPriced: priced,
    };
  }

  /**
   * Compute allocation breakdown by type.
   */
  function allocationByType(holdings) {
    const groups = {};
    for (const h of holdings) {
      if (h.quantity <= 0 || h.marketValue == null) continue;
      groups[h.type] = (groups[h.type] || 0) + h.marketValue;
    }
    return groups;
  }

  /**
   * Compute allocation breakdown by symbol.
   */
  function allocationBySymbol(holdings) {
    const groups = {};
    for (const h of holdings) {
      if (h.quantity <= 0 || h.marketValue == null) continue;
      groups[h.symbol] = h.marketValue;
    }
    return groups;
  }

  /**
   * Get list of active positions without live prices.
   */
  function getUnpricedPositions(holdings) {
    return holdings
      .filter(h => h.quantity > 0 && h.marketValue == null)
      .map(h => ({ symbol: h.symbol, type: h.type, totalCost: h.totalCost }));
  }

  /**
   * Compute cumulative capital invested over time.
   * Returns array of { date, cumulative } for charting.
   */
  function capitalTimeline(transactions) {
    let cumulative = 0;
    const points = [];
    const daily = {};

    for (const tx of transactions) {
      cumulative += Math.abs(tx.balance) * (tx.action === 'buy' ? 1 : -1);
      daily[tx.date] = cumulative;
    }

    for (const [date, value] of Object.entries(daily)) {
      points.push({ date, cumulative: value });
    }

    return points.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Aggregate transactions by platform.
   */
  function aggregateByPlatform(transactions) {
    const map = {};
    for (const tx of transactions) {
      const key = tx.platform;
      if (!map[key]) {
        map[key] = { platform: key, invested: 0, proceeds: 0, txCount: 0, symbols: new Set() };
      }
      map[key].txCount++;
      map[key].symbols.add(tx.symbol);
      if (tx.action === 'buy') {
        map[key].invested += Math.abs(tx.balance);
      } else {
        map[key].proceeds += Math.abs(tx.balance);
      }
    }
    return Object.values(map).map(p => ({
      ...p,
      symbols: Array.from(p.symbols),
      net: p.invested - p.proceeds,
    }));
  }

  /**
   * Monthly activity summary.
   */
  function monthlyActivity(transactions) {
    const map = {};
    for (const tx of transactions) {
      const key = tx.date.slice(0, 7); // YYYY-MM
      if (!map[key]) {
        map[key] = { month: key, buys: 0, sells: 0, buyAmount: 0, sellAmount: 0, txCount: 0 };
      }
      map[key].txCount++;
      if (tx.action === 'buy') {
        map[key].buys++;
        map[key].buyAmount += Math.abs(tx.balance);
      } else {
        map[key].sells++;
        map[key].sellAmount += Math.abs(tx.balance);
      }
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get all transactions for a specific symbol.
   */
  function symbolTransactions(transactions, symbol) {
    return transactions.filter(t => t.symbol === symbol);
  }

  /**
   * Compute holding details for a single symbol.
   */
  function symbolHolding(transactions, symbol) {
    const txs = symbolTransactions(transactions, symbol);
    if (txs.length === 0) return null;
    const holdings = computeHoldings(txs);
    return holdings[0] || null;
  }

  /**
   * Compute Investment Scoreboard metrics.
   * Returns three "equation tracks":
   *   Cash Flow:  Deployed - Proceeds = Net Invested
   *   Portfolio:  Cost Basis +/- Unrealized = Market Value
   *   Returns:    Realized + Unrealized = Total P&L (Return %)
   */
  function computeScoreboard(transactions, holdings) {
    let totalDeployed = 0;
    let totalProceeds = 0;

    for (const tx of transactions) {
      if (tx.action === 'buy') {
        totalDeployed += Math.abs(tx.balance);
      } else {
        totalProceeds += Math.abs(tx.balance);
      }
    }

    const netInvested = totalDeployed - totalProceeds;

    let marketValue = 0;
    let costBasis = 0;
    let costBasisPriced = 0;
    let totalRealized = 0;
    let unrealizedPL = null;
    let hasAnyPrice = false;

    for (const h of holdings) {
      totalRealized += h.realized;
      if (h.quantity > 0) {
        costBasis += h.totalCost;
        if (h.marketValue != null) {
          marketValue += h.marketValue;
          costBasisPriced += h.totalCost;
          unrealizedPL = (unrealizedPL || 0) + h.unrealized;
          hasAnyPrice = true;
        }
      }
    }

    const totalPL = (unrealizedPL || 0) + totalRealized;
    const returnPct = totalDeployed > 0 ? (totalPL / totalDeployed) * 100 : 0;

    return {
      totalDeployed,
      totalProceeds,
      netInvested,
      costBasis,
      costBasisPriced,
      marketValue,
      unrealizedPL,
      totalRealized,
      totalPL,
      returnPct,
      hasAnyPrice,
    };
  }

  /**
   * Compute portfolio value over time using historical prices.
   * @param {Array} transactions - sorted by date
   * @param {Object} priceHistories - { SYMBOL: [{ date, close }] }
   * @returns {Array} [{ date, value, invested }]
   */
  function portfolioValueTimeline(transactions, priceHistories) {
    if (!transactions.length || !Object.keys(priceHistories).length) return [];

    // Build price lookup: { SYMBOL: { date: close } } with forward-fill
    const priceLookup = {};
    for (const [sym, history] of Object.entries(priceHistories)) {
      const map = {};
      for (const p of history) map[p.date] = p.close;
      priceLookup[sym] = map;
    }

    // Collect all unique dates from price histories
    const dateSet = new Set();
    for (const history of Object.values(priceHistories)) {
      for (const p of history) dateSet.add(p.date);
    }
    const allDates = Array.from(dateSet).sort();

    if (allDates.length === 0) return [];

    // Sort transactions by date
    const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstTxDate = sortedTxs[0].date;

    // Filter dates to start from first transaction
    const dates = allDates.filter(d => d >= firstTxDate);
    if (dates.length === 0) return [];

    // Walk through dates, replaying transactions and computing value
    const qty = {};        // symbol -> running quantity
    let invested = 0;      // cumulative capital invested
    let txIdx = 0;
    const lastPrice = {};  // symbol -> last known price (forward-fill)
    const result = [];

    for (const date of dates) {
      // Apply all transactions up to and including this date
      while (txIdx < sortedTxs.length && sortedTxs[txIdx].date <= date) {
        const tx = sortedTxs[txIdx];
        if (!qty[tx.symbol]) qty[tx.symbol] = 0;

        if (tx.action === 'buy') {
          qty[tx.symbol] += tx.quantity;
          invested += Math.abs(tx.balance);
        } else {
          qty[tx.symbol] = Math.max(0, qty[tx.symbol] - Math.abs(tx.quantity));
          invested -= Math.abs(tx.balance);
        }
        txIdx++;
      }

      // Update forward-fill prices for this date
      for (const sym of Object.keys(priceLookup)) {
        if (priceLookup[sym][date] != null) {
          lastPrice[sym] = priceLookup[sym][date];
        }
      }

      // Compute portfolio value
      let value = 0;
      for (const [sym, q] of Object.entries(qty)) {
        if (q > 0 && lastPrice[sym] != null) {
          value += q * lastPrice[sym];
        }
      }

      result.push({ date, value, invested });
    }

    return result;
  }

  return {
    applySplits, computeHoldings, applyPrices, computeKPIs,
    allocationByType, allocationBySymbol, capitalTimeline,
    aggregateByPlatform, monthlyActivity,
    symbolTransactions, symbolHolding, computeScoreboard,
    getUnpricedPositions, portfolioValueTimeline,
  };
})();
