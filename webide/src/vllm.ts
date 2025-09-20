import axios from 'axios';
import OpenAI from 'openai';
import { type ModelConfig } from './config';

export interface DebugInfo {
  timestamp: string;
  endpoint: string;
  prompt: string;
  response: string[];
  error?: string;
  requestUrl?: string;
  requestHeaders?: any;
  requestBody?: any;
  statusCode?: number;
  modelUsed?: string;
  selectedCompletion?: string; // New field for tracking accepted completions
  fimCompletion?: string; // New field for the FIM completion with selected text
  saved?: boolean; // Track if FIM completion was saved to JSONL
  savedTimestamp?: string; // When it was saved
  rejected?: boolean; // Track if FIM completion was rejected
  rejectedTimestamp?: string; // When it was rejected
}

// Left side IDE - follows query_left.py pattern using OpenAI client
export async function fetchCompletionsFromVLLMLeft(
  code: string, 
  position: number, 
  modelConfig: ModelConfig,
  onDebug?: (debug: DebugInfo) => void
): Promise<string[]> {
  const requestUrl = `${modelConfig.endpoint}${modelConfig.apiPath || '/v1'}`;
  
  try {
    // Get text before and after cursor position for FIM (Fill-in-the-Middle)
    const prefix = code.substring(0, position);
    const suffix = code.substring(position);
      // Format prompt with FIM tokens exactly like query_left.py
    const fimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
    
    // Create OpenAI client exactly like query_left.py
    const client = new OpenAI({
      apiKey: "EMPTY",
      baseURL: requestUrl,
      dangerouslyAllowBrowser: true // Required for browser usage
    });

    // Get models and use the first one, like query_left.py
    const models = await client.models.list();
    const model = models.data[0].id;
    
    const requestBody = {
      model: model,
      prompt: fimPrompt,
      echo: false,
      n: 1,
      logprobs: modelConfig.logprobs || 3,
      max_tokens: modelConfig.maxTokens || 256,
      temperature: modelConfig.temperature || 0.2,
      top_p: modelConfig.topP || 0.95,
    };
    
    const debugInfo: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      endpoint: modelConfig.endpoint,
      prompt: fimPrompt,
      response: [],
      requestUrl,
      requestHeaders: { 'Authorization': 'Bearer EMPTY' },
      requestBody,
      modelUsed: `${modelConfig.name} (${model})`
    };
    
    // Completion API exactly like query_left.py
    const completion = await client.completions.create(requestBody);
    
    // Extract completions exactly like query_left.py - get the text from choices
    const completions = completion.choices?.map(choice => choice.text || '').filter(text => text.trim()) || [];
    
    debugInfo.response = completions;
    debugInfo.statusCode = 200;
    if (onDebug) onDebug(debugInfo);
    
    return completions;
  } catch (error: any) {
    const prefix = code.substring(0, position);
    const suffix = code.substring(position);    const fimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
    
    const debugInfo: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      endpoint: modelConfig.endpoint,
      prompt: fimPrompt,
      response: [],
      requestUrl,
      requestHeaders: { 'Authorization': 'Bearer EMPTY' },
      requestBody: { prompt: fimPrompt },
      statusCode: error?.response?.status || error?.status,
      error: error?.message || String(error),
      modelUsed: modelConfig.name
    };
    
    if (onDebug) onDebug(debugInfo);
    console.error(`Error fetching completions from ${modelConfig.endpoint}:`, error);
    return [];
  }
}

// Right side IDE - keep using the original axios approach
export async function fetchCompletionsFromVLLM(
  code: string, 
  position: number, 
  endpoint: string,
  onDebug?: (debug: DebugInfo) => void,
  useAlternateFimTags?: boolean
): Promise<string[]> {
  const requestUrl = `${endpoint}/v1/completions`;
  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer EMPTY'
  };
  
  try {
    // Get text before and after cursor position for FIM (Fill-in-the-Middle)
    const prefix = code.substring(0, position);
    const suffix = code.substring(position);
      // Format prompt with FIM tokens - different tags for different models
    const fimPrompt = useAlternateFimTags 
      ? `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`
      : `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
    
    const requestBody = {
      model: "default", // Will use the first available model
      prompt: fimPrompt,
      max_tokens: 100,
      temperature: 0.7,
      n: 1, // Get multiple completions
      echo: false,
      stop: ["<|endoftext|>", "\n\n"],
      stream: false
    };
    
    const debugInfo: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      endpoint,
      prompt: fimPrompt,
      response: [],
      requestUrl,
      requestHeaders,
      requestBody
    };
    
    // Use OpenAI-compatible API with proper headers
    const response = await axios.post(requestUrl, requestBody, {
      headers: requestHeaders
    });
    
    // vLLM returns completions in OpenAI-compatible format
    const data = response.data as { choices?: Array<{ text?: string }> };
    const completions = data.choices?.map(choice => choice.text || '').filter(text => text.trim()) || [];
    
    debugInfo.response = completions;
    debugInfo.statusCode = response.status;
    if (onDebug) onDebug(debugInfo);
    
    return completions;
  } catch (error: any) {
    const prefix = code.substring(0, position);
    const suffix = code.substring(position);    const fimPrompt = useAlternateFimTags 
      ? `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`
      : `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
    
    const requestBody = {
      model: "default",
      prompt: fimPrompt,
      max_tokens: 100,
      temperature: 0.7,
      n: 1,
      echo: false,
      stop: ["<|endoftext|>", "\n\n"],
      stream: false
    };
      
    const debugInfo: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      endpoint,
      prompt: fimPrompt,
      response: [],
      requestUrl: `${endpoint}/v1/completions`,
      requestHeaders: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer EMPTY'
      },
      requestBody,
      statusCode: error?.response?.status || error?.status,
      error: error?.message || String(error)
    };
    
    if (onDebug) onDebug(debugInfo);
    console.error(`Error fetching completions from ${endpoint}:`, error);
    return [];
  }
}
