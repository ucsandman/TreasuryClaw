// src/price-feed.js

const SOURCES = [
  {
    name: 'Binance',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    parse: (data) => parseFloat(data.price),
  },
  {
    name: 'Coinbase',
    url: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
    parse: (data) => parseFloat(data.data.amount),
  },
  {
    name: 'DeFi Llama',
    url: 'https://coins.llama.fi/prices/current/coingecko:ethereum',
    parse: (data) => data.coins['coingecko:ethereum'].price,
  },
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
    parse: (data) => data.USD,
  },
];

let sourceIndex = 0;

/**
 * Get ETH/USD price from the next source in rotation.
 * Falls back to subsequent sources on failure.
 */
export async function getEthPrice() {
  const errors = [];
  for (let attempt = 0; attempt < SOURCES.length; attempt++) {
    const source = SOURCES[(sourceIndex + attempt) % SOURCES.length];
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const price = source.parse(data);
      if (!price || isNaN(price)) throw new Error('Invalid price');
      sourceIndex = (sourceIndex + attempt + 1) % SOURCES.length;
      return { price, source: source.name, timestamp: Date.now() };
    } catch (err) {
      errors.push(`${source.name}: ${err.message}`);
    }
  }
  throw new Error(`All price sources failed: ${errors.join(', ')}`);
}

/**
 * Get median ETH/USD price from all sources simultaneously.
 * Used for cross-validation every 5th cycle.
 */
export async function getMedianEthPrice() {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return source.parse(data);
    })
  );
  const prices = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(p => p && !isNaN(p));
  if (prices.length === 0) throw new Error('No price sources available');
  prices.sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return { price: median, sources: prices.length, timestamp: Date.now() };
}
