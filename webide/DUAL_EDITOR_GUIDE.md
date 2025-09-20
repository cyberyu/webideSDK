# 🔥 Dual-Editor vLLM Web IDE - Complete Setup

## 🎉 **Features Overview**

The vLLM Web IDE now features a **split-screen dual-editor system** that allows users to compare completions from two different vLLM models side-by-side in real-time.

### ✨ **Key Capabilities**

#### 🖥️ **Dual Editor Layout**
- **Left Editor**: Primary model (configurable, default: StarCoder2 7B)
- **Right Editor**: Secondary model (automatically the non-default model, default: Alternative Model)
- **Synchronized Content**: Both editors share the same code - typing in one updates the other
- **Independent Completions**: Each editor fetches completions from its own configured model
- **Model Status Indicators**: Header shows real-time status of both models (✓ enabled, ✗ disabled)

#### ⚙️ **Advanced Configuration System**
- **Settings Modal**: Click ⚙️ Settings to configure both models
- **Dynamic Endpoints**: Configure different vLLM server URLs for each model
- **Model Parameters**: Individual temperature, max tokens, top-p settings per model
- **Enable/Disable**: Toggle models on/off without losing configuration
- **URL Parameters**: Override settings via URL for easy sharing/deployment
- **Persistent Storage**: All settings saved to localStorage

#### 🔍 **Enhanced Debug System**
- **Dual Model Tracking**: Debug window shows API calls from both models
- **Model Identification**: Each completion clearly shows which model generated it
- **Comparative Analysis**: Side-by-side comparison of model responses
- **Enhanced Logging**: Detailed logs for both models with timestamps and parameters

#### 💾 **FIM Completion Collection**
- **Model Attribution**: Saved completions include source model information
- **JSONL Export**: Download training data with model tags
- **Accept/Reject Workflow**: Independent acceptance for each model's completions
- **Persistent Storage**: Cross-session storage with date-based organization

## 🚀 **Quick Start Guide**

### 1. **Start vLLM Servers**
```bash
# Terminal 1: StarCoder2 7B (Primary Model)
vllm serve bigcode/starcoder2-7b --port 8000

# Terminal 2: Alternative Model (Secondary Model)  
vllm serve [alternative-model] --port 8001
```

### 2. **Launch Web IDE**
```bash
cd /usr/project/refact/webide
npm run dev
# Open: http://localhost:5175
```

### 3. **Verify Setup**
- ✅ Header shows both models with status indicators
- ✅ Two editors visible side-by-side
- ✅ Click ⚙️ Settings to configure endpoints if needed

### 4. **Test Completions**
- Type code in either editor: `function calculate() { return `
- **Left Editor**: Press Tab → Get StarCoder2 7B completions
- **Right Editor**: Press Tab → Get Alternative Model completions
- Compare suggestions side-by-side!

## 🔧 **Configuration Options**

### **Model Configuration**
```typescript
// Each model has independent settings:
{
  name: "StarCoder2 7B",
  endpoint: "http://localhost:8000",
  enabled: true,
  maxTokens: 256,
  temperature: 0.2,
  topP: 0.95,
  n: 2,
  logprobs: 3
}
```

### **URL Configuration Examples**
```bash
# Remote servers
http://localhost:5175/?starcoder_endpoint=http://192.168.1.100:8000&alternative_endpoint=http://10.0.0.50:8001

# Different ports
http://localhost:5175/?starcoder_endpoint=http://localhost:9000&alternative_endpoint=http://localhost:9001

# Switch default model
http://localhost:5175/?default_model=alternative
```

### **API Endpoints**
- **StarCoder2 7B**: `http://localhost:8000/v1/completions`
- **Alternative Model**: `http://localhost:8001/v1/completions`
- **FIM Format**: `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`

## 🎯 **Use Cases**

### **1. Model Comparison**
- Compare completion quality between different models
- A/B testing for code generation tasks
- Evaluate model performance on specific coding tasks

### **2. Training Data Collection**
- Collect completions from multiple models
- User preference data (accept/reject) for each model
- Comparative training datasets

### **3. Development Workflow**
- Use different models for different coding tasks
- Fallback model when primary model is unavailable
- Team collaboration with model preferences

### **4. Research & Analysis**
- Study model behavior differences
- Completion quality metrics
- User interaction patterns

## 📊 **Data Collection Format**

### **JSONL Export Format**
```json
{"content": "<fim_prefix>function calc() { return <fim_suffix>\n}<fim_middle>42;", "timestamp": "2025-07-27T12:34:56.789Z", "model": "StarCoder2 7B"}
{"content": "<fim_prefix>function calc() { return <fim_suffix>\n}<fim_middle>result;", "timestamp": "2025-07-27T12:35:12.456Z", "model": "Alternative Model"}
```

### **Debug Log Format**
```typescript
{
  timestamp: "12:34:56",
  endpoint: "http://localhost:8000",
  modelUsed: "StarCoder2 7B",
  prompt: "<fim_prefix>...<fim_suffix>...<fim_middle>",
  response: ["completion1", "completion2"],
  selectedCompletion: "completion1",
  statusCode: 200
}
```

## 🛠️ **Technical Implementation**

### **Architecture**
```
┌─────────────────┬─────────────────┐
│   Left Editor   │  Right Editor   │
│  (Primary Model)│(Secondary Model)│
├─────────────────┼─────────────────┤
│   StarCoder2    │  Alternative   │
│   Port 8000     │   Port 8001     │
└─────────────────┴─────────────────┘
         │               │
         └───────┬───────┘
                 │
         ┌───────▼───────┐
         │  Debug Window │
         │  (Both Models)│
         └───────────────┘
```

### **File Structure**
```
src/
├── App.tsx              # Main dual-editor layout
├── CodeEditor.tsx       # Monaco editor wrapper
├── config.ts           # Configuration management
├── ConfigModal.tsx     # Settings UI
├── vllm.ts            # vLLM API integration
└── App.css            # Split-screen styling
```

### **Key Functions**
- `getCurrentModelConfig()`: Get primary model configuration
- `getSecondaryModelConfig()`: Get secondary model configuration  
- `handleCompletion1()`: Left editor completion handler
- `handleCompletion2()`: Right editor completion handler
- `loadConfig()`: Load configuration with dual-model support

## 🔍 **Monitoring & Debugging**

### **Visual Indicators**
- **Green**: Model enabled and working
- **Red**: Model disabled or connection failed
- **Model Names**: Clear identification in headers and debug logs
- **Endpoint URLs**: Displayed in editor labels

### **Debug Information**
- **API Calls**: All requests logged with model identification
- **Response Times**: Track performance of each model
- **Error Handling**: Clear error messages per model
- **Completion Stats**: Accept/reject rates per model

### **Storage Inspection**
- **🔍 View Storage**: Inspect localStorage contents
- **Model Attribution**: See which model generated each completion
- **Download History**: Export all collected data

## 🎉 **Success Indicators**

When everything is working correctly, you should see:
- ✅ Header shows both models with green ✓ status
- ✅ Two editors side-by-side with different model labels
- ✅ Tab key triggers completions in both editors independently
- ✅ Debug window shows API calls from both models
- ✅ Different completion suggestions from each model
- ✅ Accept/reject buttons save with correct model attribution

## 🚨 **Troubleshooting**

### **Common Issues**
1. **Right Editor Not Working**: Check if secondary model is enabled in settings
2. **Only One Model Shows**: Verify both vLLM servers are running
3. **Same Completions**: Check if both models are pointing to same endpoint
4. **Settings Lost**: Check localStorage permissions in browser

### **Quick Fixes**
```bash
# Reset configuration
localStorage.removeItem('vllm_webide_config')

# Check model status
curl http://localhost:8000/v1/models
curl http://localhost:8001/v1/models

# Restart with fresh config
# Add ?reset=true to URL to force default config
```

This dual-editor setup transforms the vLLM Web IDE into a powerful tool for model comparison, training data collection, and advanced code completion workflows! 🚀
