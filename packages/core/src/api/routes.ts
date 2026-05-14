import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { RegisterProviderRequest, LLMProvider } from "@/types/llm";
import { sendUnifiedRequest } from "@/utils/request";
import { createApiError } from "./middleware";
import { version } from "../../package.json";
import { ConfigService } from "@/services/config";
import { ProviderService } from "@/services/provider";
import { TransformerService } from "@/services/transformer";
import { Transformer } from "@/types/transformer";

// Extend FastifyInstance to include custom services
declare module "fastify" {
  interface FastifyInstance {
    configService: ConfigService;
    providerService: ProviderService;
    transformerService: TransformerService;
  }

  interface FastifyRequest {
    provider?: string;
  }
}

/**
 * Main handler for transformer endpoints
 * Coordinates the entire request processing flow: validate provider, handle request transformers,
 * send request, handle response transformers, format response
 */
async function handleTransformerEndpoint(
  req: FastifyRequest,
  reply: FastifyReply,
  fastify: FastifyInstance,
  transformer: any
) {
  const body = req.body as any;
  const providerName = req.provider!;
  const provider = fastify.providerService.getProvider(providerName);

  // Validate provider exists
  if (!provider) {
    throw createApiError(
      `Provider '${providerName}' not found`,
      404,
      "provider_not_found"
    );
  }

  try {
    // Process request transformer chain
    const { requestBody, config, bypass } = await processRequestTransformers(
      body,
      provider,
      transformer,
      req.headers,
      {
        req,
      }
    );

    // Send request to LLM provider
    const response = await sendRequestToProvider(
      requestBody,
      config,
      provider,
      fastify,
      bypass,
      transformer,
      {
        req,
      }
    );

    // Process response transformer chain
    const finalResponse = await processResponseTransformers(
      requestBody,
      response,
      provider,
      transformer,
      bypass,
      {
        req,
      }
    );

    // Format and return response
    return formatResponse(finalResponse, reply, body);
  } catch (error: any) {
    // Handle fallback if error occurs
    if (error.code === 'provider_response_error') {
      const fallbackResult = await handleFallback(req, reply, fastify, transformer, error);
      if (fallbackResult) {
        return fallbackResult;
      }
    }
    throw error;
  }
}

/**
 * Handle fallback logic when request fails
 * Tries each fallback model in sequence until one succeeds
 */
async function handleFallback(
  req: FastifyRequest,
  reply: FastifyReply,
  fastify: FastifyInstance,
  transformer: any,
  error: any
): Promise<any> {
  const scenarioType = (req as any).scenarioType || 'default';
  const fallbackConfig = fastify.configService.get<any>('fallback');

  if (!fallbackConfig || !fallbackConfig[scenarioType]) {
    return null;
  }

  const fallbackList = fallbackConfig[scenarioType] as string[];
  if (!Array.isArray(fallbackList) || fallbackList.length === 0) {
    return null;
  }

  req.log.warn(`Request failed for ${(req as any).scenarioType}, trying ${fallbackList.length} fallback models`);

  // Try each fallback model in sequence
  for (const fallbackModel of fallbackList) {
    try {
      req.log.info(`Trying fallback model: ${fallbackModel}`);

      // Update request with fallback model
      const newBody = { ...(req.body as any) };
      const [fallbackProvider, ...fallbackModelName] = fallbackModel.split(',');
      newBody.model = fallbackModelName.join(',');

      // Create new request object with updated provider and body
      const newReq = {
        ...req,
        provider: fallbackProvider,
        body: newBody,
      };

      const provider = fastify.providerService.getProvider(fallbackProvider);
      if (!provider) {
        req.log.warn(`Fallback provider '${fallbackProvider}' not found, skipping`);
        continue;
      }

      // Process request transformer chain
      const { requestBody, config, bypass } = await processRequestTransformers(
        newBody,
        provider,
        transformer,
        req.headers,
        { req: newReq }
      );

      // Send request to LLM provider
      const response = await sendRequestToProvider(
        requestBody,
        config,
        provider,
        fastify,
        bypass,
        transformer,
        { req: newReq }
      );

      // Process response transformer chain
      const finalResponse = await processResponseTransformers(
        requestBody,
        response,
        provider,
        transformer,
        bypass,
        { req: newReq }
      );

      req.log.info(`Fallback model ${fallbackModel} succeeded`);

      // Format and return response
      return formatResponse(finalResponse, reply, newBody);
    } catch (fallbackError: any) {
      req.log.warn(`Fallback model ${fallbackModel} failed: ${fallbackError.message}`);
      continue;
    }
  }

  req.log.error(`All fallback models failed for yichu ${scenarioType}`);
  return null;
}

/**
 * Process request transformer chain
 * Sequentially execute transformRequestOut, provider transformers, model-specific transformers
 * Returns processed request body, config, and flag indicating whether to skip transformers
 */
async function processRequestTransformers(
  body: any,
  provider: any,
  transformer: any,
  headers: any,
  context: any
) {
  let requestBody = body;
  let config: any = {};
  let bypass = false;

  // Check if transformers should be bypassed (passthrough mode)
  bypass = shouldBypassTransformers(provider, transformer, body);

  if (bypass) {
    if (headers instanceof Headers) {
      headers.delete("content-length");
    } else {
      delete headers["content-length"];
    }
    config.headers = headers;
  }

  // Execute transformer's transformRequestOut method
  if (!bypass && typeof transformer.transformRequestOut === "function") {
    const transformOut = await transformer.transformRequestOut(requestBody);
    if (transformOut.body) {
      requestBody = transformOut.body;
      config = transformOut.config || {};
    } else {
      requestBody = transformOut;
    }
  }

  // Execute provider-level transformers
  if (!bypass && provider.transformer?.use?.length) {
    for (const providerTransformer of provider.transformer.use) {
      if (
        !providerTransformer ||
        typeof providerTransformer.transformRequestIn !== "function"
      ) {
        continue;
      }
      const transformIn = await providerTransformer.transformRequestIn(
        requestBody,
        provider,
        context
      );
      if (transformIn.body) {
        requestBody = transformIn.body;
        config = { ...config, ...transformIn.config };
      } else {
        requestBody = transformIn;
      }
    }
  }

  // Execute model-specific transformers
  if (!bypass && provider.transformer?.[body.model]?.use?.length) {
    for (const modelTransformer of provider.transformer[body.model].use) {
      if (
        !modelTransformer ||
        typeof modelTransformer.transformRequestIn !== "function"
      ) {
        continue;
      }
      requestBody = await modelTransformer.transformRequestIn(
        requestBody,
        provider,
        context
      );
    }
  }

  return { requestBody, config, bypass };
}

/**
 * Determine if transformers should be bypassed (passthrough mode)
 * Skip other transformers when provider only uses one transformer and it matches the current one
 */
function shouldBypassTransformers(
  provider: any,
  transformer: any,
  body: any
): boolean {
  return (
    provider.transformer?.use?.length === 1 &&
    provider.transformer.use[0].name === transformer.name &&
    (!provider.transformer?.[body.model]?.use.length ||
      (provider.transformer?.[body.model]?.use.length === 1 &&
        provider.transformer?.[body.model]?.use[0].name === transformer.name))
  );
}

/**
 * Send request to LLM provider
 * Handle authentication, build request config, send request and handle errors
 */
/**
 * Send request to LLM provider with multi-account support and key rotation
 * Tries each available account in sequence, handling exhaustion and rate limits
 */
async function sendRequestToProvider(
  requestBody: any,
  config: any,
  provider: any,
  fastify: FastifyInstance,
  bypass: boolean,
  transformer: any,
  context: any
) {
  const baseRequestUrl = config.url || provider.baseUrl;

  // Handle authentication in passthrough mode
  if (bypass && typeof transformer.auth === "function") {
    const auth = await transformer.auth(requestBody, provider);
    if (auth.body) {
      requestBody = auth.body;
      let headers = config.headers || {};
      if (auth.config?.headers) {
        headers = {
          ...headers,
          ...auth.config.headers,
        };
        delete headers.host;
        delete auth.config.headers;
      }
      config = {
        ...config,
        ...auth.config,
        headers,
      };
    } else {
      requestBody = auth;
    }
  }

  // Key rotation logic: try each account in sequence
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

  for (const account of accounts) {
    const accountIdentifier = account.email || account.label || account.key?.substring(0, 8) || 'unknown';
    
    // Skip exhausted accounts (check UsageService for persistent state)
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
      // Handle URL templates (e.g., {account_id} for Cloudflare)
      const urlStr =
        baseRequestUrl instanceof URL
          ? baseRequestUrl.toString()
          : String(baseRequestUrl);
      fastify.log.info(`[Router] Original URL: ${urlStr}`);

      const templatedUrl =
        account.id && urlStr.includes('{account_id}')
          ? urlStr.replace(/{account_id}/g, account.id)
          : urlStr;

      if (templatedUrl !== urlStr) {
        fastify.log.info(`[Router] Templated URL: ${templatedUrl}`);
      } else {
        fastify.log.info(`[Router] No {account_id} placeholder or no account.id`);
      }

      const requestUrl = new URL(templatedUrl);

      // Prepare headers with this account's key
      const requestHeaders: Record<string, string> = {
        Authorization: `Bearer ${account.key}`,
        ...(config?.headers || {}),
      };

      // Clean up undefined values
      for (const key in requestHeaders) {
        if (requestHeaders[key] === "undefined") {
          delete requestHeaders[key];
        } else if (
          ["authorization", "Authorization"].includes(key) &&
          requestHeaders[key]?.includes("undefined")
        ) {
          delete requestHeaders[key];
        }
      }

      fastify.log.info(`[Router] Attempting request with account: ${accountIdentifier}`);
      fastify.log.info(`[Router] Request URL: ${requestUrl.toString()}`);

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

      // Handle request errors
      if (!response.ok) {
        const errorText = await response.text();
        const errorStatus = response.status;

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

        // For non-exhaustion errors or if this is the last account, throw the error
        fastify.log.error(
          `[provider_response_error] Error from provider(${provider.name},${requestBody.model}) via ${accountIdentifier}: ${errorStatus}): ${errorText}`,
        );
        lastError = new Error(`Error from provider(${provider.name},${requestBody.model}): HTTP ${errorStatus}`);
        
        // If this is the last account, throw immediately
        if (attemptedAccounts.size === accounts.length) {
          throw createApiError(
            `Error from provider(${provider.name},${requestBody.model}: ${errorStatus}): ${errorText}`,
            errorStatus,
            "provider_response_error"
          );
        }
        // Otherwise continue to next account
        continue;
      }

      // Success! Record usage and return response
      fastify.log.info(`[Router] Request succeeded with account: ${accountIdentifier}`);
      
      // Record usage if UsageService is available
      if (fastify.usageService) {
        const usageKey = account.email || account.key;
        // Extract token usage from response if available (e.g., from usage field)
        let tokensUsed = requestBody.max_tokens || 0;
        try {
          const responseClone = response.clone();
          const contentType = responseClone.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const responseData = await responseClone.json();
            // Check for usage field in response (Anthropic format)
            if (responseData.usage?.output_tokens) {
              tokensUsed = responseData.usage.output_tokens;
            }
            // Check for alternative usage fields
            if (responseData.usage?.total_tokens) {
              tokensUsed = responseData.usage.total_tokens;
            }
          }
        } catch (err) {
          // If we can't parse response, fall back to max_tokens
          fastify.log.debug(`[Router] Could not extract token usage from response: ${err}`);
        }
        fastify.usageService.recordUsage(usageKey, tokensUsed, 'tokens', provider.name);
      }

      return response;

    } catch (err: any) {
      // Network errors, timeouts, etc.
      fastify.log.warn(
        `[Router] Request failed with account ${accountIdentifier}: ${err.message}`
      );
      lastError = err;
      // Continue to next account
      continue;
    }
  }

  // All accounts failed
  fastify.log.error(`[Router] All ${accounts.length} account(s) exhausted or failed for ${provider.name}`);
  throw createApiError(
    `All configured accounts for provider '${provider.name}' are exhausted or failed. Last error: ${lastError?.message || 'Unknown'}`,
    502,
    "all_accounts_failed"
  );
}

/**
 * Process response transformer chain
 * Sequentially execute provider transformers, model-specific transformers, transformer's transformResponseIn
 */
async function processResponseTransformers(
  requestBody: any,
  response: any,
  provider: any,
  transformer: any,
  bypass: boolean,
  context: any
) {
  let finalResponse = response;

  // Execute provider-level response transformers
  if (!bypass && provider.transformer?.use?.length) {
    for (const providerTransformer of Array.from(
      provider.transformer.use
    ).reverse() as Transformer[]) {
      if (
        !providerTransformer ||
        typeof providerTransformer.transformResponseOut !== "function"
      ) {
        continue;
      }
      finalResponse = await providerTransformer.transformResponseOut!(
        finalResponse,
        context
      );
    }
  }

  // Execute model-specific response transformers
  if (!bypass && provider.transformer?.[requestBody.model]?.use?.length) {
    for (const modelTransformer of Array.from(
      provider.transformer[requestBody.model].use
    ).reverse() as Transformer[]) {
      if (
        !modelTransformer ||
        typeof modelTransformer.transformResponseOut !== "function"
      ) {
        continue;
      }
      finalResponse = await modelTransformer.transformResponseOut!(
        finalResponse,
        context
      );
    }
  }

  // Execute transformer's transformResponseIn method
  if (!bypass && transformer.transformResponseIn) {
    finalResponse = await transformer.transformResponseIn(
      finalResponse,
      context
    );
  }

  return finalResponse;
}

/**
 * Format and return response
 * Handle HTTP status codes, format streaming and regular responses
 */
function formatResponse(response: any, reply: FastifyReply, body: any) {
  // Set HTTP status code
  if (!response.ok) {
    reply.code(response.status);
  }

  // Handle streaming response
  const isStream = body.stream === true;
  if (isStream) {
    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    return reply.send(response.body);
  } else {
    // Handle regular JSON response
    return response.json();
  }
}

export const registerApiRoutes = async (
  fastify: FastifyInstance
) => {
  // Health and info endpoints
  fastify.get("/", async () => {
    return { message: "LLMs API", version };
  });

  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  const transformersWithEndpoint =
    fastify.transformerService.getTransformersWithEndpoint();

  for (const { transformer } of transformersWithEndpoint) {
    if (transformer.endPoint) {
      fastify.post(
        transformer.endPoint,
        async (req: FastifyRequest, reply: FastifyReply) => {
          return handleTransformerEndpoint(req, reply, fastify, transformer);
        }
      );
    }
  }

  fastify.post(
    "/providers",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["openai", "anthropic"] },
            baseUrl: { type: "string" },
            apiKey: { type: "string" },
            models: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name", "type", "baseUrl", "apiKey", "models"],
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RegisterProviderRequest }>,
      reply: FastifyReply
    ) => {
      // Validation
      const { name, baseUrl, apiKey, models } = request.body;

      if (!name?.trim()) {
        throw createApiError(
          "Provider name is required",
          400,
          "invalid_request"
        );
      }

      if (!baseUrl || !isValidUrl(baseUrl)) {
        throw createApiError(
          "Valid base URL is required",
          400,
          "invalid_request"
        );
      }

      if (!apiKey?.trim()) {
        throw createApiError("API key is required", 400, "invalid_request");
      }

      if (!models || !Array.isArray(models) || models.length === 0) {
        throw createApiError(
          "At least one model is required",
          400,
          "invalid_request"
        );
      }

      // Check if provider already exists
      if (fastify.providerService.getProvider(request.body.name)) {
        throw createApiError(
          `Provider with name '${request.body.name}' already exists`,
          400,
          "provider_exists"
        );
      }

      return fastify.providerService.registerProvider(request.body);
    }
  );

  fastify.get("/providers", async () => {
    return fastify.providerService.getProviders();
  });

  fastify.get(
    "/providers/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const provider = fastify.providerService.getProvider(
        request.params.id
      );
      if (!provider) {
        throw createApiError("Provider not found", 404, "provider_not_found");
      }
      return provider;
    }
  );

  fastify.put(
    "/providers/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", enum: ["openai", "anthropic"] },
            baseUrl: { type: "string" },
            apiKey: { type: "string" },
            models: { type: "array", items: { type: "string" } },
            enabled: { type: "boolean" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: Partial<LLMProvider>;
      }>,
      reply
    ) => {
      const provider = fastify.providerService.updateProvider(
        request.params.id,
        request.body
      );
      if (!provider) {
        throw createApiError("Provider not found", 404, "provider_not_found");
      }
      return provider;
    }
  );

  fastify.delete(
    "/providers/:id",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const success = fastify.providerService.deleteProvider(
        request.params.id
      );
      if (!success) {
        throw createApiError("Provider not found", 404, "provider_not_found");
      }
      return { message: "Provider deleted successfully" };
    }
  );

  fastify.patch(
    "/providers/:id/toggle",
    {
      schema: {
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
          required: ["enabled"],
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { enabled: boolean };
      }>,
      reply
    ) => {
      const success = fastify.providerService.toggleProvider(
        request.params.id,
        request.body.enabled
      );
      if (!success) {
        throw createApiError("Provider not found", 404, "provider_not_found");
      }
      return {
        message: `Provider ${
          request.body.enabled ? "enabled" : "disabled"
        } successfully`,
      };
    }
  );

  // Dynamic model discovery endpoints
  fastify.get("/v1/models", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const models = await fastify.providerService.getAvailableModels();
      return models;
    } catch (error: any) {
      throw createApiError(
        `Failed to retrieve models: ${error.message}`,
        500,
        "models_fetch_error"
      );
    }
  });

  fastify.post(
    "/refresh-models",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        fastify.log.info("[Routes] Refreshing models from dynamic discovery endpoints");
        await fastify.providerService.refreshDynamicModels();
        const models = await fastify.providerService.getAvailableModels();
        return {
          success: true,
          message: "Models refreshed successfully",
          modelCount: models.data.length,
          models: models,
        };
      } catch (error: any) {
        throw createApiError(
          `Failed to refresh models: ${error.message}`,
          500,
          "models_refresh_error"
        );
      }
    }
  );

  // Usage tracking endpoint
  fastify.get("/api/usage", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!fastify.usageService) {
        return {
          error: "Usage service not initialized",
          usage: null,
        };
      }
      const usage = fastify.usageService.getAllUsage();
      return {
        success: true,
        usage,
      };
    } catch (error: any) {
      throw createApiError(
        `Failed to retrieve usage data: ${error.message}`,
        500,
        "usage_fetch_error"
      );
    }
  });

  // Account status endpoint
  fastify.get("/api/providers/:name/accounts", async (
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const provider = fastify.providerService.getProvider(request.params.name);
      if (!provider) {
        throw createApiError("Provider not found", 404, "provider_not_found");
      }

      const accounts = (provider.accounts || []).map((acc: any) => ({
        email: acc.email,
        label: acc.label,
        status: acc.status || 'active',
        id: acc.id,
        keyPrefix: acc.key?.substring(0, 8) + '...',
        usage: fastify.usageService?.getUsage(acc.email || acc.key),
      }));

      return {
        provider: provider.name,
        accountCount: accounts.length,
        accounts,
      };
    } catch (error: any) {
      throw createApiError(
        `Failed to retrieve account information: ${error.message}`,
        500,
        "accounts_fetch_error"
      );
    }
  });
};


// Helper function
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
