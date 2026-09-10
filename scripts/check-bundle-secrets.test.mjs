// Self-test for scripts/check-bundle-secrets.mjs — run with `node --test`.
//
// Every synthetic secret below is built by concatenation so this file's own
// source text never contains a matchable literal (and so it doesn't need to
// be excluded from the scanner's own patterns on that basis — it's excluded
// anyway, defensively, as a hardcoded exemption in the scanner).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALUE_PATTERNS,
  CLIENT_ONLY_PATTERNS,
  NEXT_PUBLIC_NAME_RE,
  REJECTED_NAME_RE,
  PLACEHOLDER_RE,
  DIGIT_RE,
  IDENTIFIER_COLLISION_PRONE,
} from './check-bundle-secrets.mjs';

function findPattern(name) {
  const found = [...VALUE_PATTERNS, ...CLIENT_ONLY_PATTERNS].find((p) => p.name === name);
  assert.ok(found, `pattern "${name}" should exist`);
  return found;
}

function matches(pattern, sample) {
  pattern.re.lastIndex = 0;
  return pattern.re.test(sample);
}

const CASES = [
  {
    pattern: 'jwt',
    sample: ['eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJ', 'zdWIiOiIxMjM0NTY3ODkwIn0', '.', 'SflKxwRJSMeKKF2QT4fwpMe'].join(''),
  },
  {
    pattern: 'gatewayz-key',
    sample: ['gw', '_', 'live', '_', 'aBcDeFgHiJkLmNoPqRsT'].join(''),
  },
  {
    pattern: 'resend-key',
    sample: ['re', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX'].join(''),
  },
  {
    pattern: 'supabase-pat',
    sample: ['sbp', '_', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5'].join(''),
  },
  {
    pattern: 'stripe-secret-key',
    sample: ['sk', '_', 'live', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX'].join(''),
  },
  {
    pattern: 'stripe-restricted-key',
    sample: ['rk', '_', 'live', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX'].join(''),
  },
  {
    pattern: 'stripe-webhook-secret',
    sample: ['whsec', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX'].join(''),
  },
  {
    pattern: 'openai-style-key',
    sample: ['sk', '-', 'aBcDeFgHiJkLmNoPqRsTuVwXyZ12'].join(''),
  },
  {
    pattern: 'privy-secret',
    sample: ['privy', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX12'].join(''),
  },
  {
    pattern: 'aws-access-key-id',
    sample: ['AKIA', 'ABCDEFGHIJ12345', '6'].join(''),
  },
  {
    pattern: 'private-key-block',
    sample: ['-----BEGIN', ' ', 'RSA ', 'PRIVATE KEY-----'].join(''),
  },
  {
    pattern: 'hex-secret-assignment',
    sample: ['SEC', 'RET', ' = "', 'a'.repeat(40), '"'].join(''),
  },
  {
    pattern: 'supabase-project-url',
    sample: ['https://', 'a'.repeat(20), '.supabase.co'].join(''),
  },
];

for (const { pattern: name, sample } of CASES) {
  test(`${name} pattern matches its synthetic fixture`, () => {
    assert.ok(matches(findPattern(name), sample), `expected ${name} pattern to match synthetic sample`);
  });
}

test('value patterns do not match ordinary source text', () => {
  const benign = [
    'const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;',
    'export function formatDate(d) { return d.toISOString(); }',
    'const id = "user_1234567890abcdef";',
  ].join('\n');
  for (const pattern of [...VALUE_PATTERNS, ...CLIENT_ONLY_PATTERNS]) {
    pattern.re.lastIndex = 0;
    assert.equal(pattern.re.test(benign), false, `${pattern.name} should not match benign source`);
  }
});

test('NEXT_PUBLIC_ name extraction picks up referenced names', () => {
  const src = 'const url = process.env.NEXT_PUBLIC_API_BASE_URL; const other = process.env.NEXT_PUBLIC_APP_URL;';
  NEXT_PUBLIC_NAME_RE.lastIndex = 0;
  const names = [...src.matchAll(NEXT_PUBLIC_NAME_RE)].map((m) => m[0]);
  assert.deepEqual(names, ['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_APP_URL']);
});

test('rejected-name pattern flags SECRET/SERVICE_ROLE/PRIVATE/TOKEN/PASSWORD regardless of allow-list', () => {
  for (const bad of [
    'NEXT_PUBLIC_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_SECRET',
    'NEXT_PUBLIC_PRIVATE_KEY',
    'NEXT_PUBLIC_AUTH_TOKEN',
    'NEXT_PUBLIC_ADMIN_PASSWORD',
  ]) {
    assert.ok(REJECTED_NAME_RE.test(bad), `${bad} should be rejected by name`);
  }
  assert.equal(REJECTED_NAME_RE.test('NEXT_PUBLIC_API_BASE_URL'), false);
});

test('rejected-name pattern does not flag a public contract "token address"', () => {
  // Common, benign Web3 naming: an ERC-20/staking contract address is a
  // public identifier, not a bearer token — see src/lib/wayz/addresses.ts.
  assert.equal(REJECTED_NAME_RE.test('NEXT_PUBLIC_WAYZ_TOKEN_ADDRESS'), false);
  // But a real bearer-token-shaped name is still caught.
  assert.equal(REJECTED_NAME_RE.test('NEXT_PUBLIC_ACCESS_TOKEN'), true);
});

test('placeholder strings are recognized so they are not reported as findings', () => {
  for (const placeholder of [
    ['gw', '_', 'live', '_', 'YOUR_API_KEY_HERE'].join(''),
    ['sk', '-', 'YOUR_API_KEY_HERE'].join(''),
    ['sk', '_', 'test', '_', 'X'.repeat(20)].join(''),
  ]) {
    assert.ok(PLACEHOLDER_RE.test(placeholder), `expected "${placeholder}" to be recognized as a placeholder`);
  }
  // A real-shaped key (random-looking, no readable placeholder words) is not
  // caught by this exclusion.
  const realShaped = ['gw', '_', 'live', '_', 'aBcDeFgHiJkLmNoPqRsT'].join('');
  assert.equal(PLACEHOLDER_RE.test(realShaped), false);
});

test('openai-style-key does not match mid-word inside a minified Tailwind class name', () => {
  // Real bundle content: Tailwind's `mask-image-linear-from-pos` utility
  // literally contains "sk-image-linear-from-pos" as a substring.
  const tailwindUtility = 'mask-image-linear-from-pos';
  const pattern = findPattern('openai-style-key');
  assert.equal(matches(pattern, tailwindUtility), false);
  // But a real key at the start of a string (or after a quote/space) still matches.
  const realKey = ['"', 'sk', '-', 'aBcDeFgHiJkLmNoPqRsTuVwXyZ12', '"'].join('');
  assert.ok(matches(pattern, realKey));
});

test('privy JSON-RPC method names are recognized as false positives, not secrets', () => {
  // Privy's wallet API uses "privy_" as its own JSON-RPC method namespace
  // (privy_signSmartAccountTransaction, privy_signTypedData, ...) — the
  // regex alone matches these (it can't tell prefix from secret), so the
  // scanner additionally requires a digit for this identifier-collision-prone
  // pattern.
  const rpcMethodName = 'privy_signSmartAccountTransaction';
  assert.ok(matches(findPattern('privy-secret'), rpcMethodName), 'regex matches the shape');
  const wouldBeSuppressed = IDENTIFIER_COLLISION_PRONE.has('privy-secret') && !DIGIT_RE.test(rpcMethodName);
  assert.ok(wouldBeSuppressed, 'the no-digit heuristic should suppress this as a false positive');

  // A real secret (near-certain to contain a digit somewhere in 20+ random
  // chars) is not suppressed.
  const realSecret = ['privy', '_', 'aBcDeFgHiJkLmNoPqRsTuVwX12'].join('');
  const realWouldBeSuppressed = IDENTIFIER_COLLISION_PRONE.has('privy-secret') && !DIGIT_RE.test(realSecret);
  assert.equal(realWouldBeSuppressed, false);
});
