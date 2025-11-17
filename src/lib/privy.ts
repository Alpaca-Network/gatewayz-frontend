import { PrivyProvider } from '@privy-io/react-auth';

export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  config: {
    appearance: {
      theme: 'light',
      accentColor: '#000000',
      logo: '/logo_black.svg',
    },
    // Configure login methods - email verification is handled automatically by Privy
    loginMethods: ['email', 'google', 'github'],
  },
};

export { PrivyProvider };

