/**
 * OmniRoute API Client
 * Handles authentication, model catalog, and chat completions via OmniRoute gateway
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.omiroute');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const CACHE_FILE = join(CONFIG_DIR, 'model-cache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class OmniRouteClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128';
    this.apiKey = options.apiKey || process.env.OMNIROUTE_API_KEY;
    this.timeout = options.timeout || 120000;
    this._modelCache = null;
  }

  /**
   * Load config from file
   */
  static loadConfig() {
    if (existsSync(CONFIG_FILE)) {
      try {
        return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      } catch {
        return {};
      }
    }
    return {};
  }

  /**
   * Save config to file
   */
  static saveConfig(config) {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  /**
   * Get API key from config or env
   */
  static getApiKey() {
    const config = this.loadConfig();
    return config.apiKey || process.env.OMNIROUTE_API_KEY;
  }

  /**
   * Get base URL from config or env
   */
  static getBaseUrl() {
    const config = this.loadConfig();
      return config.baseUrl || process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128';
  }

  /**
   * Create client from config
   */
  static fromConfig() {
    return new OmniRouteClient({
      baseUrl: this.getBaseUrl(),
      apiKey: this.getApiKey()
    });
  }

  /**
   * Make authenticated request
   */
  async request(endpoint, options = {}) {
    if (!this.apiKey) {
      throw new Error('OmniRoute API key not configured. Run: omniroute setup-claude --api-key YOUR_KEY');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey,
      ...options.headers
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OmniRoute API error (${response.status}): ${error}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get model catalog (with caching)
   */
  async getModels(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this._modelCache) {
      return this._modelCache;
    }

    if (!forceRefresh && existsSync(CACHE_FILE)) {
      try {
        const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          this._modelCache = cached.models;
          return this._modelCache;
        }
      } catch {
        // Ignore cache errors
      }
    }

    // Fetch from API
    const response = await this.request('/v1/models');
    const models = response.data || response.models || [];

    // Cache the result
    this._modelCache = models;
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CACHE_FILE, JSON.stringify({
      timestamp: Date.now(),
      models
    }, null, 2));

    return models;
  }

  /**
   * Chat completions (OpenAI-compatible)
   */
  async chatCompletions(params) {
    return this.request('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  /**
   * Streaming chat completions
   */
  async *chatCompletionsStream(params) {
    if (!this.apiKey) {
      throw new Error('OmniRoute API key not configured');
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.apiKey,
      'Accept': 'text/event-stream'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...params, stream: true })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OmniRoute API error (${response.status}): ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.request('/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get model by ID
   */
  async getModel(modelId) {
    const models = await this.getModels();
    return models.find(m => m.id === modelId);
  }

  /**
   * Find models by capability
   */
  async findModels(capabilities = []) {
    const models = await this.getModels();
    return models.filter(model => {
      if (!capabilities.length) return true;
      const modelCaps = model.capabilities || [];
      return capabilities.every(cap => modelCaps.includes(cap));
    });
  }
}

export default OmniRouteClient;