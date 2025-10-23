# Google Cloud Service Account Selection Guide

## Which Service Account Should I Use?

You have 4 service accounts available. Here's how to choose the right one:

## 🔍 How to Check Service Accounts

### Option 1: Using gcloud CLI
```bash
gcloud iam service-accounts list --project=gatewayz-468519
```

This will show:
- **Email** (e.g., `vertex-ai-sa@gatewayz-468519.iam.gserviceaccount.com`)
- **Display Name** (e.g., "Vertex AI Service Account")
- **Disabled** status

### Option 2: Using Google Cloud Console
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=gatewayz-468519
2. Look at the list of 4 service accounts
3. Check each one's:
   - **Name/Description**
   - **Email address**
   - **Roles** (click on it to see permissions)

## 📋 What to Look For

### ✅ GOOD Service Account (Use This)

A service account with:
- ✅ **Vertex AI User** role (or Vertex AI Admin)
- ✅ **Enabled** status (not disabled)
- ✅ Name suggests AI/Vertex/ML usage
- ✅ Recently created or actively used

Examples:
- `vertex-ai-service@gatewayz-468519.iam.gserviceaccount.com`
- `ml-service@gatewayz-468519.iam.gserviceaccount.com`
- `ai-gateway@gatewayz-468519.iam.gserviceaccount.com`
- `compute@developer.gserviceaccount.com` (if it has Vertex AI role)

### ❌ AVOID These Service Accounts

- ❌ **Disabled** accounts
- ❌ Accounts without Vertex AI permissions
- ❌ Default compute engine service account (unless it has proper roles)
- ❌ Accounts for specific other services (Firebase, Cloud Build, etc.)

## 🎯 Recommended Approach

### Check Each Service Account's Roles

For each of the 4 service accounts, check what roles they have:

```bash
# Replace with actual service account email
gcloud projects get-iam-policy gatewayz-468519 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:SERVICE_ACCOUNT_EMAIL"
```

Look for these roles:
- ✅ `roles/aiplatform.user` (Vertex AI User) - **PERFECT**
- ✅ `roles/aiplatform.admin` (Vertex AI Admin) - **WORKS**
- ✅ `roles/ml.admin` (ML Engine Admin) - **WORKS**
- ⚠️ `roles/editor` (Editor) - **TOO BROAD, but works**
- ⚠️ `roles/owner` (Owner) - **TOO BROAD, but works**

## 🆕 Or Create a New Service Account (Recommended)

If none of the 4 accounts are suitable, create a dedicated one:

```bash
# 1. Create service account
gcloud iam service-accounts create vertex-ai-gateway \
  --display-name="Vertex AI Gateway Service Account" \
  --project=gatewayz-468519

# 2. Grant Vertex AI User role
gcloud projects add-iam-policy-binding gatewayz-468519 \
  --member="serviceAccount:vertex-ai-gateway@gatewayz-468519.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# 3. Create and download key
gcloud iam service-accounts keys create vertex-ai-key.json \
  --iam-account=vertex-ai-gateway@gatewayz-468519.iam.gserviceaccount.com
```

## 📝 Service Account Types You Might See

### 1. **Default Compute Engine Service Account**
- Email: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
- Purpose: Automatically created for Compute Engine
- **Use if:** It has Vertex AI User role
- **Don't use if:** You want least-privilege security

### 2. **App Engine Default Service Account**
- Email: `PROJECT_ID@appspot.gserviceaccount.com`
- Purpose: For App Engine applications
- **Use if:** It has Vertex AI User role
- **Better:** Create dedicated SA

### 3. **Custom Service Accounts**
- Email: `custom-name@PROJECT_ID.iam.gserviceaccount.com`
- Purpose: Created for specific purposes
- **Use if:** It's for Vertex AI / ML workloads

### 4. **Firebase Service Accounts**
- Email: Contains "firebase" in name
- Purpose: Firebase operations
- **Don't use:** Not for Vertex AI

## 🔐 How to Get the JSON Key

Once you've identified the right service account:

### Using Cloud Console (Easiest)
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=gatewayz-468519
2. Click on the service account email
3. Go to **"KEYS"** tab
4. Click **"ADD KEY"** → **"Create new key"**
5. Select **JSON** format
6. Click **"CREATE"**
7. The key will download automatically

### Using gcloud CLI
```bash
gcloud iam service-accounts keys create vertex-ai-key.json \
  --iam-account=SERVICE_ACCOUNT_EMAIL@gatewayz-468519.iam.gserviceaccount.com
```

## 🎯 Decision Flow Chart

```
Do any of the 4 accounts have "Vertex AI User" role?
│
├─ YES → Use that one! ✅
│         Get its JSON key and proceed
│
└─ NO → Check if any have "Editor" or "Owner" role?
    │
    ├─ YES → Use it (but consider creating dedicated SA for security)
    │         Get its JSON key and proceed
    │
    └─ NO → Create a new service account with Vertex AI User role
              Get its JSON key and proceed
```

## 📋 Quick Checklist

To verify the service account will work:

```bash
# 1. Set the service account email
SA_EMAIL="your-sa@gatewayz-468519.iam.gserviceaccount.com"

# 2. Check it exists
gcloud iam service-accounts describe $SA_EMAIL

# 3. Check its roles
gcloud projects get-iam-policy gatewayz-468519 \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$SA_EMAIL"

# 4. Test access to Vertex AI
gcloud ai endpoints list --region=us-central1 --project=gatewayz-468519 \
  --impersonate-service-account=$SA_EMAIL
```

If step 4 works without errors, that service account is perfect!

## 💡 My Recommendation

**Share the 4 service account emails/names with me, and I can tell you which one to use!**

Or look for one with:
1. Name suggesting ML/AI/Vertex usage
2. Has "Vertex AI User" role
3. Is not disabled

Example names to look for:
- `vertex-ai-*`
- `ml-*`
- `ai-gateway-*`
- `stable-diffusion-*`
- Any custom name you recognize

## 🚨 Security Best Practice

**Don't use:**
- Default service accounts with broad permissions
- Accounts with Owner/Editor roles (unless necessary)

**Do use:**
- Dedicated service account with only Vertex AI User role
- Least privilege principle

## ❓ Still Not Sure?

Share with me:
1. The email addresses of the 4 service accounts
2. Or the "Display Name" of each account

I'll tell you which one to use!

## 🔗 Useful Links

- [Service Accounts in Google Cloud](https://console.cloud.google.com/iam-admin/serviceaccounts?project=gatewayz-468519)
- [Vertex AI IAM Roles](https://cloud.google.com/vertex-ai/docs/general/access-control)
- [Creating Service Accounts](https://cloud.google.com/iam/docs/creating-managing-service-accounts)
