import { formatHeartbeatAge, describeNodeStatus } from '../format';

describe('gpu/format', () => {
  describe('formatHeartbeatAge', () => {
    it('returns "never" for null', () => {
      expect(formatHeartbeatAge(null)).toBe('never');
    });

    it('returns a relative-time string for an ISO timestamp', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatHeartbeatAge(fiveMinAgo)).toMatch(/ago/);
    });

    it('degrades to "unknown" on an unparseable value', () => {
      expect(formatHeartbeatAge('not-a-date')).toBe('unknown');
    });
  });

  describe('describeNodeStatus', () => {
    it.each([
      ['registered', 'Registered'],
      ['active', 'Active'],
      ['degraded', 'Degraded'],
      ['offline', 'Offline'],
      ['disabled', 'Disabled'],
    ])('labels %s as %s', (status, label) => {
      expect(describeNodeStatus(status as never)).toBe(label);
    });
  });
});
