# 🧪 Local Testing Guide

This guide will help you test the Gatewayz chat functionality locally.

## Prerequisites

- Server running on `http://localhost:3000` (use PM2 as instructed)
- A valid Gatewayz API key

## Option 1: Get an API Key (Recommended)

### Method A: Sign Up on Beta Site

1. Visit https://beta.gatewayz.ai
2. Sign up using one of these methods:
   - Email/Password
   - Google OAuth
   - GitHub OAuth
   - Wallet Connection
3. After signing up, go to Settings → API Keys
4. Copy your API key (starts with `gw_`)

### Method B: Use Test Auth Setup Page

1. Open http://localhost:3000/dev/test-auth.html in your browser
2. If you have an existing API key:
   - Enter your API key
   - Fill in the user details
   - Click "Setup Test User"
3. The page will configure your browser's localStorage with the credentials

## Option 2: Manual localStorage Setup

If you already have an API key, you can set it up manually in your browser console:

```javascript
// Open browser console (F12) on http://localhost:3000
// Replace with your actual API key and details

localStorage.setItem('gatewayz_api_key', 'gw_your_actual_api_key_here');

localStorage.setItem('gatewayz_user_data', JSON.stringify({
  user_id: 1,
  api_key: 'gw_your_actual_api_key_here',
  auth_method: 'email',
  privy_user_id: 'test-user',
  display_name: 'Test User',
  email: 'test@example.com',
  credits: 100,
  tier: 'basic',
  tier_display_name: 'Basic'
}));

// Refresh the page
location.reload();
```

## Testing the Chat

Once you have set up authentication:

1. **Open Chat Interface**
   ```
   http://localhost:3000/chat
   ```

2. **Test with API directly**
   ```bash
   curl -X POST http://localhost:3000/api/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [{"role": "user", "content": "Hello!"}],
       "max_tokens": 50
     }'
   ```

3. **Test with a Free Model** (recommended for testing)
   ```bash
   curl -X POST http://localhost:3000/api/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{
       "model": "Qwen: Qwen2 72B A16B 2507",
       "messages": [{"role": "user", "content": "Hello! Tell me a joke."}],
       "max_tokens": 100
     }'
   ```

## Verifying Setup

### Check Current Auth Status

Open browser console on http://localhost:3000 and run:

```javascript
// Check if API key is set
console.log('API Key:', localStorage.getItem('gatewayz_api_key'));

// Check user data
console.log('User Data:', JSON.parse(localStorage.getItem('gatewayz_user_data') || '{}'));
```

### Expected Response Format

A successful chat completion will return:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

## Common Issues

### Issue: "API key required" Error

**Solution:** Make sure your API key is:
- Set in localStorage OR
- Included in the Authorization header
- Valid and not expired

### Issue: "Network connection failed"

**Solution:**
- Check that the backend API is accessible
- Verify your internet connection
- Check PM2 logs: `pm2 logs gatewayz-frontend`

### Issue: Chat page shows login screen

**Solution:**
- Open http://localhost:3000/dev/test-auth.html
- Set up your API key
- Refresh the chat page

## Available Free Models for Testing

Here are some free models you can use for testing:

1. **Qwen2 72B** (Recommended)
   - Model ID: `Qwen: Qwen2 72B A16B 2507`
   - Good for: General chat, coding, reasoning

2. **Meta Llama 3.1 8B**
   - Model ID: `Meta Llama 3.1 8B`
   - Good for: Fast responses, simple tasks

3. **Mistral 7B**
   - Model ID: `Mistral 7B Instruct`
   - Good for: Instruction following

## Clearing Test Data

To reset your test setup:

1. **Using Test Page:**
   - Visit http://localhost:3000/dev/test-auth.html
   - Click "Clear Auth Data"

2. **Using Browser Console:**
   ```javascript
   // Remove all gatewayz data
   Object.keys(localStorage)
     .filter(k => k.startsWith('gatewayz_'))
     .forEach(k => localStorage.removeItem(k));

   location.reload();
   ```

## Server Management

### View Logs
```bash
# Live logs
pm2 logs gatewayz-frontend

# Last 50 lines
pm2 logs gatewayz-frontend --lines 50 --nostream

# Error logs only
pm2 logs gatewayz-frontend --err
```

### Restart Server
```bash
pm2 restart gatewayz-frontend
```

### Check Status
```bash
pm2 status
```

## Need Help?

1. Check the server logs: `pm2 logs gatewayz-frontend`
2. Verify your API key is valid
3. Ensure the server is running: `pm2 status`
4. Test the API endpoint directly with curl

## Production Notes

⚠️ **Important:** This setup is for LOCAL DEVELOPMENT ONLY. Never commit real API keys to version control.

For production deployment, use proper environment variables and the official authentication flow through Privy.
