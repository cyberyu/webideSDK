# vLLM Web IDE - Dual Editor System

A modern web-based code editor with dual-model support for vLLM servers. Built with React + TypeScript + Vite and Monaco Editor.

## ✨ Features

- **Dual Editor Layout**: Split-screen with two independent Monaco editors
- **Model Comparison**: Compare completions from different vLLM models side-by-side
- **Configurable Endpoints**: Easy configuration of vLLM server endpoints
- **Real-time Debugging**: Debug window showing API calls and responses
- **Data Collection**: Export training data with model attribution
- **Adaptive Layout**: Automatically adjusts between single and dual editor modes

## 🚀 Quick Start

1. **Start vLLM Servers**:
   ```bash
   # Terminal 1 - Primary model
   vllm serve bigcode/starcoder2-7b --port 8000
   
   # Terminal 2 - Secondary model
   vllm serve Qwen/Qwen2.5-Coder-3B --port 8001
   ```

2. **Install and Run**:
   ```bash
   npm install
   npm run dev
   ```

3. **Open Browser**: Navigate to `http://localhost:5174`

## ⚙️ Configuration

Click the **⚙️ Settings** button to configure:
- Model endpoints and parameters
- Single vs dual editor mode
- Temperature, max tokens, and other model settings

### URL Parameters

Override configuration via URL parameters:
```
http://localhost:5174/?starcoder_endpoint=http://remote:8000&alternative_endpoint=http://remote:8001&default_model=alternative
```

## 📚 Documentation

- [Configuration Guide](CONFIGURATION.md) - Detailed configuration options
- [Dual Editor Setup](DUAL_EDITOR_GUIDE.md) - How to use dual editors
- [Testing Instructions](COMPLETION_TEST.md) - How to test completions
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Technical details

## 🔧 Development

## 🔧 Development

This project uses:
- **React 18** with TypeScript
- **Vite** for fast development and building  
- **Monaco Editor** for code editing interface
- **ESLint** for code quality

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Project Structure

```
src/
├── App.tsx          # Main application component with dual editors
├── config.ts        # Configuration system and model settings
├── ConfigModal.tsx  # Settings modal component
├── CodeEditor.tsx   # Monaco editor wrapper
├── vllm.ts         # vLLM API integration
└── assets/         # Static assets
```

## 🎯 Model Support

Currently supports:
- **Primary Model**: StarCoder2 7B (default on port 8000)
- **Secondary Model**: Alternative Model (configurable, default on port 8001)

The system is designed to work with any vLLM-compatible model server.

## 📄 License

MIT License - see project files for details.
