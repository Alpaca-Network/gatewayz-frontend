import {
  accountLabel,
  confirmAccountSwitch,
  getSessionTransferCode,
  redeemSessionTransferCode,
} from '../session-transfer-code';
import { API_BASE_URL } from '@/lib/config';

describe('session-transfer-code', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('getSessionTransferCode', () => {
    it('reads ?code= from the URL', () => {
      window.history.replaceState({}, '', '/?code=abc123');
      expect(getSessionTransferCode()).toBe('abc123');
      window.history.replaceState({}, '', '/');
      expect(getSessionTransferCode()).toBeNull();
    });
  });

  describe('redeemSessionTransferCode', () => {
    it('POSTs the code to the backend and returns the session', async () => {
      const session = { api_key: 'gw_live_k', user_id: 3, email: 'a@b.c' };
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => session });

      const result = await redeemSessionTransferCode('the-code');

      expect(result).toEqual({ status: 'ok', session });
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/auth/transfer-code/redeem`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ code: 'the-code' });
      expect(init.credentials).toBe('omit');
    });

    it.each([400, 422])('maps %s to invalid', async (status) => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status, json: async () => ({}) });
      expect(await redeemSessionTransferCode('c')).toEqual({ status: 'invalid' });
    });

    it.each([404, 429, 500, 503])('maps %s to unavailable and warns', async (status) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status, json: async () => ({}) });
      expect(await redeemSessionTransferCode('c')).toEqual({ status: 'unavailable' });
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('maps network errors to unavailable without logging the code', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
      expect(await redeemSessionTransferCode('secret-code-value')).toEqual({ status: 'unavailable' });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-code-value');
      warn.mockRestore();
    });

    it('treats a response without a key as invalid', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation();
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ user_id: 1 }) });
      expect(await redeemSessionTransferCode('c')).toEqual({ status: 'invalid' });
      warn.mockRestore();
    });
  });

  describe('confirmAccountSwitch', () => {
    it('returns the answer from window.confirm', () => {
      const spy = jest.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
      expect(confirmAccountSwitch('Switch?')).toBe(true);
      expect(confirmAccountSwitch('Switch?')).toBe(false);
      expect(spy).toHaveBeenCalledWith('Switch?');
      spy.mockRestore();
    });

    it('fails closed if confirm throws', () => {
      const spy = jest.spyOn(window, 'confirm').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(confirmAccountSwitch('Switch?')).toBe(false);
      spy.mockRestore();
    });
  });

  describe('accountLabel', () => {
    it('prefers email, then name, then id', () => {
      expect(accountLabel({ email: 'e@x.y', display_name: 'N', user_id: 1 })).toBe('e@x.y');
      expect(accountLabel({ display_name: 'N', user_id: 1 })).toBe('N');
      expect(accountLabel({ user_id: 1 })).toBe('user 1');
      expect(accountLabel(null)).toBe('another account');
    });
  });
});
