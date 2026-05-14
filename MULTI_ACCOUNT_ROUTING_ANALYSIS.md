# Multi-Account Routing Architecture Analysis

**Repository**: claude-code-router  
**Date**: 2026-05-13  
**Original Source**: ai-router (merged and migrated)

---

## Executive Summary

Claude Code Router implements intelligent multi-account routing that allows users to configure multiple API keys/accounts per provider. When one account reaches rate limits or exhaustion, the system automatically rotates to the next available account. This document explains how accounts are stored, selected, configured, and managed throughout a request lifecycle.

---

## 1. Data Models

### 1.1 ProviderAccount Interface

**File**: [packages/core/src/types/llm.ts](packages/core/src/types/llm.ts#L201)

```typescript
export interface ProviderAccount {
  id?: string;                                    // For Cloudflare account IDs or similar
  key: string;                                    // The API Key
  email?: string;                                 // Email tracking
  label?: string;                                 // e.g., "account_1"
  status?: 'active' | 'exhausted' | 'rate_limited';  // Account status
}
```

**Usage**:
- `id`: Provider-specific account identifier (e.g., Cloudflare account_id)
- `key`: The actual API key/token for authentication
- `email`: Used for tracking usage, notifications, and account identification
- `label`: Human-readable name for UI display
- `status`: Runtime state updated when account is detected as exhausted

### 1.2 LLMProvider Interface

**File**: [packages/core/src/types/llm.ts](packages/core/src/types/llm.ts#L209)

```typescript
export interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;                                // Deprecated - use accounts[0].key for backwards compatibility
  accounts?: ProviderAccount[];                   // New multi-account support
  models: string[];
  dynamicDiscoveryUrl?: string;                   // URL for fetching models dynamically
  transformer?: {
    [key: string]: {
      use?: Transformer[];
    };
  } & {
    use?: Transformer[];
  };
}
```

**Key Features**:
- **Backward Compatibility**: `apiKey` field still supported (converted to single-account)
- **Multi-Account**: `accounts` array replaces single API key
- **Dynamic Discovery**: Optional endpoint to fetch available models
- **Transformers**: Per-provider and per-model request/response transformation

### 1.3 ConfigProvider Interface

**File**: [packages/core/src/types/llm.ts](packages/core/src/types/llm.ts#L243)

```typescript
export interface ConfigProvider {
  name: string;
  api_base_url: string;
  api_key?: string;                               // Deprecated - use accounts for multi-account
  accounts?: Array<{
    id?: string;
    key: string;
    email?: string;
    label?: string;
  }>;
  models: string[];
  transformer: {
    use?: string[] | Array<any>[];
  } & {
    [key: string]: {
      use?: string[] | Array<any>[];
    };
  };
  tokenizer?: ProviderTokenizerConfig;
  dynamic_discovery_url?: string;                 // URL for dynamic model discovery
}
```

---

## 2. Account Selection Logic

### 2.1 Account Loading & Conversion

**File**: [packages/core/src/services/provider.ts](packages/core/src/services/provider.ts#L55-L99)

```typescript
// Convert accounts config to ProviderAccount format
let accounts: any[] = [];
if (providerConfig.accounts && Array.isArray(providerConfig.accounts)) {
  accounts = providerConfig.accounts.map((acc: any) => ({
    id: acc.id,
    key: acc.key,
    email: acc.email,
    label: acc.label,
    status: 'active' as const,
  }));
} else if (providerConfig.api_key) {
  // Legacy: convert single api_key to accounts array
  accounts = [{
    key: providerConfig.api_key,
    status: 'active' as const,
  }];
}

this.registerProvider({
  name: providerConfig.name,
  baseUrl: providerConfig.api_base_url,
  apiKey: providerConfig.api_key, // Keep for backwards compatibility
  accounts: accounts,
  models: providerConfig.models || [],
  dynamicDiscoveryUrl: providerConfig.dynamic_discovery_url,
  transformer: providerConfig.transformer ? transformer : undefined,
});
```

### 2.2 Key Rotation & Account Selection

**File**: [packages/core/src/api/routes.ts](packages/core/src/api/routes.ts#L304-L430)

The core account selection happens in `sendRequestToProvider()`:

```typescript
async function sendRequestToProvider(
  requestBody: any,
  config: any,
  provider: any,
  fastify: FastifyInstance,
  bypass: boolean,
  transformer: any,
  context: any
) {
  // ... initialization ...

  // Step 1: Get accounts array from provider
  const accounts = provider.accounts || (provider.apiKey ? [{ key: provider.apiKey }] : []);
  if (!accounts || accounts.length === 0) {
    throw createApiError(
      `No API keys configured for provider ${provider.name}`,
      500,
      "no_api_keys"
    );
  }

  let lastError: any = null;
  const attemptedAccounts = new Set<string>();

  // Step 2: Iterate through accounts, trying each one
  for (const account of accounts) {
    const accountIdentifier = account.email || account.label || account.key?.substring(0, 8) || 'unknown';
    
    // Step 3: Check if account is already exhausted
    const usageKey = account.email || account.key;
    if (fastify.usageService?.isExhausted(usageKey)) {
      fastify.log.warn(`[Router] Skipping exhausted account: ${accountIdentifier}`);
      continue;
    }

    if (account.status === 'exhausted') {
      fastify.log.warn(`[Router] Skipping marked exhausted account: ${accountIdentifier}`);
      continue;
    }

    if (attemptedAccounts.has(accountIdentifier)) {
      continue; // Skip duplicates
    }
    attemptedAccounts.add(accountIdentifier);

    try {
      // Step 4: Send request with current account
      const response = await sendUnifiedRequest(
        requestUrl,
        requestBody,
        {
          httpsProxy: fastify.configService.getHttpsProxy(),
          ...config,
          headers: JSON.parse(JSON.stringify(requestHeaders)),
        },
        context,
        fastify.log
      );

      // Step 5: Handle response errors and exhaustion
      if (!response.ok) {
        const errorText = await response.text();
        const errorStatus = response.status;

        const isExhausted = errorStatus === 429 || 
                           errorText.includes('daily free allocation') ||
                           errorText.includes('rate limit') ||
                           errorText.includes('quota') ||
                           errorStatus === 403;

        if (isExhausted && account.status !== 'exhausted') {
          account.status = 'exhausted';
          // Persist exhaustion state
          const usageKey = account.email || account.key;
          if (fastify.usageService && usageKey) {
            fastify.usageService.setLimit(usageKey, 0);
          }
          // Continue to next account
          continue;
        }
        // Non-exhaustion errors: throw if last account
        if (attemptedAccounts.size === accounts.length) {
          throw createApiError(...);
        }
        continue;
      }

      // Step 6: Success! Record usage and return
      if (fastify.usageService) {
        const usageKey = account.email || account.key;
        fastify.usageService.recordUsage(usageKey, tokensUsed, 'tokens', provider.name);
      }
      return response;

    } catch (err: any) {
      lastError = err;
      continue;
    }
  }

  // Step 7: All accounts failed
  throw createApiError(
    `All configured accounts for provider '${provider.name}' are exhausted or failed...`,
    502,
    "all_accounts_failed"
  );
}
```

### 2.3 Account Selection Decision Tree

```
┌─────────────────────────────────────────┐
│  sendRequestToProvider() called          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Get accounts array from provider         │
│ (accounts[] or convert apiKey)           │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ For each account in sequence:            │
│ ┌─────────────────────────────────────┐ │
│ │ 1. Create account identifier        │ │
│ │    (email | label | key[0:8])       │ │
│ │ 2. Skip if already exhausted        │ │
│ │    (usageService or status flag)    │ │
│ │ 3. Skip if attempted this req       │ │
│ │ 4. Send request with this key       │ │
│ │ 5. Check response status            │ │
│ │    ├─ 429/quota → mark exhausted    │ │
│ │    │  & try next account            │ │
│ │    ├─ Other error → try next        │ │
│ │    └─ Success → record usage        │ │
│ │         & return response           │ │
│ └─────────────────────────────────────┘ │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ All accounts tried and failed            │
│ → Return all_accounts_failed error       │
└─────────────────────────────────────────┘
```

---

## 3. URL Construction with Account IDs

### 3.1 URL Templating

**File**: [packages/core/src/api/routes.ts](packages/core/src/api/routes.ts#L375-L385)

```typescript
// Handle URL templates (e.g., {account_id} for Cloudflare)
let requestUrl = url;
if (typeof url === 'string' || (url instanceof URL)) {
  const urlStr = url.toString();
  if (urlStr.includes('{account_id}') && account.id) {
    const templatedUrl = urlStr.replace(/{account_id}/g, account.id);
    requestUrl = new URL(templatedUrl);
  }
}
```

**How it works**:
1. Check if provider's `baseUrl` contains `{account_id}` placeholder
2. If account has an `id` field, replace all occurrences of `{account_id}` with the account ID
3. Use templated URL for the request

### 3.2 Cloudflare Example

**Configuration** (`config.json`):
```json
{
  "name": "cloudflare-large",
  "api_base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
  "accounts": [
    {
      "id": "your-cloudflare-account-id-1",
      "key": "cfut_...",
      "email": "account1@company.com",
      "label": "Production"
    },
    {
      "id": "your-cloudflare-account-id-2",
      "key": "cfut_...",
      "email": "account2@company.com",
      "label": "Staging"
    }
  ],
  "models": ["@cf/nvidia/nemotron-3-120b-a12b"]
}
```

**Request Flow**:
```
baseUrl: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions
account.id: your-cloudflare-account-id-1

RESULT: https://api.cloudflare.com/client/v4/accounts/your-cloudflare-account-id-1/ai/v1/chat/completions
```

### 3.3 Other URL Patterns

The system supports any placeholder pattern in `baseUrl`:
- `{account_id}` - Account ID (Cloudflare)
- Custom patterns can be added by modifying the regex in the replacement logic

---

## 4. Error Handling & Exhaustion Detection

### 4.1 Exhaustion Detection Logic

**File**: [packages/core/src/api/routes.ts](packages/core/src/api/routes.ts#L414-L438)

```typescript
// Check for exhaustion/rate limiting errors
const isExhausted = errorStatus === 429 || 
                   errorText.includes('daily free allocation') ||
                   errorText.includes('rate limit') ||
                   errorText.includes('quota') ||
                   errorStatus === 403;

if (isExhausted && account.status !== 'exhausted') {
  account.status = 'exhausted';
  fastify.log.warn(
    `[Router] Account ${accountIdentifier} exhausted/rate-limited (HTTP ${errorStatus}). Rotating to next account...`
  );
  
  // Persist exhaustion state to UsageService
  const usageKey = account.email || account.key;
  if (fastify.usageService && usageKey) {
    // Set limit to 0 to mark as exhausted
    fastify.usageService.setLimit(usageKey, 0);
    fastify.log.info(`[Router] Marked ${accountIdentifier} as exhausted in UsageService`);
  }
  
  // Continue to next account
  lastError = { status: errorStatus, message: errorText };
  continue;
}
```

### 4.2 UsageService Integration

**File**: [packages/core/src/services/usage.ts](packages/core/src/services/usage.ts#L1-150)

The `UsageService` provides persistent exhaustion state:

```typescript
/**
 * Check if account is exhausted (used >= limit)
 */
public isExhausted(emailOrKey: string): boolean {
  const usage = this.currentUsage.accounts[emailOrKey];
  if (!usage || !usage.limit) {
    return false;
  }
  return usage.used >= usage.limit;
}

/**
 * Set usage limit for an account
 */
public setLimit(emailOrKey: string, limit: number): void {
  if (!this.currentUsage.accounts[emailOrKey]) {
    this.currentUsage.accounts[emailOrKey] = {
      used: 0,
    };
  }
  this.currentUsage.accounts[emailOrKey].limit = limit;
  this.saveUsage();
}
```

**Persisted to**: `~/.claude-code-router/data/usage.json`

### 4.3 Error Handling Flow

```
Request sent with account key
         │
         ▼
Response received
         │
         ├─ HTTP 200-299 → ✅ Success
         │   • Record usage
         │   • Return response
         │
         ├─ HTTP 429 → ⚠️ Rate Limited
         │   • Mark account as 'exhausted'
         │   • Set UsageService limit to 0
         │   • Continue to next account
         │
         ├─ HTTP 403 → ⚠️ Forbidden
         │   • Mark account as 'exhausted'
         │   • Continue to next account
         │
         ├─ Error text contains "quota|limit|free allocation"
         │   • Mark account as 'exhausted'
         │   • Continue to next account
         │
         └─ Other errors (4xx, 5xx)
             • Log warning
             • Try next account if available
             • Throw error if last account
```

### 4.4 Daily Usage Reset

**File**: [packages/core/src/services/usage.ts](packages/core/src/services/usage.ts#L35-L55)

```typescript
private loadUsage(): UsageData {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (fs.existsSync(this.usageFile)) {
      const content = fs.readFileSync(this.usageFile, 'utf8');
      const data = JSON.parse(content);
      // Reset if it's a new day
      if (data.day !== today) {
        this.logger.info(`[UsageService] New day detected, resetting usage counters`);
        return { day: today, accounts: {} };
      }
      return data;
    }
  } catch (error: any) {
    this.logger.warn(`[UsageService] Failed to load usage data: ${error.message}`);
  }
  return { day: today, accounts: {} };
}
```

**When**: On first UsageService method call after midnight UTC
**Behavior**: Automatically resets all `used` counters to 0, but preserves `limit` values

---

## 5. Key Differences: ai-router → claude-code-router

### 5.1 Major Architectural Changes

| Aspect | ai-router | CCR | Impact |
|--------|-----------|-----|--------|
| **Account Storage** | JavaScript config in server.js | JSON config (expandable to DB) | Better portability, easier UI integration |
| **Account Selection** | Custom routing logic per provider | Unified routing in sendRequestToProvider | Consistent behavior across providers |
| **Exhaustion Tracking** | In-memory only | Persisted to usage.json | Survives server restart |
| **URL Templating** | Provider-specific parsing | Generic {placeholder} replacement | Extensible to new providers |
| **API Surface** | Proprietary REST API | Standard OpenAI-compatible + REST | Better compatibility, easier migration |
| **Error Detection** | Manual checks per provider | Unified pattern matching | Centralized maintenance |
| **Usage Tracking** | Per-email only | Per-email or per-key | More flexible tracking |

### 5.2 Code Organization

**ai-router structure**:
```
server.js          # Everything in one file
├─ Routing logic
├─ Account management
├─ Usage tracking
└─ Provider-specific code
```

**CCR structure**:
```
packages/core/
├─ types/llm.ts    # Data models
├─ services/
│  ├─ usage.ts     # Usage tracking service
│  ├─ provider.ts  # Provider management
│  ├─ config.ts    # Configuration loading
│  └─ transformer.ts # Transformer pipeline
└─ api/
   └─ routes.ts    # Unified routing logic
```

### 5.3 Key Improvements

1. **Backwards Compatibility**: Still supports single `api_key` configuration
2. **Unified Routing**: Single `sendRequestToProvider()` handles all providers
3. **Extensible Placeholders**: Generic `{placeholder}` replacement in URLs
4. **Persistent State**: Usage tracking survives service restarts
5. **Better Logging**: Structured logs with account identifiers
6. **Type Safety**: TypeScript interfaces for all data structures
7. **UI Support**: Account management exposed via REST API and React components

---


## 6. Cloudflare account_id Placeholder Fix

### Root Cause

When using Cloudflare with multi-account setup, converting `provider.baseUrl` into a `URL` object before substitution encodes `{account_id}` into `%7Baccount_id%7D`, which prevents replacement and causes Cloudflare 404 routing errors.

### Fixed Behavior

Cloudflare URL templating now works by substituting `{account_id}` on the raw string first and constructing the `URL` object afterward.

### 6.1 Fixed Request Pattern

The templating must happen inside the account loop and before `new URL(...)` is called:

```typescript
const urlStr =
  baseRequestUrl instanceof URL
    ? baseRequestUrl.toString()
    : String(baseRequestUrl);

const templatedUrl =
  account.id && urlStr.includes('{account_id}')
    ? urlStr.replace(/{account_id}/g, account.id)
    : urlStr;

const requestUrl = new URL(templatedUrl);
```

### 6.2 Verification

After the fix, verify:
1. Cloudflare requests log a fully substituted account URL.
2. `POST /v1/messages` succeeds against the configured Cloudflare model.
3. `ccr code -p "Hello"` also succeeds when routed through the same provider.

---

## 7. Configuration Examples

### 7.1 Multi-Account Groq

```json
{
  "name": "groq",
  "api_base_url": "https://api.groq.com/openai/v1",
  "accounts": [
    {
      "key": "gsk_...",
      "email": "dev@company.com",
      "label": "Development"
    },
    {
      "key": "gsk_...",
      "email": "prod@company.com",
      "label": "Production"
    }
  ],
  "models": [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile"
  ],
  "transformer": {
    "use": ["anthropic"]
  }
}
```

### 7.2 Multi-Account Cloudflare

```json
{
  "name": "cloudflare",
  "api_base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run",
  "accounts": [
    {
      "id": "your-cloudflare-account-id-1",
      "key": "cfut_...",
      "email": "account1@company.com",
      "label": "Production"
    },
    {
      "id": "your-cloudflare-account-id-2",
      "key": "cfut_...",
      "email": "account2@company.com",
      "label": "Staging"
    }
  ],
  "models": [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/nvidia/nemotron-3-120b-a12b"
  ],
  "transformer": {
    "use": ["anthropic"]
  }
}
```

### 7.3 Legacy Single-Account (Auto-Converted)

```json
{
  "name": "openai",
  "api_base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "models": ["gpt-4", "gpt-3.5-turbo"],
  "transformer": {
    "use": ["openai"]
  }
}
```

**Auto-Converted To**:
```typescript
{
  name: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-...",
  accounts: [{
    key: "sk-...",
    status: 'active'
  }],
  models: ["gpt-4", "gpt-3.5-turbo"],
  transformer: { ... }
}
```

---

## 8. Request Flow Diagram

```
Client Request
  ↓
Router Hook (namespace hook)
  • Transform model using Router config
  ↓
Provider Extraction
  • Parse provider from model string
  ↓
handleTransformerEndpoint()
  ↓
processRequestTransformers()
  • Apply request-level transformations
  ↓
sendRequestToProvider()
  ├─ Get accounts array
  ├─ For each account:
  │  ├─ Check if exhausted (UsageService)
  │  ├─ Skip if already attempted
  │  ├─ Template URL with account.id if needed
  │  ├─ Add Authorization header with account.key
  │  ├─ Send request
  │  ├─ Check response:
  │  │  ├─ If 200-299: Record usage, return ✅
  │  │  ├─ If 429/403/quota: Mark exhausted, continue
  │  │  └─ If other error: Try next, or throw
  │  └─ Continue to next account
  ├─ All accounts failed: throw all_accounts_failed
  ↓
processResponseTransformers()
  • Apply response-level transformations
  ↓
formatResponse()
  • Handle streaming/JSON response
  ↓
Client Response
```

---

## 9. Debugging & Monitoring

### 9.1 Log Locations

```
Server Logs: ~/.claude-code-router/logs/ccr-*.log
  - HTTP requests, API calls
  - Provider responses, account rotation decisions

App Logs: ~/.claude-code-router/claude-code-router.log
  - Routing decisions
  - Account status changes
  - Usage tracking events

Usage Data: ~/.claude-code-router/data/usage.json
  - Persistent account usage state
  - Daily reset dates
```

### 9.2 Key Log Patterns

Look for these patterns in logs:

```
[Router] Attempting request with account: <accountIdentifier>
[Router] Request succeeded with account: <accountIdentifier>
[Router] Skipping exhausted account: <accountIdentifier>
[Router] Account <accountIdentifier> exhausted/rate-limited (HTTP 429)
[Router] All 2 account(s) exhausted or failed for cloudflare
```

### 9.3 REST Endpoints for Monitoring

```bash
# Get current usage data
curl http://localhost:8000/api/usage

# Get specific provider account status
curl http://localhost:8000/api/providers/cloudflare/accounts

# Refresh dynamic models
curl -X POST http://localhost:8000/refresh-models
```

---

## 10. Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| **Data Models** | types/llm.ts | Defines ProviderAccount, LLMProvider, ConfigProvider |
| **Account Loading** | services/provider.ts | Converts config to internal format, supports backward compat |
| **Account Selection** | api/routes.ts (sendRequestToProvider) | Iterates accounts, detects exhaustion, rotates |
| **URL Templating** | api/routes.ts (line 375-385) | Replaces {account_id} with actual ID |
| **Usage Tracking** | services/usage.ts | Tracks tokens per account, daily reset |
| **Error Handling** | api/routes.ts (line 414-438) | Detects 429/403/quota, marks exhausted |
| **Persistence** | ~/.claude-code-router/data/usage.json | Survives server restarts |

---

## Appendix A: Migration Checklist

- [x] Data model supports account IDs
- [x] Account loading from config.json
- [x] URL templating with {account_id}
- [x] Account selection with round-robin attempt
- [x] Exhaustion detection (429, 403, quota text)
- [x] Usage tracking per account
- [x] Daily reset functionality
- [x] Persistent storage to JSON
- [x] REST API endpoints for monitoring
- [x] Backward compatibility with single api_key
- [x] Documentation of account routing

---

## Appendix B: Known Issues

1. **URL Templating Placement**: The {account_id} replacement occurs in current code, but timing may need verification for proper functioning with each account iteration
2. **Provider-specific ID Fields**: Currently only {account_id} is supported; other providers may need additional placeholder types (to be extended as needed)

