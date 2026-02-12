/* ── Help Text Definitions for all FinBoard Sections ── */
const HelpTexts = (() => {

  const sections = {
    dashboard: {
      title: 'Dashboard',
      content: 'Overview of your entire portfolio. Shows total market value, invested capital, unrealized and realized P&L at a glance. Allocation charts break down your money by asset type (stocks, ETFs, crypto, etc.) and by individual holdings. The capital timeline tracks how your total investment has grown over time. All data responds to active sidebar filters.',
    },
    holdings: {
      title: 'Holdings',
      content: 'Lists all your active (open) and closed positions. Active positions display live market prices, current value, and unrealized P&L. Closed positions show realized gains or losses. Click any symbol to see a detailed breakdown with price history and individual transactions. Sortable by any column.',
    },
    transactions: {
      title: 'Transactions',
      content: 'Complete history of every buy and sell operation imported from your CSV files. Searchable by symbol and filterable by action type. Shows date, platform, asset type, action, quantity, price, and total amount. Responds to global sidebar filters for platform, type, and date range.',
    },
    timeline: {
      title: 'Timeline',
      content: 'Visual history of your investing activity. The top chart shows cumulative capital invested over time combined with monthly buy/sell bars. The heatmap below shows how active you were each month \u2014 click any month cell to filter all views to that month, or click a year label to filter by year. Colored bars under each cell show the proportion of each asset type.',
    },
    analysis: {
      title: 'Analysis',
      content: 'Various aggregation views of your portfolio data. "By Platform" shows investment distribution across brokers. "By Type" groups by asset category. "By Period" shows yearly investment flow with selectable year filters. "P&L Distribution" is a butterfly chart showing unrealized profit/loss per asset (requires live prices).',
    },
    'alloc-type': {
      title: 'Allocation by Type',
      content: 'Doughnut chart showing how your portfolio value is distributed across asset types:<br><br><b>MKT</b> = Stocks &middot; <b>ETF</b> = ETFs &middot; <b>CRP</b> = Crypto &middot; <b>RSC</b> = Resources (commodities, gold, uranium, etc.) &middot; <b>FUN</b> = Funds<br><br>Values use live market prices when available, falling back to cost basis.',
    },
    'alloc-symbol': {
      title: 'Allocation by Asset',
      content: 'Doughnut chart showing the top 10 individual holdings by current market value. Smaller positions are grouped as "Other". Click any symbol in the Holdings view for detailed analysis.',
    },
    'capital-timeline': {
      title: 'Capital Invested Over Time',
      content: 'Area chart showing the cumulative net capital deployed into your portfolio over time. Calculated as running sum of buys minus sells. Useful for tracking your investment pace and commitment.',
    },
    heatmap: {
      title: 'Activity Heatmap',
      content: 'Grid showing transaction frequency by month. Darker cells mean more transactions that month. Colored bars under each cell show the proportion invested by asset type. Click any cell to filter all views to that specific month. Click a year label to filter the entire year.',
    },
    'monthly-summary': {
      title: 'Monthly Summary',
      content: 'Table listing each month\'s buy amount, sell amount, and net cash flow. Negative net flow means more money was deployed; positive means more was withdrawn from sales.',
    },
    'by-platform': {
      title: 'By Platform',
      content: 'Breakdown of investing activity per broker/platform. Shows total invested, proceeds from sales, net deployed, number of transactions, and unique assets per platform.',
    },
    'by-type': {
      title: 'By Type',
      content: 'Aggregated view by asset type. <b>MKT</b> = Stocks, <b>ETF</b> = ETFs, <b>CRP</b> = Crypto, <b>RSC</b> = Resources (commodities, gold, uranium, etc.), <b>FUN</b> = Funds. Shows position count, total invested, current value, unrealized and realized P&L for each type.',
    },
    'by-period': {
      title: 'By Period (Yearly Flow)',
      content: 'Bar chart and table showing total bought and sold amounts per year. Use the year selector buttons to zoom into a specific year. Helps visualize how your investment strategy changed over time.',
    },
    'pnl-dist': {
      title: 'P&L Distribution (Butterfly)',
      content: 'Horizontal bar chart showing unrealized profit or loss for each active position. Green bars indicate gains, red bars indicate losses. Requires live prices to be loaded \u2014 hit the refresh button in the top bar if data is missing.',
    },
    scoreboard: {
      title: 'Investment Scoreboard',
      content: 'Read left to right \u2014 it tells the story of your money:<br><br><b>Deployed</b> \u2192 all cash you spent buying assets.<br>Then you sold some. The bridge shows what you got back (Proceeds), what those items cost you (Cost of Sold), and the profit/loss on those sales (Realized P&L).<br><br><b>Cost Basis</b> \u2192 what your remaining open positions originally cost. This is NOT the same as "Deployed minus Proceeds" because profitable sales extract more cash than cost.<br><br><b>Market Value</b> \u2192 what your holdings are actually worth today. The difference from Cost Basis is your Unrealized P&L (paper gains/losses).<br><br><b>Total P&L</b> = Realized (from sales) + Unrealized (from market movement).',
    },
    'market-value-estimate': {
      title: 'Market Value (Estimated)',
      content: 'Not all positions have live prices. For positions without a live price, the <b>cost basis</b> (what you paid) is used as a stand-in.<br><br>This means the Market Value shown is an estimate. The real value could be higher or lower depending on how those unpriced positions have moved in the market.<br><br>Click the refresh button (\u21BB) in the top bar to fetch more prices.',
    },
    'realized-breakdown': {
      title: 'Realized P&L Breakdown',
      content: 'Realized P&L comes from two sources:<br><br><b>From sells on open positions</b> \u2014 you partially sold some assets that you still hold. The profit or loss from those partial sells is "realized" even though the position is still active.<br><br><b>From closed positions</b> \u2014 assets you sold entirely. All the P&L from those positions is realized.<br><br>Both add up to the <b>Total Realized P&L</b> shown in the Dashboard scoreboard.',
    },
    'positions-priced': {
      title: 'Positions Priced',
      content: 'Not all of your open positions have live market prices available. Prices are fetched from Yahoo Finance via CORS proxies, and some symbols (less common ETFs, delisted stocks, etc.) may not be found.<br><br><b>"X priced"</b> means X out of your total open positions have a live price. The rest use your cost basis as a fallback, so Market Value and Unrealized P&L will be underestimated until all prices load.<br><br>Click the refresh button (\u21BB) in the top bar to retry fetching prices.',
    },
  };

  function get(key) {
    return sections[key] || { title: key, content: 'No help available for this section.' };
  }

  return { sections, get };
})();
