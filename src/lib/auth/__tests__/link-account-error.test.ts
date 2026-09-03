import { describeLinkAccountError } from '../link-account-error';

describe('describeLinkAccountError', () => {
  it('returns null for the user closing the link modal themselves', () => {
    expect(describeLinkAccountError('exited_link_flow')).toBeNull();
  });

  it('returns null for an OAuth denial (also a user-initiated cancel)', () => {
    expect(describeLinkAccountError('oauth_user_denied')).toBeNull();
  });

  it('describes an account already linked to a different Privy user', () => {
    expect(describeLinkAccountError('linked_to_another_user')).toMatch(/already linked/i);
  });

  it('describes trying to link a second account of an already-linked type', () => {
    expect(describeLinkAccountError('cannot_link_more_of_type')).toMatch(/already linked/i);
  });

  it('falls back to a generic message for unrecognized/unknown error codes', () => {
    expect(describeLinkAccountError('unknown_auth_error')).toBe(
      'Something went wrong linking your account. Please try again.'
    );
    expect(describeLinkAccountError('some_future_privy_error_code')).toBe(
      'Something went wrong linking your account. Please try again.'
    );
  });
});
