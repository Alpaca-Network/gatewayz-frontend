import { PrivyProvider } from '@privy-io/react-auth';

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    appearance: {
      theme: 'light',
      accentColor: '#000000',
      logo: '/logo_black.svg',
    },
    // Configure login methods
    loginMethods: ['email', 'google', 'github'],
    // Enable email verification with code delivery
    email: {
      verifyEmailOnSignup: true,
    },
  },
};

export { PrivyProvider };

