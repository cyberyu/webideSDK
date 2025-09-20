import axios from 'axios';

export async function fetchCompletionsFromVLLM(code: string, position: number, endpoint: string): Promise<string[]> {
  try {
    // Get text before and after cursor position for FIM (Fill-in-the-Middle)
    const prefix = code.substring(0, position);
    const suffix = code.substring(position);
    
    // Format prompt with FIM tokens as shown in your example
    const fimPrompt = `<|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`;
    
    // Use OpenAI-compatible API with proper headers
    const response = await axios.post(`${endpoint}/v1/completions`, {
      model: "default", // Will use the first available model
      prompt: fimPrompt,
      max_tokens: 100,
      temperature: 0.7,
      n: 3, // Get multiple completions
      echo: false,
      stop: ["<|endoftext|>", "\n\n"],
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer EMPTY' // vLLM doesn't require real auth
      }
    });
    
    // vLLM returns completions in OpenAI-compatible format
    const data = response.data as { choices?: Array<{ text?: string }> };
    return data.choices?.map(choice => choice.text || '').filter(text => text.trim()) || [];
  } catch (error) {
    console.error(`Error fetching completions from ${endpoint}:`, error);
    return [];
  }
}
