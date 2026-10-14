import {
  ATTESTATION_STORAGE_KEY,
  GEO_COOKIE,
  countryFromCookie,
  hasAttested,
  isDelegationRegionBlocked,
  isRestrictedCountry,
  recordAttestation,
  shouldBlockStakePath,
} from '../region';

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

describe('countryFromCookie', () => {
  it('reads the geo cookie among others', () => {
    expect(countryFromCookie(`a=1; ${GEO_COOKIE}=CA; b=2`)).toBe('CA');
  });

  it('returns null when absent or empty', () => {
    expect(countryFromCookie('a=1')).toBeNull();
    expect(countryFromCookie(`${GEO_COOKIE}=`)).toBeNull();
  });
});

describe('isDelegationRegionBlocked', () => {
  afterEach(() => {
    document.cookie = `${GEO_COOKIE}=; path=/`;
  });

  it('follows the cookie the middleware set', () => {
    document.cookie = `${GEO_COOKIE}=US; path=/`;
    expect(isDelegationRegionBlocked()).toBe(true);
    document.cookie = `${GEO_COOKIE}=DE; path=/`;
    expect(isDelegationRegionBlocked()).toBe(false);
  });
});

describe('attestation storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('records and reads acceptance', () => {
    expect(hasAttested()).toBe(false);
    recordAttestation();
    expect(window.localStorage.getItem(ATTESTATION_STORAGE_KEY)).toBe('true');
    expect(hasAttested()).toBe(true);
  });

  it('treats blocked storage as not attested and does not throw', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasAttested()).toBe(false);
    expect(() => recordAttestation()).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
