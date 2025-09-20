# 🔧 Configuration System Documentation

## Overview

The vLLM Web IDE now has a comprehensive configuration system that allows users to easily customize endpoint URLs, model parameters, and application settings.

## ✨ Key Features

### 🎛️ Configuration Modal
- **Access**: Click the **⚙️ Settings** button in the header
- **Persistent Storage**: All settings saved to localStorage
- **Live Updates**: Changes take effect immediately after saving

### 🌐 URL Parameter Configuration
Override settings via URL parameters:
```
http://localhost:5175/?starcoder_endpoint=http://192.168.1.100:8000&alternative_endpoint=http://192.168.1.100:8001&default_model=starcoder
```

### 📱 Model Configuration
Configure multiple vLLM models:
- **StarCoder2 7B**: Primary code completion model
- **Alternative Model**: Alternative code completion model
- **Enable/Disable**: Toggle models on/off
- **Endpoint URLs**: Configure server addresses
- **Parameters**: Temperature, max tokens, top-p, etc.

## 🔧 Configuration Options

### Model Settings
```typescript
{
  name: string;           // Display name
  endpoint: string;       // vLLM server URL
  enabled: boolean;       // Enable/disable model
  description: string;    // Model description
  apiPath: string;        // API path (default: "/v1")
  maxTokens: number;      // Maximum tokens to generate
  temperature: number;    // Sampling temperature (0.0-2.0)
  topP: number;          // Top-p sampling (0.0-1.0)
  n: number;             // Number of completions to generate
  logprobs: number;      // Number of log probabilities
}
```

### API Settings
```typescript
{
  timeout: number;        // Request timeout in milliseconds
  retries: number;        // Number of retry attempts
  defaultModel: string;   // Default model to use ('starcoder' | 'alternative')
}
```

### UI Settings
```typescript
{
  debugWindowHeight: string;  // Height of debug window
  maxDebugEntries: number;    // Maximum debug log entries
  enableTestMode: boolean;    // Enable test features
}
```

### Storage Settings
```typescript
{
  keyPrefix: string;      // localStorage key prefix
  filePrefix: string;     // Downloaded file prefix
}
```

## 🚀 How to Use

### 1. Basic Setup
1. Start your vLLM servers:
   ```bash
   # StarCoder2 7B on port 8000
   vllm serve bigcode/starcoder2-7b --port 8000
   
   # Alternative Model on port 8001 (optional)
   vllm serve [alternative-model] --port 8001
   ```

2. Open the web IDE: `http://localhost:5175`

### 2. Configure Endpoints
1. Click **⚙️ Settings** in the header
2. Update endpoint URLs for your vLLM servers
3. Adjust model parameters as needed
4. Click **💾 Save Configuration**

### 3. URL Configuration (Alternative)
Add parameters to the URL:
```
http://localhost:5175/?starcoder_endpoint=http://your-server:8000&default_model=starcoder
```

### 4. Remote Server Configuration
For remote vLLM servers:
```
http://localhost:5175/?starcoder_endpoint=http://192.168.1.100:8000&alternative_endpoint=http://10.0.0.50:8001
```

## 🔍 Configuration Storage

### LocalStorage Keys
- **Configuration**: `vllm_webide_config`
- **Completions**: `fim_completions_YYYY-MM-DD`

### Configuration File Format
```json
{
  "models": {
    "starcoder": {
      "name": "StarCoder2 7B",
      "endpoint": "http://localhost:8000",
      "enabled": true,
      "maxTokens": 256,
      "temperature": 0.2,
      "topP": 0.95,
      "n": 2,
      "logprobs": 3
    },
    "alternative": {
      "name": "Alternative Model",
      "endpoint": "http://localhost:8001",
      "enabled": false,
      "maxTokens": 256,
      "temperature": 0.2,
      "topP": 0.95,
      "n": 2,
      "logprobs": 3
    }
  },
  "api": {
    "timeout": 10000,
    "retries": 2,
    "defaultModel": "starcoder"
  },
  "ui": {
    "debugWindowHeight": "50vh",
    "maxDebugEntries": 10,
    "enableTestMode": true
  },
  "storage": {
    "keyPrefix": "fim_completions_",
    "filePrefix": "fim_completions_"
  }
}
```

## 🛠️ Advanced Features

### Configuration Management
- **Reset to Defaults**: Click "🔄 Reset to Defaults" in settings
- **Export/Import**: Configuration stored in localStorage
- **Environment Overrides**: URL parameters override saved settings

### Model Switching
- Change the default model in settings
- Enable multiple models for A/B testing
- Configure different parameters per model

### Network Configuration
- Configure timeouts for slow networks
- Set retry attempts for unreliable connections
- Support for different API paths

## 🔧 Troubleshooting

### Common Issues
1. **Connection Failed**: Check if vLLM server is running on the configured endpoint
2. **No Completions**: Verify model is enabled and endpoint is correct
3. **Settings Not Saving**: Check browser localStorage permissions

### Debug Information
- Use **🔍 View Storage** to inspect saved data
- Check browser console for detailed logs
- Use **🧪 Test Accepted Completion** to verify functionality

### Reset Configuration
If settings become corrupted:
1. Click **⚙️ Settings**
2. Click **🔄 Reset to Defaults**
3. Or manually clear localStorage: `localStorage.removeItem('vllm_webide_config')`

## 📝 Development Notes

### File Structure
```
src/
├── config.ts          # Configuration management
├── ConfigModal.tsx    # Settings UI component
├── App.tsx           # Main application
├── vllm.ts           # API integration
└── CodeEditor.tsx    # Monaco editor wrapper
```

### Key Functions
- `initializeConfig()`: Initialize configuration with environment overrides
- `loadConfig()`: Load configuration from localStorage
- `saveConfig()`: Save configuration to localStorage
- `getActiveModelConfig()`: Get current active model configuration
- `getCurrentModelConfig()`: Get current model config in App component

This configuration system makes the vLLM Web IDE highly flexible and suitable for various deployment scenarios, from local development to distributed team setups with remote vLLM servers.
