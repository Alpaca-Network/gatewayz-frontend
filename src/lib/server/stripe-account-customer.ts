import type Stripe from 'stripe';
import type { AuthenticatedAccount } from '@/app/api/middleware/auth';

/**
 * Finds the Stripe customer that belongs to a signed-in Gatewayz account.
 *
 * 1. If the backend reports the account's `stripe_customer_id`, that customer
 *    is used (by id) and nothing is looked up by email.
 * 2. Otherwise customers with the account email are listed, and only one whose
 *    `metadata.user_id` equals the account's user id is accepted. The backend
 *    sets that metadata when it creates a customer. A customer that merely
 *    shares the email (another account that used to have it, a customer from
 *    another integration) is never returned.
 *
 * Returns null when no customer belongs to the account.
 */
export async function findAccountStripeCustomer(
  stripe: Stripe,
  account: AuthenticatedAccount
): Promise<Stripe.Customer | null> {
  if (account.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(account.stripeCustomerId);
      if ('deleted' in customer && customer.deleted) {
        return null;
      }
      return customer as Stripe.Customer;
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  const customers = await stripe.customers.list({ email: account.email, limit: 10 });
  const owned = customers.data.find((c) => c.metadata?.user_id === account.userId);
  if (!owned && customers.data.length > 0) {
    // No ids or emails in the log line
    console.warn('[stripe] Email matched customers, none bound to this account; refusing', {
      matches: customers.data.length,
    });
  }
  return owned ?? null;
}
