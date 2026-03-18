import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch globally before importing the module
const originalFetch = globalThis.fetch;

describe('Uniswap swap module', () => {
  it('checkApproval returns null for native ETH', async () => {
    // Mock fetch to avoid real API calls
    globalThis.fetch = mock.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ approval: null }) }),
    );

    const { checkApproval } = await import('../src/uniswap-swap.js');
    const result = await checkApproval(
      '0x1234567890abcdef1234567890abcdef12345678',
      '0x0000000000000000000000000000000000000000',
      '1000000',
      1,
    );
    assert.equal(result, null);

    globalThis.fetch = originalFetch;
  });

  it('getQuote throws on API error', async () => {
    globalThis.fetch = mock.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Invalid token pair' }),
      }),
    );

    const { getQuote } = await import('../src/uniswap-swap.js');
    await assert.rejects(
      () =>
        getQuote({
          swapper: '0x1234567890abcdef1234567890abcdef12345678',
          tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          chainId: 1,
          amount: '1000000',
        }),
      { message: 'Invalid token pair' },
    );

    globalThis.fetch = originalFetch;
  });
});
