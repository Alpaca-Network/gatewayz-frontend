# Google Analytics & Google Ads Tracking - Usage Guide

## 📊 What's Implemented

✅ **Google Analytics 4 (GA4)** - ID: `G-NCWGNQ7981`
✅ **Google Ads Conversion Tracking** - ID: `AW-17515449277`
✅ **Cross-Domain Tracking** between `gatewayz.ai` and `beta.gatewayz.ai`

## 🚀 How It Works

The tracking is automatically set up in your app. It will:
- ✅ Track all page views automatically
- ✅ Maintain user sessions across domains
- ✅ Track conversions from Google Ads campaigns
- ✅ Collect user behavior data

## 📈 How to Track Custom Events

### 1. Import the tracking function

```tsx
import { trackEvent } from '@/components/analytics/google-analytics';
```

### 2. Track button clicks

```tsx
<Button onClick={() => {
  trackEvent('button_click', {
    button_name: 'sign_up',
    location: 'hero_section'
  });
}}>
  Sign Up
</Button>
```

### 3. Track form submissions

```tsx
const handleFormSubmit = (data) => {
  trackEvent('form_submission', {
    form_name: 'contact_form',
    form_location: 'footer',
    success: true
  });
};
```

### 4. Track API calls

```tsx
const handleApiCall = async () => {
  try {
    const response = await fetch('/api/models');

    trackEvent('api_call_success', {
      endpoint: '/api/models',
      method: 'GET',
      status: response.status
    });
  } catch (error) {
    trackEvent('api_call_error', {
      endpoint: '/api/models',
      error: error.message
    });
  }
};
```

### 5. Track conversions (sign-ups, purchases, etc.)

```tsx
import { trackConversion } from '@/components/analytics/google-analytics';

const handleSignUp = async (email) => {
  await createAccount(email);

  // Track conversion
  trackConversion('AW-17515449277/xxx', 0, 'USD');

  // Also track as a custom event
  trackEvent('sign_up_completed', {
    method: 'email',
    source: 'homepage'
  });
};
```

## 🎯 Common Event Examples

### Track video plays
```tsx
trackEvent('video_play', {
  video_title: 'Product Demo',
  video_duration: 120,
  video_position: 'hero_section'
});
```

### Track feature usage
```tsx
trackEvent('feature_used', {
  feature_name: 'chat',
  model: 'gpt-4',
  credits_used: 100
});
```

### Track navigation
```tsx
trackEvent('navigation_click', {
  link_text: 'Documentation',
  link_url: '/docs',
  section: 'header'
});
```

### Track search
```tsx
trackEvent('search', {
  search_term: 'gpt-4',
  results_count: 15,
  search_location: 'models_page'
});
```

### Track errors
```tsx
trackEvent('error_occurred', {
  error_type: 'api_error',
  error_message: 'Rate limit exceeded',
  page: window.location.pathname
});
```

## 🔍 View Your Data

### Google Analytics 4
1. Go to: https://analytics.google.com
2. Select property: `G-NCWGNQ7981`
3. View:
   - **Realtime** → See live users
   - **Reports** → See detailed analytics
   - **Explore** → Create custom reports

### Google Ads
1. Go to: https://ads.google.com
2. Select account: `AW-17515449277`
3. View:
   - **Campaigns** → Ad performance
   - **Conversions** → Track sign-ups, purchases
   - **Attribution** → See which ads drive conversions

## 🔐 Privacy & GDPR

The tracking respects user privacy:
- ✅ No PII (Personally Identifiable Information) is tracked by default
- ✅ IP addresses are anonymized
- ✅ Users can opt-out via browser settings or Do Not Track
- ⚠️ Consider adding a cookie consent banner for EU users

## 🧪 Testing

### Check if tracking is working:

1. **Open browser console** (F12)
2. **Run this command:**
   ```javascript
   window.gtag('event', 'test_event', { test: true });
   ```
3. **Check in GA4 Realtime:**
   - Go to Google Analytics
   - Click "Realtime"
   - You should see your test event within 30 seconds

### Check cross-domain tracking:

1. Navigate from `beta.gatewayz.ai` to `gatewayz.ai`
2. Look for `_gl=` parameter in the URL
3. Session should be maintained across domains

## 📱 Event Naming Best Practices

✅ **Good:** `button_click`, `form_submission`, `video_play`
❌ **Bad:** `btn_clk`, `formSub`, `videoPlay`

- Use lowercase with underscores
- Be descriptive and consistent
- Group related events with prefixes (e.g., `checkout_started`, `checkout_completed`)

## 🎨 Example: Track Complete User Journey

```tsx
// 1. User lands on homepage
useEffect(() => {
  trackEvent('page_view', { page: 'homepage' });
}, []);

// 2. User watches demo video
<Button onClick={() => {
  trackEvent('video_play', { video: 'demo' });
}}>
  Watch Demo
</Button>

// 3. User signs up
const handleSignUp = async () => {
  await createAccount();
  trackEvent('sign_up_completed', { method: 'email' });
  trackConversion('AW-17515449277/xxx');
};

// 4. User makes first API call
const handleFirstApiCall = async () => {
  const response = await callApi();
  trackEvent('first_api_call', { model: 'gpt-4' });
};
```

## 🚨 Important Notes

1. **Don't track sensitive data** (passwords, credit cards, etc.)
2. **Test in development** but data won't appear in production GA4
3. **Be consistent** with event naming across your app
4. **Document custom events** so your team knows what's being tracked

## 🤝 Need Help?

- GA4 Documentation: https://support.google.com/analytics/answer/9304153
- Google Ads Help: https://support.google.com/google-ads
- Contact your analytics team for custom reporting
