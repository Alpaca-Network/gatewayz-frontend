import { isRestrictedCountry, shouldBlockStakePath } from '../region';

describe('shouldBlockStakePath (middleware)', () => {
  it.each(['/stake', '/stake/ada', '/stake/eth'])('blocks %s from the US and Canada', (path) => {
    expect(shouldBlockStakePath(path, 'US')).toBe(true);
    expect(shouldBlockStakePath(path, 'CA')).toBe(true);
  });

  it('keeps the terms and the unavailable page readable', () => {
    expect(shouldBlockStakePath('/stake/terms', 'US')).toBe(false);
    expect(shouldBlockStakePath('/stake/unavailable', 'CA')).toBe(false);
  });

  it('never rewrites /rewards or lookalike paths', () => {
    expect(shouldBlockStakePath('/rewards', 'US')).toBe(false);
    expect(shouldBlockStakePath('/staked', 'US')).toBe(false);
  });

  it.each(['FR', '', null, undefined])('lets %p through', (country) => {
    expect(shouldBlockStakePath('/stake', country)).toBe(false);
  });
});

describe('isRestrictedCountry', () => {
  it.each(['US', 'CA', 'us', ' ca '])('blocks %p', (country) => {
    expect(isRestrictedCountry(country)).toBe(true);
  });

  it.each(['FR', 'MX', 'GB', '', null, undefined])('allows %p (unknown is allowed)', (country) => {
    expect(isRestrictedCountry(country)).toBe(false);
  });
});
