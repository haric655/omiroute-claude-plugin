/**
 * Model Selector
 * Intelligently picks the best model for a given task type
 */

import { OmniRouteClient } from './omniroute-client.mjs';

export const TASK_TYPES = {
  CODE_REVIEW: 'code_review',
  ADVERSARIAL_REVIEW: 'adversarial_review',
  SECURITY_AUDIT: 'security_audit',
  REFACTORING: 'refactoring',
  DEBUGGING: 'debugging',
  DOCUMENTATION: 'documentation',
  TESTING: 'testing',
  GENERAL_CODING: 'general_coding',
  ARCHITECTURE: 'architecture',
  QUICK_FIX: 'quick_fix'
};

export const MODEL_CATEGORIES = {
  REASONING: 'reasoning',      // o1, o3, deepseek-r1, etc.
  CODING: 'coding',            // claude-3.5-sonnet, gpt-4o, etc.
  FAST: 'fast',                // haiku, gpt-4o-mini, etc.
  LONG_CONTEXT: 'long_context' // 100k+ context models
};

const TASK_MODEL_PREFERENCES = {
  [TASK_TYPES.CODE_REVIEW]: {
    primary: [MODEL_CATEGORIES.REASONING, MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.CODING, MODEL_CATEGORIES.FAST],
    minContext: 32000,
    preferCapabilities: ['reasoning', 'code_review']
  },
  [TASK_TYPES.ADVERSARIAL_REVIEW]: {
    primary: [MODEL_CATEGORIES.REASONING],
    fallback: [MODEL_CATEGORIES.CODING],
    minContext: 64000,
    preferCapabilities: ['reasoning', 'code_review', 'security']
  },
  [TASK_TYPES.SECURITY_AUDIT]: {
    primary: [MODEL_CATEGORIES.REASONING, MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.CODING],
    minContext: 64000,
    preferCapabilities: ['reasoning', 'security', 'code_review']
  },
  [TASK_TYPES.REFACTORING]: {
    primary: [MODEL_CATEGORIES.CODING, MODEL_CATEGORIES.REASONING],
    fallback: [MODEL_CATEGORIES.CODING],
    minContext: 32000,
    preferCapabilities: ['coding', 'refactoring']
  },
  [TASK_TYPES.DEBUGGING]: {
    primary: [MODEL_CATEGORIES.CODING, MODEL_CATEGORIES.REASONING],
    fallback: [MODEL_CATEGORIES.FAST],
    minContext: 16000,
    preferCapabilities: ['coding', 'debugging']
  },
  [TASK_TYPES.DOCUMENTATION]: {
    primary: [MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.FAST],
    minContext: 16000,
    preferCapabilities: ['writing', 'documentation']
  },
  [TASK_TYPES.TESTING]: {
    primary: [MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.FAST],
    minContext: 16000,
    preferCapabilities: ['coding', 'testing']
  },
  [TASK_TYPES.GENERAL_CODING]: {
    primary: [MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.FAST, MODEL_CATEGORIES.REASONING],
    minContext: 16000,
    preferCapabilities: ['coding']
  },
  [TASK_TYPES.ARCHITECTURE]: {
    primary: [MODEL_CATEGORIES.REASONING, MODEL_CATEGORIES.CODING],
    fallback: [MODEL_CATEGORIES.CODING],
    minContext: 64000,
    preferCapabilities: ['reasoning', 'architecture']
  },
  [TASK_TYPES.QUICK_FIX]: {
    primary: [MODEL_CATEGORIES.FAST],
    fallback: [MODEL_CATEGORIES.CODING],
    minContext: 8000,
    preferCapabilities: ['coding', 'speed']
  }
};

const CATEGORY_KEYWORDS = {
  [MODEL_CATEGORIES.REASONING]: [
    'o1', 'o3', 'r1', 'reasoning', 'deepseek-r1', 'qwq', 'qwen-qwq',
    'nemotron', 'reasoning', 'thinking'
  ],
  [MODEL_CATEGORIES.CODING]: [
    'claude-3.5-sonnet', 'claude-3.7-sonnet', 'claude-4', 'sonnet',
    'gpt-4o', 'gpt-4-turbo', 'gpt-4.1', 'codestral', 'deepseek-coder',
    'qwen2.5-coder', 'starcoder', 'code-llama', 'wizardcoder'
  ],
  [MODEL_CATEGORIES.FAST]: [
    'haiku', 'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-haiku',
    'gemini-flash', 'mistral-small', 'phi-3', 'llama-3.1-8b'
  ],
  [MODEL_CATEGORIES.LONG_CONTEXT]: [
    'gemini-1.5-pro', 'gemini-2.0', 'claude-3.5-sonnet', 'claude-3.7-sonnet',
    'gpt-4o', 'gpt-4.1', '128k', '200k', '1m', '1000000'
  ]
};

export class ModelSelector {
  constructor(client = null) {
    this.client = client || new OmniRouteClient();
    this._modelCache = null;
  }

  /**
   * Categorize a model based on its ID and capabilities
   */
  categorizeModel(model) {
    const id = (model.id || '').toLowerCase();
    const name = (model.name || '').toLowerCase();
    const caps = (model.capabilities || []).map(c => c.toLowerCase());
    const text = `${id} ${name} ${caps.join(' ')}`;

    const categories = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        categories.push(category);
      }
    }

    // Also check capabilities
    if (caps.includes('reasoning') || caps.includes('thinking')) {
      if (!categories.includes(MODEL_CATEGORIES.REASONING)) {
        categories.push(MODEL_CATEGORIES.REASONING);
      }
    }
    if (caps.includes('coding') || caps.includes('code')) {
      if (!categories.includes(MODEL_CATEGORIES.CODING)) {
        categories.push(MODEL_CATEGORIES.CODING);
      }
    }
    if (caps.includes('speed') || caps.includes('fast')) {
      if (!categories.includes(MODEL_CATEGORIES.FAST)) {
        categories.push(MODEL_CATEGORIES.FAST);
      }
    }

    // Context window check
    const context = model.context_window || model.max_tokens || 0;
    if (context >= 100000) {
      if (!categories.includes(MODEL_CATEGORIES.LONG_CONTEXT)) {
        categories.push(MODEL_CATEGORIES.LONG_CONTEXT);
      }
    }

    return categories.length > 0 ? categories : [MODEL_CATEGORIES.CODING];
  }

  /**
   * Score a model for a specific task type
   */
  scoreModel(model, taskType) {
    const preferences = TASK_MODEL_PREFERENCES[taskType] || TASK_MODEL_PREFERENCES[TASK_TYPES.GENERAL_CODING];
    const categories = this.categorizeModel(model);
    let score = 0;

    // Primary category match
    for (const cat of preferences.primary) {
      if (categories.includes(cat)) {
        score += 100;
        break;
      }
    }

    // Fallback category match
    for (const cat of preferences.fallback) {
      if (categories.includes(cat)) {
        score += 50;
        break;
      }
    }

    // Capability match
    const modelCaps = (model.capabilities || []).map(c => c.toLowerCase());
    for (const cap of preferences.preferCapabilities || []) {
      if (modelCaps.includes(cap.toLowerCase())) {
        score += 20;
      }
    }

    // Context window
    const context = model.context_window || model.max_tokens || 0;
    if (context >= preferences.minContext) {
      score += 10;
    } else if (context > 0) {
      score -= 20; // Penalty for insufficient context
    }

    // Prefer newer/higher version models
    const id = (model.id || '').toLowerCase();
    if (id.includes('latest') || id.includes('newest')) {
      score += 5;
    }

    // Penalize deprecated
    if (model.deprecated || id.includes('deprecated') || id.includes('legacy')) {
      score -= 50;
    }

    return score;
  }

  /**
   * Select best model for a task
   */
  async selectBestModel(taskType, options = {}) {
    const models = await this.client.getModels(options.forceRefresh);
    
    if (!models.length) {
      throw new Error('No models available from OmniRoute');
    }

    // Filter by explicit model if provided
    let candidates = models;
    if (options.model) {
      candidates = models.filter(m => m.id === options.model);
      if (!candidates.length) {
        throw new Error(`Model ${options.model} not found in catalog`);
      }
    }

    // Filter by provider if specified
    if (options.provider) {
      candidates = candidates.filter(m => 
        (m.provider || '').toLowerCase() === options.provider.toLowerCase() ||
        (m.id || '').toLowerCase().startsWith(options.provider.toLowerCase() + '/')
      );
    }

    // Filter by capabilities if required
    if (options.requiredCapabilities?.length) {
      candidates = candidates.filter(m => {
        const caps = (m.capabilities || []).map(c => c.toLowerCase());
        return options.requiredCapabilities.every(c => caps.includes(c.toLowerCase()));
      });
    }

    if (!candidates.length) {
      throw new Error('No models match the specified criteria');
    }

    // Score and sort
    const scored = candidates.map(model => ({
      model,
      score: this.scoreModel(model, taskType),
      categories: this.categorizeModel(model)
    }));

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    
    if (options.verbose) {
      console.log('Top 5 models for', taskType + ':');
      scored.slice(0, 5).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.model.id} (score: ${s.score}, categories: ${s.categories.join(', ')})`);
      });
    }

    return best.model;
  }

  /**
   * Get model recommendations for all task types
   */
  async getRecommendations() {
    const models = await this.client.getModels();
    const recommendations = {};

    for (const taskType of Object.values(TASK_TYPES)) {
      const scored = models.map(model => ({
        model,
        score: this.scoreModel(model, taskType),
        categories: this.categorizeModel(model)
      }));
      scored.sort((a, b) => b.score - a.score);
      recommendations[taskType] = scored.slice(0, 3).map(s => ({
        id: s.model.id,
        name: s.model.name,
        provider: s.model.provider,
        score: s.score,
        categories: s.categories,
        contextWindow: s.model.context_window || s.model.max_tokens
      }));
    }

    return recommendations;
  }

  /**
   * List models by category
   */
  async listModelsByCategory() {
    const models = await this.client.getModels();
    const byCategory = {};

    for (const model of models) {
      const categories = this.categorizeModel(model);
      for (const cat of categories) {
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push({
          id: model.id,
          name: model.name,
          provider: model.provider,
          contextWindow: model.context_window || model.max_tokens,
          capabilities: model.capabilities
        });
      }
    }

    return byCategory;
  }
}

export default ModelSelector;