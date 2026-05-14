# Claude Code Router

A powerful tool to route Claude Code requests to different models and customize any request.

## About This Fork

This is a personal fork of [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router). The original project is an excellent open-source routing solution maintained by the musistudio team.

### Differences from the Original

- **Advertising Removed**: This version removes promotional content and sponsorship messaging to focus on core functionality documentation.
- **Pre-configured Providers**: Comes with a broader set of pre-configured LLM providers (Cloudflare, Groq, Google AI Studio, NVIDIA, Mistral, Cohere, Cerebras) with support for multi-account routing.
- **Local Setup Documentation**: Includes setup instructions tailored for local deployment and development.

### Why This Fork Was Created

This fork was created to:
1. Provide a clean, advertising-free version of the documentation
2. Demonstrate multi-provider routing setup with multiple accounts per provider
3. Enable rapid local deployment and testing of the Claude Code Router
4. Serve as a reference implementation for advanced routing configurations

### Original Project

For the full documentation, upstream updates, and the original community, please visit:
- **Repository**: https://github.com/musistudio/claude-code-router
- **Discord**: https://discord.gg/rdftVMaUcS
- **License**: MIT (see LICENSE file)

## ✨ Features

### Core Routing
- **Intelligent Scenario-Based Routing**: Automatically route requests based on context
  - `default`: Standard requests
  - `background`: Lightweight background tasks
  - `think`: Thinking/reasoning-intensive operations (Plan Mode)
  - `longContext`: Automatically triggered for requests exceeding token thresholds
  - `webSearch`: Web search-related operations
  - `image`: Image processing and analysis tasks
- **Token-Aware Routing**: Automatic token counting (cl100k_base) to intelligently select models based on context length requirements
- **Multi-Provider Support**: Supports 15+ providers including OpenRouter, DeepSeek, Ollama, Gemini, Volcengine, SiliconFlow, Cloudflare, Groq, NVIDIA, Mistral, Cohere, Cerebras, and more
- **Multi-Account Routing**: Multiple API keys per provider with automatic rotation and exhaustion detection
  - Automatic account rotation on rate limits and quota exhaustion
  - Usage tracking with daily reset
  - Per-account status monitoring (active/exhausted/rate_limited)

### Advanced Features
- **Request/Response Transformation**: Customize requests and responses for different providers using a flexible transformer system
- **Dynamic Model Switching**: Switch models on-the-fly within Claude Code using the `/model` command
- **Custom Router Functions**: Write custom JavaScript routing logic for complex scenarios
- **Project-Level Configuration**: Define routing rules per project at `~/.claude/projects/<project-id>/claude-code-router.json`
- **Preset System**: Schema-based configuration templates for easy sharing and reuse
  - Export/import presets with sensitive data protection
  - Marketplace integration for discovering community presets
  - Conditional field support with template interpolation

### Developer Tools
- **Web UI Dashboard**: Full-featured interface for managing providers, accounts, models, and presets
- **CLI Model Management**: Interactive terminal UI (`ccr model`) for configuration without editing JSON
- **Usage Tracking & Analytics**: Monitor API consumption per provider and account
- **Plugin System**: Extend functionality with custom transformers and plugins
- **Agent System**: Extensible architecture for custom tools and workflows
- **Non-Interactive Mode**: Full CI/CD support for Docker, GitHub Actions, and automated environments

### Deployment & Operations
- **GitHub Actions Integration**: Trigger Claude Code tasks in your workflows
- **Logging System**: Dual logging (server-level and application-level) with auto-rotating files
- **Environment Variable Interpolation**: Secure API key management via `$VAR_NAME` syntax
- **Health Monitoring**: Built-in health checks and status endpoints
- **Proxy Support**: Configure proxy for API requests

## 🚀 Getting Started

### 1. Installation

First, ensure you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code/quickstart) installed:

```shell
npm install -g @anthropic-ai/claude-code
```

Then, install Claude Code Router:

```shell
npm install -g @musistudio/claude-code-router
```

### 2. Configuration

Create and configure your `~/.claude-code-router/config.json` file. For more details, you can refer to `config.example.json`.

The `config.json` file has several key sections:

- **`PROXY_URL`** (optional): You can set a proxy for API requests, for example: `"PROXY_URL": "http://127.0.0.1:7890"`.
- **`LOG`** (optional): You can enable logging by setting it to `true`. When set to `false`, no log files will be created. Default is `true`.
- **`LOG_LEVEL`** (optional): Set the logging level. Available options are: `"fatal"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`. Default is `"debug"`.
- **Logging Systems**: The Claude Code Router uses two separate logging systems:
  - **Server-level logs**: HTTP requests, API calls, and server events are logged using pino in the `~/.claude-code-router/logs/` directory with filenames like `ccr-*.log`
  - **Application-level logs**: Routing decisions and business logic events are logged in `~/.claude-code-router/claude-code-router.log`
- **`APIKEY`** (optional): You can set a secret key to authenticate requests. When set, clients must provide this key in the `Authorization` header (e.g., `Bearer your-secret-key`) or the `x-api-key` header. Example: `"APIKEY": "your-secret-key"`.
- **`HOST`** (optional): You can set the host address for the server. If `APIKEY` is not set, the host will be forced to `127.0.0.1` for security reasons to prevent unauthorized access. Example: `"HOST": "0.0.0.0"`.
- **`NON_INTERACTIVE_MODE`** (optional): When set to `true`, enables compatibility with non-interactive environments like GitHub Actions, Docker containers, or other CI/CD systems. This sets appropriate environment variables (`CI=true`, `FORCE_COLOR=0`, etc.) and configures stdin handling to prevent the process from hanging in automated environments. Example: `"NON_INTERACTIVE_MODE": true`.

- **`Providers`**: Used to configure different model providers.
- **`Router`**: Used to set up routing rules. `default` specifies the default model, which will be used for all requests if no other route is configured.
- **`API_TIMEOUT_MS`**: Specifies the timeout for API calls in milliseconds.

#### Environment Variable Interpolation

Claude Code Router supports environment variable interpolation for secure API key management. You can reference environment variables in your `config.json` using either `$VAR_NAME` or `${VAR_NAME}` syntax:

```json
{
  "OPENAI_API_KEY": "$OPENAI_API_KEY",
  "GEMINI_API_KEY": "${GEMINI_API_KEY}",
  "Providers": [
    {
      "name": "openai",
      "api_base_url": "https://api.openai.com/v1/chat/completions",
      "api_key": "$OPENAI_API_KEY",
      "models": ["gpt-5", "gpt-5-mini"]
    }
  ]
}
```

This allows you to keep sensitive API keys in environment variables instead of hardcoding them in configuration files. The interpolation works recursively through nested objects and arrays.

Here is a comprehensive example:

```json
{
  "APIKEY": "your-secret-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "LOG": true,
  "API_TIMEOUT_MS": 600000,
  "NON_INTERACTIVE_MODE": false,
  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": [
        "google/gemini-2.5-pro-preview",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3.7-sonnet:thinking"
      ],
      "transformer": {
        "use": ["openrouter"]
      }
    },
    {
      "name": "deepseek",
      "api_base_url": "https://api.deepseek.com/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      "transformer": {
        "use": ["deepseek"],
        "deepseek-chat": {
          "use": ["tooluse"]
        }
      }
    },
    {
      "name": "ollama",
      "api_base_url": "http://localhost:11434/v1/chat/completions",
      "api_key": "ollama",
      "models": ["qwen2.5-coder:latest"]
    },
    {
      "name": "gemini",
      "api_base_url": "https://generativelanguage.googleapis.com/v1beta/models/",
      "api_key": "sk-xxx",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "transformer": {
        "use": ["gemini"]
      }
    },
    {
      "name": "volcengine",
      "api_base_url": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      "api_key": "sk-xxx",
      "models": ["deepseek-v3-250324", "deepseek-r1-250528"],
      "transformer": {
        "use": ["deepseek"]
      }
    },
    {
      "name": "modelscope",
      "api_base_url": "https://api-inference.modelscope.cn/v1/chat/completions",
      "api_key": "",
      "models": ["Qwen/Qwen3-Coder-480B-A35B-Instruct", "Qwen/Qwen3-235B-A22B-Thinking-2507"],
      "transformer": {
        "use": [
          [
            "maxtoken",
            {
              "max_tokens": 65536
            }
          ],
          "enhancetool"
        ],
        "Qwen/Qwen3-235B-A22B-Thinking-2507": {
          "use": ["reasoning"]
        }
      }
    },
    {
      "name": "dashscope",
      "api_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      "api_key": "",
      "models": ["qwen3-coder-plus"],
      "transformer": {
        "use": [
          [
            "maxtoken",
            {
              "max_tokens": 65536
            }
          ],
          "enhancetool"
        ]
      }
    },
    {
      "name": "aihubmix",
      "api_base_url": "https://aihubmix.com/v1/chat/completions",
      "api_key": "sk-",
      "models": [
        "Z/glm-4.5",
        "claude-opus-4-20250514",
        "gemini-2.5-pro"
      ]
    }
  ],
  "Router": {
    "default": "deepseek,deepseek-chat",
    "background": "ollama,qwen2.5-coder:latest",
    "think": "deepseek,deepseek-reasoner",
    "longContext": "openrouter,google/gemini-2.5-pro-preview",
    "longContextThreshold": 60000,
    "webSearch": "gemini,gemini-2.5-flash"
  }
}
```

### Cloudflare Workers AI Multi-Account Example

If you want to route Claude Code through multiple Cloudflare Workers AI accounts, use Cloudflare's OpenAI-compatible endpoint and configure each account in the `accounts` array:

```json
{
  "APIKEY": "test",
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "Providers": [
    {
      "name": "cloudflare-large",
      "api_base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
      "accounts": [
        {
          "id": "account-id-1",
          "key": "cf-token-1",
          "email": "",
          "label": "account_1"
        },
        {
          "id": "account-id-2",
          "key": "cf-token-2",
          "email": "user@example.com",
          "label": "account_2"
        }
      ],
      "models": [
        "@cf/nvidia/nemotron-3-120b-a12b",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-4-scout-17b-16e-instruct"
      ]
    }
  ],
  "Router": {
    "default": "cloudflare-large,@cf/nvidia/nemotron-3-120b-a12b",
    "background": "cloudflare-large,@cf/nvidia/nemotron-3-120b-a12b",
    "think": "cloudflare-large,@cf/nvidia/nemotron-3-120b-a12b",
    "longContext": "cloudflare-large,@cf/nvidia/nemotron-3-120b-a12b",
    "webSearch": "cloudflare-large,@cf/meta/llama-4-scout-17b-16e-instruct"
  }
}
```

Notes:

- Use `ai/v1/chat/completions`, not the older `ai/run` endpoint, when routing through CCR.
- Keep the `{account_id}` placeholder in `api_base_url`; CCR substitutes it per account at request time.
- After changing the config, restart the service with `ccr restart` before testing `ccr code` or `ccr code -p "Hello"`.

### Provider Verification Status

The router supports many providers, but the table below reflects the currently verified release surface rather than the full compatibility surface.

| Provider | Status | Validation |
| --- | --- | --- |
| Cloudflare Workers AI | Verified | Multi-account routing validated with Anthropic `/v1/messages` traffic and `ccr code -p "Hello"` using `cloudflare-large`. |
| OpenRouter | Supported by configuration surface | Not re-validated in this release pass. |
| Gemini / Google AI | Supported by configuration surface | Not re-validated in this release pass. |
| Ollama | Supported by configuration surface | Not re-validated in this release pass. |
| DeepSeek | Supported by configuration surface | Not re-validated in this release pass. |
| Volcengine | Supported by configuration surface | Not re-validated in this release pass. |
| SiliconFlow | Supported by configuration surface | Not re-validated in this release pass. |
| Cohere | Config imported from external router setup | Not re-validated in this release pass. |
| NVIDIA | Config imported from external router setup | Not re-validated in this release pass. |
| Mistral | Config imported from external router setup | Not re-validated in this release pass. |
| Groq | Config imported from external router setup | Not re-validated in this release pass. |
| Cerebras | Config imported from external router setup | Not re-validated in this release pass. |
| AI Studio | Config imported from external router setup | Not re-validated in this release pass. |

If you are preparing a release, treat anything outside the verified row as opt-in until you run a live smoke test for that provider against your own credentials.

You can run the built-in smoke test against a running CCR instance:

```shell
# Test all configured providers (CCR must be running)
pnpm test:providers

# Test a single provider
pnpm test:providers -- cloudflare-large

# Override host/port/key
CCR_PORT=4000 CCR_APIKEY=mykey pnpm test:providers
```

The script sends one minimal request per provider and prints a pass/fail matrix.

### 3. Running Claude Code with the Router

Start Claude Code using the router:

```shell
ccr code
```

> **Note**: After modifying the configuration file, you need to restart the service for the changes to take effect:
>
> ```shell
> ccr restart
> ```

### 4. UI Mode

For a more intuitive experience, you can use the UI mode to manage your configuration:

```shell
ccr ui
```

This will open a web-based interface where you can easily view and edit your `config.json` file.

### 5. CLI Model Management

For users who prefer terminal-based workflows, you can use the interactive CLI model selector:

```shell
ccr model
```

This command provides an interactive interface to:

- View current configuration:
- See all configured models (default, background, think, longContext, webSearch, image)
- Switch models: Quickly change which model is used for each router type
- Add new models: Add models to existing providers
- Create new providers: Set up complete provider configurations including:
   - Provider name and API endpoint
   - API key
   - Available models
   - Transformer configuration with support for:
     - Multiple transformers (openrouter, deepseek, gemini, etc.)
     - Transformer options (e.g., maxtoken with custom limits)
     - Provider-specific routing (e.g., OpenRouter provider preferences)

The CLI tool validates all inputs and provides helpful prompts to guide you through the configuration process, making it easy to manage complex setups without editing JSON files manually.

### 6. Presets Management

Presets allow you to save, share, and reuse configurations easily. You can export your current configuration as a preset and install presets from files or URLs.

```shell
# Export current configuration as a preset
ccr preset export my-preset

# Export with metadata
ccr preset export my-preset --description "My OpenAI config" --author "Your Name" --tags "openai,production"

# Install a preset from local directory
ccr preset install /path/to/preset

# List all installed presets
ccr preset list

# Show preset information
ccr preset info my-preset

# Delete a preset
ccr preset delete my-preset
```

**Preset Features:**
- **Export**: Save your current configuration as a preset directory (with manifest.json)
- **Install**: Install presets from local directories
- **Sensitive Data Handling**: API keys and other sensitive data are automatically sanitized during export (marked as `{{field}}` placeholders)
- **Dynamic Configuration**: Presets can include input schemas for collecting required information during installation
- **Version Control**: Each preset includes version metadata for tracking updates

**Preset File Structure:**
```
~/.claude-code-router/presets/
├── my-preset/
│   └── manifest.json    # Contains configuration and metadata
```

### 7. Activate Command (Environment Variables Setup)

The `activate` command allows you to set up environment variables globally in your shell, enabling you to use the `claude` command directly or integrate Claude Code Router with applications built using the Agent SDK.

To activate the environment variables, run:

```shell
eval "$(ccr activate)"
```

This command outputs the necessary environment variables in shell-friendly format, which are then set in your current shell session. After activation, you can:

- **Use `claude` command directly**: Run `claude` commands without needing to use `ccr code`. The `claude` command will automatically route requests through Claude Code Router.
- **Integrate with Agent SDK applications**: Applications built with the Anthropic Agent SDK will automatically use the configured router and models.

The `activate` command sets the following environment variables:

- `ANTHROPIC_AUTH_TOKEN`: API key from your configuration
- `ANTHROPIC_BASE_URL`: The local router endpoint (default: `http://127.0.0.1:3456`)
- `NO_PROXY`: Set to `127.0.0.1` to prevent proxy interference
- `DISABLE_TELEMETRY`: Disables telemetry
- `DISABLE_COST_WARNINGS`: Disables cost warnings
- `API_TIMEOUT_MS`: API timeout from your configuration

> **Note**: Make sure the Claude Code Router service is running (`ccr start`) before using the activated environment variables. The environment variables are only valid for the current shell session. To make them persistent, you can add `eval "$(ccr activate)"` to your shell configuration file (e.g., `~/.zshrc` or `~/.bashrc`).

## 🔀 Advanced Routing Features

### Multi-Account Routing

Claude Code Router supports multiple API keys per provider with automatic account rotation and exhaustion handling. This allows you to maximize throughput and handle rate limits gracefully.

```json
{
  "name": "cloudflare-large",
  "api_base_url": "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions",
  "accounts": [
    {
      "id": "account-id-1",
      "key": "cf-token-1",
      "email": "user1@example.com",
      "label": "Production Account"
    },
    {
      "id": "account-id-2",
      "key": "cf-token-2",
      "email": "user2@example.com",
      "label": "Backup Account"
    }
  ],
  "models": ["@cf/nvidia/nemotron-3-120b-a12b", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"]
}
```

**Features:**
- **Automatic Rotation**: Requests are distributed across accounts
- **Exhaustion Detection**: Detects HTTP 429 (rate limit) and quota errors
- **Usage Tracking**: Monitor API consumption per account with daily reset
- **Account Status**: Track which accounts are active, exhausted, or rate-limited

### Scenario-Based Routing

Claude Code Router intelligently routes requests based on operation type and context:

```json
{
  "Router": {
    "default": "provider-name,model-name",
    "background": "provider-name,lightweight-model",
    "think": "provider-name,reasoning-model",
    "longContext": "provider-name,large-context-model",
    "longContextThreshold": 60000,
    "webSearch": "provider-name,search-capable-model",
    "image": "provider-name,vision-model"
  }
}
```

**Routing Types:**
- **`default`**: Standard requests
- **`background`**: Lightweight tasks (background processing)
- **`think`**: Thinking-intensive operations (Plan Mode)
- **`longContext`**: Automatically used when token count exceeds `longContextThreshold`
- **`webSearch`**: Web search-related operations
- **`image`**: Image processing and analysis tasks

The router automatically calculates token counts using cl100k_base tokenizer to determine when to use `longContext` models.

### Custom Router Functions

For complex routing logic, define custom JavaScript functions:

```json
{
  "Router": {
    "customFunction": "~/.claude-code-router/router.js"
  }
}
```

Your custom router function receives request context and returns the routing decision:

```javascript
// ~/.claude-code-router/router.js
module.exports = {
  route: async (context) => {
    // context includes: messages, model, tools, etc.
    if (context.messages.length > 100) {
      return { provider: "groq", model: "llama-3.3-70b-versatile" };
    }
    return { provider: "default", model: "default" };
  }
};
```

### Project-Level Configuration

Define routing rules specific to individual projects:

```json
// ~/.claude/projects/<project-id>/claude-code-router.json
{
  "Router": {
    "default": "groq,llama-3.3-70b-versatile",
    "think": "cloudflare-large,@cf/meta/llama-3.3-70b-instruct-fp8-fast"
  },
  "Providers": []  // Optional provider overrides
}
```

Project configurations override global settings, allowing fine-grained control per project.

### Usage Tracking & Monitoring

Monitor API consumption and provider health:

```shell
# View usage statistics
curl http://127.0.0.1:3456/api/usage

# Check provider account status
curl http://127.0.0.1:3456/api/providers/cloudflare/accounts

# Get server health status
curl http://127.0.0.1:3456/health
```

Access usage analytics and account status through the Web UI Dashboard.

## 📦 Project Architecture

Claude Code Router is a **monorepo** consisting of 5 main packages:

### Core Packages

#### 1. **@musistudio/llms** (packages/core)
The universal LLM API transformation engine. This is the routing and transformation backbone.

**Responsibilities:**
- Request routing based on configuration and scenarios
- Provider-agnostic API transformation (converts between Anthropic, OpenAI, and provider-specific formats)
- Token counting using cl100k_base tokenizer
- Account rotation and usage tracking for multi-account providers
- Stream processing and response transformation

**Key Features:**
- Supports 15+ LLM providers
- Automatic request/response transformation
- Token-aware routing
- Multi-account exhaustion handling
- Custom transformer support

#### 2. **@CCR/server** (packages/server)
Express-based HTTP server wrapping the core routing engine.

**Provides:**
- `/v1/messages` - Claude API compatibility
- `/v1/chat/completions` - OpenAI API compatibility
- `/api/providers/*` - Provider management CRUD endpoints
- `/api/usage` - Usage analytics and statistics
- `/api/accounts` - Multi-account status tracking
- `/health` - Health check endpoint
- RESTful configuration management

**Features:**
- Health monitoring and status tracking
- Request logging and debugging
- Provider discovery and validation
- Dynamic model refresh
- Preset routing namespaces

#### 3. **@CCR/cli** (packages/cli)
Command-line interface for managing Claude Code Router.

**Commands:**
- `ccr start/stop/restart/status` - Service management
- `ccr code "prompt"` - Execute Claude Code
- `ccr model` - Interactive model selector
- `ccr models` - List available models
- `ccr preset export/install/list/delete` - Preset management
- `ccr ui` - Launch web UI
- `ccr activate` - Setup shell environment variables
- `ccr install` - GitHub marketplace integration
- `ccr logs` - View service logs

**Features:**
- Interactive terminal UI using Ink + React
- Real-time model switching
- Preset marketplace integration
- Environment variable setup for shell integration
- Service lifecycle management

#### 4. **@CCR/ui** (packages/ui)
React + Vite + Tailwind CSS web dashboard.

**Pages:**
- **Dashboard**: Overview and quick actions
- **Provider Management**: Configure providers, add accounts, manage models
- **Model Selection**: Choose default models for each scenario
- **Preset Manager**: Create, export, install, and share presets
- **Account Manager**: Monitor multi-account status and usage
- **Configuration Editor**: JSON editor with validation
- **Request History**: Track and analyze API requests
- **Debug Console**: System diagnostics and logs
- **Login**: API key authentication

**Features:**
- Real-time provider status
- Usage analytics dashboard
- Multi-language support (English, Chinese)
- Dark/light theme support
- Responsive design for desktop and mobile

#### 5. **@CCR/shared** (packages/shared)
Shared utilities and constants used across packages.

**Exports:**
- Type definitions for configuration schema
- Preset manifest schema and validation
- Environment variable helpers
- Logging utilities
- Constants and enums

### Monorepo Scripts

**Build Commands:**
```bash
pnpm build              # Build all packages
pnpm build:core        # Build core LLM routing engine
pnpm build:shared      # Build shared utilities
pnpm build:cli         # Build CLI tool
pnpm build:server      # Build HTTP server
pnpm build:ui          # Build web UI
pnpm build:docs        # Build documentation site
```

**Development Commands:**
```bash
pnpm dev:cli           # CLI development mode with hot reload
pnpm dev:server        # Server development mode
pnpm dev:ui            # Web UI development mode with hot reload
pnpm dev:core          # Core engine development mode
pnpm dev:docs          # Documentation site development
```

**Other Commands:**
```bash
pnpm test:providers    # Smoke test all configured providers
pnpm release           # Release all packages
pnpm release:npm       # Release to npm only
pnpm release:docker    # Release Docker image
```

## 🌐 Web UI & Dashboard

The Web UI provides a comprehensive management interface accessible at `http://127.0.0.1:3456` (or configured port).

**Dashboard Features:**
- Real-time provider and account status
- API usage metrics and trends
- Model switching interface
- Configuration management
- Preset creation and sharing
- Request history and debugging

**Key Screens:**
- **Provider Dashboard**: Overview of all configured providers with account status
- **Model Manager**: Set default models for each routing scenario
- **Preset Editor**: Create presets with conditional fields and templates
- **Usage Analytics**: Monitor API consumption, costs, and performance
- **System Status**: Health checks, service logs, and diagnostics

Access the UI with:
```bash
ccr ui
```

## 📋 CLI Commands Reference

### Service Management
```bash
ccr start              # Start the router service
ccr stop               # Stop the router service
ccr restart            # Restart the service
ccr status             # Show service status
ccr logs               # Display service logs
```

### Code Execution
```bash
ccr code               # Start interactive Claude Code session
ccr code -p "prompt"   # Run non-interactive with prompt
```

### Model Management
```bash
ccr model              # Interactive model selector
ccr models             # List all available models
ccr models --json      # Output as JSON
```

### Preset Management
```bash
ccr preset export <name> [options]     # Export current config as preset
ccr preset install <path>              # Install preset from directory
ccr preset install <url>               # Install preset from URL
ccr preset list                        # List installed presets
ccr preset info <name>                 # Show preset details
ccr preset delete <name>               # Remove a preset
```

### Configuration
```bash
ccr activate           # Output environment variables
eval "$(ccr activate)" # Set environment variables in shell
ccr config             # Open config file in editor
```

#### Providers

The `Providers` array is where you define the different model providers you want to use. Each provider object requires:

- `name`: A unique name for the provider.
- `api_base_url`: The full API endpoint for chat completions.
- `api_key`: Your API key for the provider.
- `models`: A list of model names available from this provider.
- `transformer` (optional): Specifies transformers to process requests and responses.

#### Transformers

Transformers allow you to modify the request and response payloads to ensure compatibility with different provider APIs.

- **Global Transformer**: Apply a transformer to all models from a provider. In this example, the `openrouter` transformer is applied to all models under the `openrouter` provider.
  ```json
  {
    "name": "openrouter",
    "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
    "api_key": "sk-xxx",
    "models": [
      "google/gemini-2.5-pro-preview",
      "anthropic/claude-sonnet-4",
      "anthropic/claude-3.5-sonnet"
    ],
    "transformer": { "use": ["openrouter"] }
  }
  ```
- **Model-Specific Transformer**: Apply a transformer to a specific model. In this example, the `deepseek` transformer is applied to all models, and an additional `tooluse` transformer is applied only to the `deepseek-chat` model.

  ```json
  {
    "name": "deepseek",
    "api_base_url": "https://api.deepseek.com/chat/completions",
    "api_key": "sk-xxx",
    "models": ["deepseek-chat", "deepseek-reasoner"],
    "transformer": {
      "use": ["deepseek"],
      "deepseek-chat": { "use": ["tooluse"] }
    }
  }
  ```

- **Passing Options to a Transformer**: Some transformers, like `maxtoken`, accept options. To pass options, use a nested array where the first element is the transformer name and the second is an options object.
  ```json
  {
    "name": "siliconflow",
    "api_base_url": "https://api.siliconflow.cn/v1/chat/completions",
    "api_key": "sk-xxx",
    "models": ["moonshotai/Kimi-K2-Instruct"],
    "transformer": {
      "use": [
        [
          "maxtoken",
          {
            "max_tokens": 16384
          }
        ]
      ]
    }
  }
  ```

**Available Built-in Transformers:**

- `Anthropic`:If you use only the `Anthropic` transformer, it will preserve the original request and response parameters(you can use it to connect directly to an Anthropic endpoint).
- `deepseek`: Adapts requests/responses for DeepSeek API.
- `gemini`: Adapts requests/responses for Gemini API.
- `openrouter`: Adapts requests/responses for OpenRouter API. It can also accept a `provider` routing parameter to specify which underlying providers OpenRouter should use. For more details, refer to the [OpenRouter documentation](https://openrouter.ai/docs/features/provider-routing). See an example below:
  ```json
    "transformer": {
      "use": ["openrouter"],
      "moonshotai/kimi-k2": {
        "use": [
          [
            "openrouter",
            {
              "provider": {
                "only": ["moonshotai/fp8"]
              }
            }
          ]
        ]
      }
    }
  ```
- `groq`: Adapts requests/responses for groq API.
- `maxtoken`: Sets a specific `max_tokens` value.
- `tooluse`: Optimizes tool usage for certain models via `tool_choice`.
- `gemini-cli` (experimental): Unofficial support for Gemini via Gemini CLI [gemini-cli.js](https://gist.github.com/musistudio/1c13a65f35916a7ab690649d3df8d1cd).
- `reasoning`: Used to process the `reasoning_content` field.
- `sampling`: Used to process sampling information fields such as `temperature`, `top_p`, `top_k`, and `repetition_penalty`.
- `enhancetool`: Adds a layer of error tolerance to the tool call parameters returned by the LLM (this will cause the tool call information to no longer be streamed).
- `cleancache`: Clears the `cache_control` field from requests.
- `vertex-gemini`: Handles the Gemini API using Vertex authentication.
- `chutes-glm` Unofficial support for GLM 4.5 model via Chutes [chutes-glm-transformer.js](https://gist.github.com/vitobotta/2be3f33722e05e8d4f9d2b0138b8c863).
- `qwen-cli` (experimental): Unofficial support for qwen3-coder-plus model via Qwen CLI [qwen-cli.js](https://gist.github.com/musistudio/f5a67841ced39912fd99e42200d5ca8b).
- `rovo-cli` (experimental): Unofficial support for gpt-5 via Atlassian Rovo Dev CLI [rovo-cli.js](https://gist.github.com/SaseQ/c2a20a38b11276537ec5332d1f7a5e53).

**Custom Transformers:**

You can also create your own transformers and load them via the `transformers` field in `config.json`.

```json
{
  "transformers": [
    {
      "path": "/User/xxx/.claude-code-router/plugins/gemini-cli.js",
      "options": {
        "project": "xxx"
      }
    }
  ]
}
```

#### Router

The `Router` object defines which model to use for different scenarios:

- `default`: The default model for general tasks.
- `background`: A model for background tasks. This can be a smaller, local model to save costs.
- `think`: A model for reasoning-heavy tasks, like Plan Mode.
- `longContext`: A model for handling long contexts (e.g., > 60K tokens).
- `longContextThreshold` (optional): The token count threshold for triggering the long context model. Defaults to 60000 if not specified.
- `webSearch`: Used for handling web search tasks and this requires the model itself to support the feature. If you're using openrouter, you need to add the `:online` suffix after the model name.
- `image` (beta): Used for handling image-related tasks (supported by CCR’s built-in agent). If the model does not support tool calling, you need to set the `config.forceUseImageAgent` property to `true`.

- You can also switch models dynamically in Claude Code with the `/model` command:
`/model provider_name,model_name`
Example: `/model openrouter,anthropic/claude-3.5-sonnet`

#### Custom Router

For more advanced routing logic, you can specify a custom router script via the `CUSTOM_ROUTER_PATH` in your `config.json`. This allows you to implement complex routing rules beyond the default scenarios.

In your `config.json`:

```json
{
  "CUSTOM_ROUTER_PATH": "/User/xxx/.claude-code-router/custom-router.js"
}
```

The custom router file must be a JavaScript module that exports an `async` function. This function receives the request object and the config object as arguments and should return the provider and model name as a string (e.g., `"provider_name,model_name"`), or `null` to fall back to the default router.

Here is an example of a `custom-router.js` based on `custom-router.example.js`:

```javascript
// /User/xxx/.claude-code-router/custom-router.js

/**
 * A custom router function to determine which model to use based on the request.
 *
 * @param {object} req - The request object from Claude Code, containing the request body.
 * @param {object} config - The application's config object.
 * @returns {Promise<string|null>} - A promise that resolves to the "provider,model_name" string, or null to use the default router.
 */
module.exports = async function router(req, config) {
  const userMessage = req.body.messages.find((m) => m.role === "user")?.content;

  if (userMessage && userMessage.includes("explain this code")) {
    // Use a powerful model for code explanation
    return "openrouter,anthropic/claude-3.5-sonnet";
  }

  // Fallback to the default router configuration
  return null;
};
```

##### Subagent Routing

For routing within subagents, you must specify a particular provider and model by including `<CCR-SUBAGENT-MODEL>provider,model</CCR-SUBAGENT-MODEL>` at the **beginning** of the subagent's prompt. This allows you to direct specific subagent tasks to designated models.

**Example:**

```
<CCR-SUBAGENT-MODEL>openrouter,anthropic/claude-3.5-sonnet</CCR-SUBAGENT-MODEL>
Please help me analyze this code snippet for potential optimizations...
```

## Status Line (Beta)
To better monitor the status of claude-code-router at runtime, version v1.0.40 includes a built-in statusline tool, which you can enable in the UI.
![statusline-config.png](/blog/images/statusline-config.png)

The effect is as follows:
![statusline](/blog/images/statusline.png)

## 🤖 GitHub Actions

Integrate Claude Code Router into your CI/CD pipeline. After setting up [Claude Code Actions](https://docs.anthropic.com/en/docs/claude-code/github-actions), modify your `.github/workflows/claude.yaml` to use the router:

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  # ... other triggers

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      # ... other conditions
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Prepare Environment
        run: |
          curl -fsSL https://bun.sh/install | bash
          mkdir -p $HOME/.claude-code-router
          cat << 'EOF' > $HOME/.claude-code-router/config.json
          {
            "log": true,
            "NON_INTERACTIVE_MODE": true,
            "OPENAI_API_KEY": "${{ secrets.OPENAI_API_KEY }}",
            "OPENAI_BASE_URL": "https://api.deepseek.com",
            "OPENAI_MODEL": "deepseek-chat"
          }
          EOF
        shell: bash

      - name: Start Claude Code Router
        run: |
          nohup ~/.bun/bin/bunx @musistudio/claude-code-router@1.0.8 start &
        shell: bash

      - name: Run Claude Code
        id: claude
        uses: anthropics/claude-code-action@beta
        env:
          ANTHROPIC_BASE_URL: http://localhost:3456
        with:
          anthropic_api_key: "any-string-is-ok"
```

> **Note**: When running in GitHub Actions or other automation environments, make sure to set `"NON_INTERACTIVE_MODE": true` in your configuration to prevent the process from hanging due to stdin handling issues.

This setup allows for interesting automations, like running tasks during off-peak hours to reduce API costs.

## 📝 Further Reading

- [Project Motivation and How It Works](blog/en/project-motivation-and-how-it-works.md)
- [Maybe We Can Do More with the Router](blog/en/maybe-we-can-do-more-with-the-route.md)
- [GLM-4.6 Supports Reasoning and Interleaved Thinking](blog/en/glm-4.6-supports-reasoning.md)

## ❤️ Support & Sponsoring

If you find this project helpful, please consider sponsoring its development. Your support is greatly appreciated!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F31GN2GM)

[Paypal](https://paypal.me/musistudio1999)

<table>
  <tr>
    <td><img src="/blog/images/alipay.jpg" width="200" alt="Alipay" /></td>
    <td><img src="/blog/images/wechat.jpg" width="200" alt="WeChat Pay" /></td>
  </tr>
</table>

### Our Sponsors

A huge thank you to all our sponsors for their generous support!


- [AIHubmix](https://aihubmix.com/)
- [BurnCloud](https://ai.burncloud.com)
- [302.AI](https://share.302.ai/ZGVF9w)
- [Z智谱](https://www.bigmodel.cn/claude-code?ic=FPF9IVAGFJ)
- @Simon Leischnig
- [@duanshuaimin](https://github.com/duanshuaimin)
- [@vrgitadmin](https://github.com/vrgitadmin)
- @\*o
- [@ceilwoo](https://github.com/ceilwoo)
- @\*说
- @\*更
- @K\*g
- @R\*R
- [@bobleer](https://github.com/bobleer)
- @\*苗
- @\*划
- [@Clarence-pan](https://github.com/Clarence-pan)
- [@carter003](https://github.com/carter003)
- @S\*r
- @\*晖
- @\*敏
- @Z\*z
- @\*然
- [@cluic](https://github.com/cluic)
- @\*苗
- [@PromptExpert](https://github.com/PromptExpert)
- @\*应
- [@yusnake](https://github.com/yusnake)
- @\*飞
- @董\*
- @\*汀
- @\*涯
- @\*:-）
- @\*\*磊
- @\*琢
- @\*成
- @Z\*o
- @\*琨
- [@congzhangzh](https://github.com/congzhangzh)
- @\*\_
- @Z\*m
- @*鑫
- @c\*y
- @\*昕
- [@witsice](https://github.com/witsice)
- @b\*g
- @\*亿
- @\*辉
- @JACK
- @\*光
- @W\*l
- [@kesku](https://github.com/kesku)
- [@biguncle](https://github.com/biguncle)
- @二吉吉
- @a\*g
- @\*林
- @\*咸
- @\*明
- @S\*y
- @f\*o
- @\*智
- @F\*t
- @r\*c
- [@qierkang](http://github.com/qierkang)
- @\*军
- [@snrise-z](http://github.com/snrise-z)
- @\*王
- [@greatheart1000](http://github.com/greatheart1000)
- @\*王
- @zcutlip
- [@Peng-YM](http://github.com/Peng-YM)
- @\*更
- @\*.
- @F\*t
- @\*政
- @\*铭
- @\*叶
- @七\*o
- @\*青
- @\*\*晨
- @\*远
- @\*霄
- @\*\*吉
- @\*\*飞
- @\*\*驰
- @x\*g
- @\*\*东
- @\*落
- @哆\*k
- @\*涛
- [@苗大](https://github.com/WitMiao)
- @\*呢
- @\d*u
- @crizcraig
- s\*s
- \*火
- \*勤
- \*\*锟
- \*涛
- \*\*明
- \*知
- \*语
- \*瓜


(If your name is masked, please contact me via my homepage email to update it with your GitHub username.)
