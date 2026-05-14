# Provider Configuration Mapping: ai-router → CCR

This guide shows how to migrate your ai-router provider configurations to claude-code-router with multi-account support.

## General Pattern

### ai-router Format (server.js/config)
```javascript
const providers = {
  'groq': {
    1: { groq_api_key: 'key1', email: '' },
    2: { groq_api_key: 'key2', email: '' },
  }
}
```

### CCR Format (config.json with multi-account)
```json
{
  "name": "groq",
  "api_base_url": "https://api.groq.com/openai/v1",
  "accounts": [
    { "key": "key1", "email": "account1@company.com", "label": "Account 1" },
    { "key": "key2", "email": "account2@company.com", "label": "Account 2" }
  ],
  "models": ["llama-3.3-70b-versatile"],
  "transformer": { "use": ["anthropic"] },
  "dynamic_discovery_url": "https://api.groq.com/openai"
}
```

## Provider-Specific Configurations

### 1. Groq

**ai-router:**
```javascript
GROQ_PROVIDER: {
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "groq/llama-3.1-8b-instant",
  ANTHROPIC_DEFAULT_SONNET_MODEL: "groq/llama-3.3-70b-versatile",
  ANTHROPIC_DEFAULT_OPUS_MODEL: "groq/openai/gpt-oss-120b"
}
```

**CCR:**
```json
{
  "name": "groq",
  "api_base_url": "https://api.groq.com/openai/v1",
  "accounts": [
    {"key": "gsk_...", "email": "dev@company.com", "label": "Development"}
  ],
  "models": [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "gpt-oss-120b"
  ],
  "transformer": {
    "use": ["anthropic"]
  },
  "dynamic_discovery_url": "https://api.groq.com/openai"
}
```

**Features:**
- ✅ Multi-account support via key rotation
- ✅ Auto-discovery: `dynamic_discovery_url` fetches available models
- ✅ Transformer: Anthropic format (uses OpenAI under the hood, CCR converts)

---

### 2. Cloudflare

**ai-router:**
```javascript
cloudflare_account_id: "your-cloudflare-account-id-1",
cloudflare_workers_api_key: "cfut_..."
```

**CCR:**
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
  "models": [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/nvidia/nemotron-3-120b-a12b"
  ]
}
```

**Features:**
- ✅ Account ID support: Uses `account.id` in URL
- ✅ Multiple Cloudflare accounts with different IDs
- ✅ URL templating: `{account_id}` replaced with `account.id`
- ✅ Tested with Claude Code Router's Anthropic `/v1/messages` ingress and Cloudflare's OpenAI-compatible `/ai/v1/chat/completions` endpoint

**Implementation note**: routes.ts must substitute the placeholder before constructing a `URL` object:
```typescript
const templatedUrl = urlStr.replace(/{account_id}/g, account.id);
```

---

### 3. OpenRouter

**ai-router:**
```javascript
ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
ANTHROPIC_DEFAULT_HAIKU_MODEL: "nvidia/nemotron-3-super-120b-a12b:free",
```

**CCR:**
```json
{
  "name": "openrouter",
  "api_base_url": "https://openrouter.ai/api/v1",
  "accounts": [
    {"key": "sk-...", "email": "dev@company.com", "label": "Free Tier"}
  ],
  "models": [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "tencent/hy3-preview:free",
    "openai/gpt-oss-120b:free"
  ],
  "transformer": {
    "use": ["openai"]
  },
  "dynamic_discovery_url": "https://openrouter.ai/api"
}
```

**Features:**
- ✅ Free tier models
- ✅ Model namespacing (provider/model:variant)
- ✅ Transformer: OpenAI format

---

### 4. Mistral

**ai-router:**
```javascript
{
  mistral_api_key: "your-mistral-api-key",
  email: ""
}
```

**CCR:**
```json
{
  "name": "mistral",
  "api_base_url": "https://api.mistral.ai/v1",
  "accounts": [
    {"key": "your-mistral-api-key", "email": "dev@company.com", "label": "API Key 1"}
  ],
  "models": [
    "mistral-small-latest",
    "mistral-medium-latest",
    "mistral-large-latest"
  ],
  "transformer": {
    "use": ["openai"]
  },
  "dynamic_discovery_url": "https://api.mistral.ai"
}
```

**Features:**
- ✅ Multi-account via key rotation
- ✅ OpenAI-compatible format
- ✅ Dynamic model discovery

---

### 5. Cohere

**ai-router:**
```javascript
{
  cohere_api_key: "your-cohere-api-key",
  email: ""
}
```

**CCR:**
```json
{
  "name": "cohere",
  "api_base_url": "https://api.cohere.ai/v1",
  "accounts": [
    {"key": "your-cohere-api-key", "email": "dev@company.com", "label": "Production"}
  ],
  "models": [
    "command-r",
    "command-r-plus",
    "command-light"
  ],
  "transformer": {
    "use": ["anthropic"]
  },
  "dynamic_discovery_url": "https://api.cohere.ai"
}
```

**Features:**
- ✅ Multi-account key rotation
- ✅ Anthropic transformer (for tool calling)

---

### 6. NVIDIA

**ai-router:**
```javascript
{
  nvidia_api_key: "nvapi-your-nvidia-api-key",
  email: ""
}
```

**CCR:**
```json
{
  "name": "nvidia",
  "api_base_url": "https://integrate.api.nvidia.com/v1",
  "accounts": [
    {"key": "nvapi-your-nvidia-api-key", "email": "dev@company.com", "label": "API Key 1"}
  ],
  "models": [
    "nvidia/nemotron-3-8b-instruct",
    "nvidia/nemotron-3-70b-instruct",
    "nvidia/llama2-70b"
  ],
  "transformer": {
    "use": ["openai"]
  },
  "dynamic_discovery_url": "https://integrate.api.nvidia.com"
}
```

**Features:**
- ✅ Multi-account key rotation
- ✅ High-performance inference

---

### 7. Cerebras

**ai-router:**
```javascript
{
  cerebras_api_key: "csk-your-cerebras-api-key",
  email: ""
}
```

**CCR:**
```json
{
  "name": "cerebras",
  "api_base_url": "https://api.cerebras.ai/v1",
  "accounts": [
    {"key": "csk-your-cerebras-api-key", "email": "dev@company.com", "label": "API Key 1"}
  ],
  "models": [
    "llama-3.3-70b"
  ],
  "transformer": {
    "use": ["openai"]
  },
  "dynamic_discovery_url": "https://api.cerebras.ai"
}
```

**Features:**
- ✅ Multi-account key rotation
- ✅ OpenAI-compatible API
- ✅ Fast inference

---

### 8. Google Gemini (AI Studio)

**ai-router:**
```javascript
{
  gemini_api_key: "AIzaSy-your-gemini-api-key-1",
  email: ""
}
```

**CCR:**
```json
{
  "name": "aistudio",
  "api_base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
  "accounts": [
    {"key": "AIzaSy-your-gemini-api-key-1", "email": "dev1@company.com", "label": "Key 1"},
    {"key": "AIzaSy-your-gemini-api-key-2", "email": "dev2@company.com", "label": "Key 2"}
  ],
  "models": [
    "gemini-pro",
    "gemini-1.5-pro"
  ],
  "transformer": {
    "use": ["openai"]
  },
  "dynamic_discovery_url": "https://generativelanguage.googleapis.com"
}
```

**Features:**
- ✅ Multi-account key rotation
- ✅ OpenAI-compatible adapter
- ✅ Free tier availability

---

## Complete Example: config.json with Multiple Providers

```json
{
  "providers": [
    {
      "name": "groq",
      "api_base_url": "https://api.groq.com/openai/v1",
      "accounts": [
        {"key": "gsk_...", "email": "dev@company.com", "label": "Development"},
        {"key": "gsk_...", "email": "prod@company.com", "label": "Production"}
      ],
      "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      "transformer": {"use": ["anthropic"]},
      "dynamic_discovery_url": "https://api.groq.com/openai"
    },
    {
      "name": "cloudflare",
      "api_base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run",
      "accounts": [
        {
          "id": "your-cloudflare-account-id-1",
          "key": "cfut_...",
          "email": "account1@company.com",
          "label": "Account 1"
        },
        {
          "id": "your-cloudflare-account-id-2",
          "key": "cfut_...",
          "email": "account2@company.com",
          "label": "Account 2"
        }
      ],
      "models": ["@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
      "transformer": {"use": ["anthropic"]}
    },
    {
      "name": "mistral",
      "api_base_url": "https://api.mistral.ai/v1",
      "accounts": [
        {"key": "your-mistral-api-key", "email": "dev@company.com", "label": "Main Key"}
      ],
      "models": ["mistral-large-latest"],
      "transformer": {"use": ["openai"]},
      "dynamic_discovery_url": "https://api.mistral.ai"
    }
  ]
}
```

## Migration Checklist

For each provider in your ai-router setup:

- [ ] Extract all accounts (multiple keys/credentials)
- [ ] Map to CCR format with accounts array
- [ ] Add email/label for tracking
- [ ] Include account ID if needed (e.g., Cloudflare)
- [ ] Set appropriate transformer (openai or anthropic)
- [ ] Add dynamic_discovery_url if available
- [ ] List all available models
- [ ] Test with `/v1/models` endpoint
- [ ] Test key rotation with multiple accounts
- [ ] Verify usage tracking in `/api/usage`

## Troubleshooting Provider Setup

### Issue: "Provider not found"
- Verify provider name matches exactly (case-sensitive)
- Check config.json syntax

### Issue: "No API keys configured"
- Ensure accounts array has at least one account
- Verify account.key is not empty

### Issue: "All accounts failed"
- Check API key validity for all accounts
- Verify API base URL is correct
- Check rate limits/quota for accounts
- Review server logs for specific errors

### Issue: Models not discovered
- Verify dynamic_discovery_url is correct
- Call POST /refresh-models manually
- Check provider's API documentation
- Some providers may not support model discovery

## Provider API Documentation References

- **Groq**: https://console.groq.com/docs/
- **Mistral**: https://docs.mistral.ai/
- **Cohere**: https://docs.cohere.com/
- **NVIDIA**: https://docs.nvidia.com/ai-endpoints/
- **Cerebras**: https://docs.cerebras.ai/
- **Cloudflare**: https://developers.cloudflare.com/workers-ai/
- **Google Gemini**: https://ai.google.dev/tutorials/python_quickstart
- **OpenRouter**: https://openrouter.ai/docs
