# vLLM Code Completion Test Instructions

## How to Test the Web IDE

1. **Open the web application**: http://localhost:5175 (or check the actual port from terminal output)

## Configuration

**⚙️ Settings Button**: Click the settings button in the header to configure:
- **Model Endpoints**: Change vLLM server URLs (default: localhost:8000 for StarCoder2, localhost:8001 for Alternative Model)
- **Model Parameters**: Adjust temperature, max tokens, etc.
- **Default Model**: Choose which model to use by default
- **API Settings**: Configure timeout and retry settings

**URL Parameters**: You can also configure via URL:
```
?starcoder_endpoint=http://192.168.1.100:8000&alternative_endpoint=http://192.168.1.100:8001&default_model=starcoder
```

**Persistent Configuration**: Settings are saved to localStorage and persist across browser sessions.

2. **Test Code Completion - Dual Editor Setup**:
   **Left Editor (Primary Model)**: Currently configured model (default: StarCoder2 7B)
   **Right Editor (Secondary Model)**: Alternative model (default: Alternative Model)
   
   - Type some JavaScript code in either editor, for example:
     ```javascript
     function calculateSum(a, b) {
         return 
     ```
   - Position your cursor after `return ` 
   - **Press Tab** or **Ctrl+Space** to trigger vLLM completion for that specific model

3. **What Should Happen**:
   - **Model Status**: Header shows status of both models (✓ enabled, ✗ disabled)
   - **Split-Screen**: Two Monaco editors side by side
     - **Left**: Primary model (configurable in settings)
     - **Right**: Secondary model (automatically the non-default model)
   - **Independent Operation**: Each editor works independently with its own model
   - **Synchronized Code**: Both editors share the same code content (typing in one updates the other)
   - **Debug Window**: Shows API calls from both models with model identification
   - **Monaco Editor**: Both editors display suggestion dropdowns with completions from their respective models
   - **Model Identification**: Each completion shows which model generated it
   - **Accept/Reject**: Completion acceptance works in both editors independently

4. **FIM Completion Management**:
   - **✓ Accept & Append to JSONL**: Appends the FIM completion to the existing daily JSONL file (centered button)
   - **✗ Reject**: Marks the completion as rejected (no file save, centered button)
   - **Persistent Storage**: Uses localStorage to maintain completions across browser sessions
   - **JSONL Format**: Each accepted completion is appended as:
     ```json
     {"content": "<fim_prefix>...code...<fim_suffix>...<fim_middle>accepted_text", "timestamp": "2025-07-27T...", "model": "StarCoder2 7B"}
     ```
   - **File Accumulation**: Multiple accepts append to the same daily file automatically
   - **Download Functionality**: Header shows count of saved completions with download button
   - **Clear Option**: 🗑️ Clear button to reset saved completions for the current day

4. **Debug Information**:
   - **Enlarged Debug Window**: The bottom window now takes up 50% of the screen height to show full completion content
   - **API Call Tracking**: All vLLM API requests and responses are logged with better formatting
   - **Completion Acceptance Tracking**: When you accept a suggestion, it logs:
     - 🎯 The exact text that was accepted and inserted
     - 📝 The complete FIM prompt with the accepted text appended to `<fim_middle>`
   - Each completion is numbered and displayed in full length with proper syntax highlighting
   - You can see the FIM (Fill-in-the-Middle) prompt format: `<fim_prefix>...<fim_suffix>...<fim_middle>`
   - Response completions are shown with their exact content, preserving formatting and indentation
   - Request counter in the debug header shows total number of API calls made
   - **Visual Indicators**: 
     - Green border: Regular completions received from vLLM
     - Orange border: User-accepted completions
     - Blue border: FIM completions showing the final prompt with accepted text

5. **Keyboard Shortcuts**:
   - **Tab**: Fetch completions and show suggestion widget
   - **Ctrl+Space** (or **Cmd+Space** on Mac): Alternative completion trigger
   - **Arrow Keys**: Navigate through suggestions
   - **Enter/Tab**: Accept selected suggestion
   - **Escape**: Dismiss suggestions

## Expected API Format

The vLLM integration uses the OpenAI-compatible API format for both models:
- **StarCoder2 7B Endpoint**: `http://localhost:8000/v1/completions`
- **Alternative Model Endpoint**: `http://localhost:8001/v1/completions`
- **FIM Format**: `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`
- **Model Auto-Detection**: Uses the first model returned by `/v1/models` endpoint

## Troubleshooting

### Common Issues
1. **Connection Failed**: Check if vLLM servers are running on the configured endpoints
2. **No Completions**: Verify models are enabled and endpoints are correct  
3. **Settings Not Saving**: Check browser localStorage permissions
4. **Right Editor Disabled**: Check if secondary model is enabled in settings

### Debug Information
- **Model Status**: Header shows which models are enabled/disabled
- **Debug Window**: Shows API calls from both models with clear model identification
- Use **🔍 View Storage** to inspect saved data
- Check browser console for detailed logs from both models
- Use **🧪 Test Accepted Completion** to verify functionality

### Reset Configuration
If settings become corrupted:
1. Click **⚙️ Settings**
2. Click **🔄 Reset to Defaults**
3. Or manually clear localStorage: `localStorage.removeItem('vllm_webide_config')`

## Example Workflow - Dual Editor

1. **Setup Both Models**:
   ```bash
   # Terminal 1: Start StarCoder2 7B
   vllm serve bigcode/starcoder2-7b --port 8000
   
   # Terminal 2: Start Alternative Model  
   vllm serve [alternative-model] --port 8001
   ```

2. **Type some code** (both editors will show the same content):
   ```javascript
   function calculateArea(radius) {
       return 
   ```

3. **Test Left Editor** (Primary Model):
   - Position cursor after `return ` in the left editor
   - Press **Tab** → See completions from StarCoder2 7B

4. **Test Right Editor** (Secondary Model):
   - Position cursor after `return ` in the right editor  
   - Press **Tab** → See completions from Alternative Model

5. **Compare Results**: 
   - **Debug Window**: Shows API calls from both models
   - **Model Identification**: Each entry shows which model was used
   - **Different Suggestions**: Compare completion quality between models
   - **Independent Selection**: Accept completions independently in each editor

6. **Save Completions**:
   - Both editors generate FIM completions when accepted
   - Each completion is tagged with the source model name
   - Use **✓ Accept** buttons to save to JSONL with model attribution
   - Download results to see comparative data from both models
