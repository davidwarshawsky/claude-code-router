import fs from 'fs';
import path from 'path';

export interface UsageData {
  day: string;
  accounts: Record<string, AccountUsage>;
}

export interface AccountUsage {
  used: number;
  limit?: number;
  email?: string;
  lastReset?: string;
}

/**
 * UsageService tracks token/neuron usage by account ID or email
 * Persists data locally to a usage.json file
 */
export class UsageService {
  private usageFile: string;
  private currentUsage: UsageData;
  private logger: any;

  constructor(baseDir: string, logger?: any) {
    this.usageFile = path.join(baseDir, 'usage.json');
    this.logger = logger || console;
    this.currentUsage = this.loadUsage();
  }

  /**
   * Load usage data from disk, reset if day changed
   */
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

  /**
   * Save usage data to disk
   */
  private saveUsage(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.usageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.usageFile, JSON.stringify(this.currentUsage, null, 2));
    } catch (error: any) {
      this.logger.error(`[UsageService] Failed to save usage data: ${error.message}`);
    }
  }

  /**
   * Record usage for an account (by email or key)
   * Handles both regular tokens and provider-specific metrics (e.g., Cloudflare neurons)
   */
  public recordUsage(
    emailOrKey: string,
    tokens: number,
    type: 'neurons' | 'tokens' = 'tokens',
    provider?: string
  ): void {
    if (!emailOrKey) {
      this.logger.warn('[UsageService] No email or key provided for usage tracking');
      return;
    }

    if (!this.currentUsage.accounts[emailOrKey]) {
      this.currentUsage.accounts[emailOrKey] = {
        used: 0,
        email: emailOrKey.includes('@') ? emailOrKey : undefined,
      };
    }

    // Apply provider-specific multipliers
    let adjustedTokens = tokens;
    if (provider === 'cloudflare' && type === 'tokens') {
      // Cloudflare uses "neurons" with input multiplier of ~2457
      // This is a conservative estimate; adjust based on actual model costs
      adjustedTokens = Math.ceil(tokens * 2.457);
    }

    const previousUsed = this.currentUsage.accounts[emailOrKey].used;
    this.currentUsage.accounts[emailOrKey].used += adjustedTokens;

    this.logger.info(
      `[UsageService] ${emailOrKey}: ${previousUsed} + ${adjustedTokens} (${type}) = ${this.currentUsage.accounts[emailOrKey].used} total`
    );

    this.saveUsage();
  }

  /**
   * Get usage for a specific account
   */
  public getUsage(emailOrKey: string): AccountUsage | undefined {
    return this.currentUsage.accounts[emailOrKey];
  }

  /**
   * Get all usage data
   */
  public getAllUsage(): UsageData {
    return this.currentUsage;
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
   * Reset usage for a specific account
   */
  public resetAccount(emailOrKey: string): void {
    if (this.currentUsage.accounts[emailOrKey]) {
      this.currentUsage.accounts[emailOrKey].used = 0;
      this.currentUsage.accounts[emailOrKey].lastReset = new Date().toISOString();
      this.saveUsage();
      this.logger.info(`[UsageService] Reset usage for ${emailOrKey}`);
    }
  }

  /**
   * Reset all usage counters
   */
  public resetAll(): void {
    this.currentUsage = {
      day: new Date().toISOString().slice(0, 10),
      accounts: {},
    };
    this.saveUsage();
    this.logger.info('[UsageService] Reset all usage counters');
  }
}
