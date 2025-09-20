// Configuration for vLLM endpoints and model settings
export interface ModelConfig {
  name: string;
  endpoint: string;
  enabled: boolean;
  description: string;
  apiPath?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  n?: number; // Number of completions to generate
  logprobs?: number;
}

export interface EditorConfig {
  enableSyntaxChecking: boolean;
  enableSpellCheck: boolean;
  enableSemanticValidation: boolean;
  enableSuggestionChecking: boolean;
  enableTypeScriptDiagnostics: boolean;
  enableJavaScriptDiagnostics: boolean;
  enableQuickInfo: boolean;
  showUnusedWarnings: boolean;
  showDeprecatedWarnings: boolean;
}

export interface AppConfig {
  models: {
    starcoder: ModelConfig;
    alternative: ModelConfig;
  };
  api: {
    timeout: number;
    retries: number;
    defaultModel: 'starcoder' | 'alternative';
  };
  ui: {
    debugWindowHeight: string;
    maxDebugEntries: number;
    enableTestMode: boolean;
  };
  editor: EditorConfig;
  storage: {
    keyPrefix: string;
    filePrefix: string;
  };
}

// Default configuration
export const defaultConfig: AppConfig = {
  models: {
    starcoder: {
      name: 'StarCoder2 7B',
      endpoint: 'http://localhost:8000',
      enabled: true,
      description: 'StarCoder2 7B model for code completion',
      apiPath: '/v1',
      maxTokens: 256,
      temperature: 0.2,
      topP: 0.95,
      n: 2,
      logprobs: 3,
    },
    alternative: {
      name: 'Alternative Model',
      endpoint: 'http://localhost:8001',
      enabled: true, // Enable by default to show dual-editor functionality
      description: 'Alternative model for code completion',
      apiPath: '/v1',
      maxTokens: 256,
      temperature: 0.2,
      topP: 0.95,
      n: 2,
      logprobs: 3,
    },
  },
  api: {
    timeout: 10000, // 10 seconds
    retries: 2,
    defaultModel: 'starcoder',  },
  ui: {
    debugWindowHeight: '50vh',
    maxDebugEntries: 10,
    enableTestMode: true,
  },
  editor: {
    enableSyntaxChecking: true,
    enableSpellCheck: false,
    enableSemanticValidation: true,
    enableSuggestionChecking: true,
    enableTypeScriptDiagnostics: true,
    enableJavaScriptDiagnostics: true,
    enableQuickInfo: true,
    showUnusedWarnings: false,
    showDeprecatedWarnings: true,
  },
  storage: {
    keyPrefix: 'fim_completions_',
    filePrefix: 'fim_completions_',
  },
};

// Load configuration from localStorage or use defaults
export function loadConfig(): AppConfig {
  try {
    const savedConfig = localStorage.getItem('vllm_webide_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Merge with defaults to ensure all keys exist
      return {
        ...defaultConfig,
        ...parsed,
        models: {
          ...defaultConfig.models,
          ...parsed.models,
        },
        api: {
          ...defaultConfig.api,
          ...parsed.api,
        },        ui: {
          ...defaultConfig.ui,
          ...parsed.ui,
        },
        editor: {
          ...defaultConfig.editor,
          ...parsed.editor,
        },
        storage: {
          ...defaultConfig.storage,
          ...parsed.storage,
        },
      };
    }
  } catch (error) {
    console.warn('Failed to load config from localStorage, using defaults:', error);
  }
  return defaultConfig;
}

// Save configuration to localStorage
export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem('vllm_webide_config', JSON.stringify(config));
    console.log('✅ Configuration saved to localStorage');
  } catch (error) {
    console.error('❌ Failed to save configuration:', error);
  }
}

// Update a specific model configuration
export function updateModelConfig(modelKey: 'starcoder' | 'alternative', updates: Partial<ModelConfig>): AppConfig {
  const config = loadConfig();
  config.models[modelKey] = { ...config.models[modelKey], ...updates };
  saveConfig(config);
  return config;
}

// Get the active model configuration
export function getActiveModelConfig(): ModelConfig {
  const config = loadConfig();
  return config.models[config.api.defaultModel];
}

// Get full API URL for a model
export function getModelApiUrl(modelKey: 'starcoder' | 'alternative'): string {
  const config = loadConfig();
  const model = config.models[modelKey];
  return `${model.endpoint}${model.apiPath || '/v1'}`;
}

// Update editor configuration
export function updateEditorConfig(updates: Partial<EditorConfig>): AppConfig {
  const config = loadConfig();
  config.editor = { ...config.editor, ...updates };
  saveConfig(config);
  return config;
}

// Get current editor configuration
export function getEditorConfig(): EditorConfig {
  const config = loadConfig();
  return config.editor;
}

// Environment-based configuration overrides
export function getEnvironmentConfig(): Partial<AppConfig> {
  const overrides: Partial<AppConfig> = {};
  
  // Check for environment variables (if available in browser context)
  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search);
    
    // Allow URL parameters to override endpoints
    const starcoderEndpoint = searchParams.get('starcoder_endpoint');
    const alternativeEndpoint = searchParams.get('alternative_endpoint');
    const defaultModel = searchParams.get('default_model') as 'starcoder' | 'alternative';
    
    if (starcoderEndpoint || alternativeEndpoint || defaultModel) {
      overrides.models = {
        starcoder: defaultConfig.models.starcoder,
        alternative: defaultConfig.models.alternative,
      };
      
      if (starcoderEndpoint) {
        overrides.models.starcoder = {
          ...defaultConfig.models.starcoder,
          endpoint: starcoderEndpoint,
        };
      }
      
      if (alternativeEndpoint) {
        overrides.models.alternative = {
          ...defaultConfig.models.alternative,
          endpoint: alternativeEndpoint,
        };
      }
      
      if (defaultModel && (defaultModel === 'starcoder' || defaultModel === 'alternative')) {
        overrides.api = {
          ...defaultConfig.api,
          defaultModel,
        };
      }
    }
  }
  
  return overrides;
}

// Initialize configuration with environment overrides
export function initializeConfig(): AppConfig {
  const baseConfig = loadConfig();
  const envOverrides = getEnvironmentConfig();
  
  const finalConfig: AppConfig = {
    ...baseConfig,
    ...envOverrides,
    models: {
      ...baseConfig.models,
      ...envOverrides.models,
    },
    api: {
      ...baseConfig.api,
      ...envOverrides.api,
    },
  };
  
  // Save the final configuration back to localStorage
  saveConfig(finalConfig);
  
  return finalConfig;
}
