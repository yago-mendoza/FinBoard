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
    analysis: {
      title: 'Analysis',
      content: 'Deep-dive into your portfolio data across five sub-tabs:<br><br><b>Overview</b> \u2014 Full Investment Scoreboard with bar diagram, hover interaction, and cash detail.<br><b>Breakdown</b> \u2014 Investment by Platform and by Type with doughnut charts and tables.<br><b>Timeline</b> \u2014 Capital + activity chart, heatmap, monthly summary, and yearly flow.<br><b>P&L</b> \u2014 Butterfly chart of unrealized P&L per asset (requires live prices).<br><b>Compare</b> \u2014 Overlay price charts for multiple holdings.',
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
    'csv-format': {
      title: 'CSV Format',
      content: 'FinBoard uses a pipe-delimited (|) CSV format with 8 columns:<br><br><b>DATETIME</b> \u2014 YY-MM-DD-HH-MM format<br><b>TYPE</b> \u2014 MKT (stocks), ETF, CRP (crypto), RSC (resources), FUN (funds)<br><b>PLATFORM</b> \u2014 4-letter broker code (e.g., IBKR, TDRP)<br><b>ACTION</b> \u2014 "buy" or "sel" (sell)<br><b>SYMBOL</b> \u2014 Ticker symbol (e.g., AAPL, BTC)<br><b>QUANTITY</b> \u2014 Number of units (+ prefix allowed)<br><b>PRICE</b> \u2014 Price per unit<br><b>BALANCE</b> \u2014 Total cash impact (negative for buys, positive for sells)',
    },
    'csv-upload': {
      title: 'CSV Upload',
      content: 'You can upload one or more CSV files. Stock and crypto transactions can be in the same file \u2014 the TYPE column differentiates them (MKT for stocks, CRP for crypto). Drop files on the upload zone or click to browse. Files are read locally in your browser and never sent to any server.',
    },
    'csv-validation': {
      title: 'CSV Validation',
      content: '<b>Errors</b> block you from proceeding and must be fixed in your CSV. Common errors: wrong column count, invalid date format, unknown TYPE or ACTION, non-numeric values.<br><br><b>Warnings</b> are informational and won\'t block you. Examples: positive balance on a buy, possible duplicate rows, extra columns.',
    },
    'cash-balances': {
      title: 'Cash Balances',
      content: 'Uninvested cash per platform. These appear on your Dashboard as a KPI card and factor into the Total Portfolio calculation. Enter the current cash balance you hold in each broker. You can skip this step and add them later.',
    },
    'export': {
      title: 'Export data',
      content: 'Copy portfolio data to your clipboard in various formats. <b>Portfolio overview</b> gives a human-readable summary of your positions, P&L, and cash. <b>All holdings</b> copies a tab-separated table you can paste into a spreadsheet. <b>Transaction history</b> exports every buy and sell. You can also export a single asset by typing its symbol.',
    },
    'drag-dashboard': {
      title: 'Dashboard Layout',
      content: 'Hover over any dashboard section to reveal a grip handle on the left. Drag it to reorder widgets. Your layout is saved and persists across sessions. Use Settings to reset to the default order.',
    },
    settings: {
      title: 'Settings',
      content: 'Click the gear icon in the top bar to open Settings.<br><br><b>Crypto toggle</b> \u2014 Include or exclude crypto assets.<br><b>Auto-refresh prices</b> \u2014 Fetch live prices automatically on load.<br><b>Show closed positions</b> \u2014 Toggle visibility of fully sold positions.<br><b>Cash balances</b> \u2014 Edit uninvested cash per platform.<br><b>Reset layout</b> \u2014 Restore default dashboard widget order.<br><b>Reset all data</b> \u2014 Clear everything and return to onboarding.',
    },
  };

  function get(key) {
    return sections[key] || { title: key, content: 'No help available for this section.' };
  }

  return { sections, get };
})();
