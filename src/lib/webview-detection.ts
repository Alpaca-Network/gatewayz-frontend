/**
 * WebView Detection Utility
 * 
 * Detects restricted WebView environments where embedded wallet functionality
 * may not work properly due to:
 * - Popup/iframe restrictions
 * - Limited Web3 support
 * - Connector initialization timeouts
 * 
 * These environments include in-app browsers from social media apps.
 */

/**
 * Detects if the current browser is a restricted WebView environment.
 * 
 * Restricted WebViews include:
 * - iOS/Android Twitter in-app browser
 * - Facebook in-app browser (FBAN/FBAV)
 * - Instagram in-app browser
 * - LinkedIn in-app browser
 * - TikTok in-app browser
 * - Snapchat in-app browser
 * - Line in-app browser
 * - Other social media in-app browsers
 * 
 * @returns true if running in a restricted WebView environment
 */
export function isRestrictedWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const ua = userAgent.toLowerCase();

  // Twitter/X in-app browser
  // User agents contain "Twitter" or the app identifier
  const isTwitterWebView = 
    ua.includes('twitter') ||
    /\btwitter\b/i.test(userAgent);

  // Facebook in-app browser
  // Contains FBAN (Facebook App Name) or FBAV (Facebook App Version)
  const isFacebookWebView = 
    ua.includes('fban') || 
    ua.includes('fbav') ||
    /\bfb_iab\b/i.test(userAgent) ||
    /\bfbios\b/i.test(userAgent);

  // Instagram in-app browser
  const isInstagramWebView = 
    ua.includes('instagram') ||
    /\binstagram\b/i.test(userAgent);

  // LinkedIn in-app browser
  const isLinkedInWebView = 
    ua.includes('linkedinapp') ||
    /\blinkedin\b/i.test(userAgent);

  // TikTok in-app browser
  const isTikTokWebView = 
    ua.includes('tiktok') ||
    ua.includes('bytedance') ||
    /\btiktok\b/i.test(userAgent);

  // Snapchat in-app browser
  const isSnapchatWebView = 
    ua.includes('snapchat') ||
    /\bsnapchat\b/i.test(userAgent);

  // Line in-app browser
  const isLineWebView = 
    ua.includes(' line/') ||
    /\bline\b/i.test(userAgent);

  // WeChat in-app browser
  const isWeChatWebView = 
    ua.includes('micromessenger') ||
    ua.includes('wechat');

  // Generic WebView detection for iOS and Android
  // iOS: WebView has no Safari identifier but has "AppleWebKit"
  // Android: WebView has "wv" in user agent
  const isGenericIOSWebView = 
    ua.includes('iphone') && 
    !ua.includes('safari') && 
    ua.includes('applewebkit');

  const isGenericAndroidWebView = 
    ua.includes('android') && 
    ua.includes('wv');

  return (
    isTwitterWebView ||
    isFacebookWebView ||
    isInstagramWebView ||
    isLinkedInWebView ||
    isTikTokWebView ||
    isSnapchatWebView ||
    isLineWebView ||
    isWeChatWebView ||
    isGenericIOSWebView ||
    isGenericAndroidWebView
  );
}

/**
 * Detects if the current browser supports embedded wallets properly.
 * 
 * Returns false for environments where embedded wallet initialization
 * is known to fail, such as restricted WebViews.
 * 
 * @returns true if embedded wallets are supported
 */
export function supportsEmbeddedWallets(): boolean {
  // In restricted WebViews, embedded wallets don't work properly
  if (isRestrictedWebView()) {
    return false;
  }

  // Check if we're in an environment that supports iframes properly
  // Some WebViews block third-party iframes which are required for embedded wallets
  if (typeof window === 'undefined') {
    return false;
  }

  return true;
}

/**
 * Gets detailed information about the current WebView environment.
 * Useful for debugging and logging.
 * 
 * @returns Object with WebView detection details
 */
export function getWebViewInfo(): {
  isRestrictedWebView: boolean;
  supportsEmbeddedWallets: boolean;
  detectedPlatform: string | null;
  userAgent: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isRestrictedWebView: false,
      supportsEmbeddedWallets: false,
      detectedPlatform: null,
      userAgent: '',
    };
  }

  const userAgent = navigator.userAgent || '';
  const ua = userAgent.toLowerCase();

  let detectedPlatform: string | null = null;

  if (ua.includes('twitter') || /\btwitter\b/i.test(userAgent)) {
    detectedPlatform = 'Twitter';
  } else if (ua.includes('fban') || ua.includes('fbav') || /\bfb_iab\b/i.test(userAgent)) {
    detectedPlatform = 'Facebook';
  } else if (ua.includes('instagram')) {
    detectedPlatform = 'Instagram';
  } else if (ua.includes('linkedinapp')) {
    detectedPlatform = 'LinkedIn';
  } else if (ua.includes('tiktok') || ua.includes('bytedance')) {
    detectedPlatform = 'TikTok';
  } else if (ua.includes('snapchat')) {
    detectedPlatform = 'Snapchat';
  } else if (ua.includes(' line/')) {
    detectedPlatform = 'Line';
  } else if (ua.includes('micromessenger') || ua.includes('wechat')) {
    detectedPlatform = 'WeChat';
  } else if (ua.includes('iphone') && !ua.includes('safari') && ua.includes('applewebkit')) {
    detectedPlatform = 'iOS WebView';
  } else if (ua.includes('android') && ua.includes('wv')) {
    detectedPlatform = 'Android WebView';
  }

  return {
    isRestrictedWebView: isRestrictedWebView(),
    supportsEmbeddedWallets: supportsEmbeddedWallets(),
    detectedPlatform,
    userAgent,
  };
}
