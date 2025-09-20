import { useState, useEffect } from 'react';
import './App.css';
import CodeEditor from './CodeEditor';
import ConfigModal from './ConfigModal';
import { fetchCompletionsFromVLLMLeft } from './vllm';
import type { DebugInfo } from './vllm';
import { initializeConfig, loadConfig } from './config';

function App() {
  const [code, setCode] = useState('// Start coding!');
  const [completionSignal, setCompletionSignal] = useState(0);
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);  const [savedCompletions, setSavedCompletions] = useState<Array<{
    content: string;
    timestamp: string;
    model: string;
  }>>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingCompletion, setEditingCompletion] = useState<{[key: number]: string}>({});

  // Initialize configuration on app start
  useEffect(() => {
    initializeConfig();
  }, []);

  // Load saved completions from localStorage on component mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentConfig = loadConfig();
    const storageKey = `${currentConfig.storage.keyPrefix}${today}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsedCompletions = JSON.parse(saved);
        setSavedCompletions(parsedCompletions);
        console.log(`📂 Loaded ${parsedCompletions.length} existing completions from ${storageKey}`);
      } catch (error) {
        console.error('Error loading saved completions:', error);
      }
    }
  }, []);

  // vLLM endpoint configurations - now using config system
  const getCurrentModelConfig = () => {
    const currentConfig = loadConfig();
    return currentConfig.models[currentConfig.api.defaultModel];
  };

  // Get secondary model configuration for the right editor
  const getSecondaryModelConfig = () => {
    const currentConfig = loadConfig();
    const secondaryModel = currentConfig.api.defaultModel === 'starcoder' ? 'alternative' : 'starcoder';
    return currentConfig.models[secondaryModel];
  };

  // Debug callback to capture API calls
  const handleDebug = (debug: DebugInfo) => {
    const currentConfig = loadConfig();
    setDebugLogs(prev => [debug, ...prev].slice(0, currentConfig.ui.maxDebugEntries));
  };

  // Clear debug logs
  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  // Completion handler for the active model (left editor)
  const handleCompletion1 = async (code: string, position: number) => {
    const modelConfig = getCurrentModelConfig();
    return await fetchCompletionsFromVLLMLeft(code, position, modelConfig, handleDebug);
  };

  // Completion handler for the secondary model (right editor) - Currently disabled
  // const handleCompletion2 = async (code: string, position: number) => {
  //   const currentConfig = loadConfig();
  //   // Use the non-default model for the right editor
  //   const secondaryModel = currentConfig.api.defaultModel === 'starcoder' ? 'alternative' : 'starcoder';
  //   const modelConfig = currentConfig.models[secondaryModel];
  //   
  //   // Only proceed if the secondary model is enabled
  //   if (!modelConfig.enabled) {
  //     console.warn(`Secondary model ${modelConfig.name} is disabled`);
  //     return [];
  //   }
  //   
  //   return await fetchCompletionsFromVLLMLeft(code, position, modelConfig, handleDebug);
  // };

  // When code changes, trigger completion on both editors
  const handleChange = (v: string | undefined) => {
    setCode(v ?? '');
  };

  // When Tab is pressed in either editor, trigger completion in both
  const handleTab = () => {
    setCompletionSignal(s => s + 1);
  };

  // Handle editing a completion
  const handleEditCompletion = (entryIndex: number, newCompletion: string) => {
    setEditingCompletion(prev => ({
      ...prev,
      [entryIndex]: newCompletion
    }));
    
    // Update the debug log with the new completion and regenerated FIM completion
    setDebugLogs(prev => prev.map((log, index) => {
      if (index === entryIndex && log.selectedCompletion && log.prompt) {
        const updatedFimCompletion = log.prompt.replace('<fim_middle>', `<fim_middle>${newCompletion}`);
        return {
          ...log,
          selectedCompletion: newCompletion,
          fimCompletion: updatedFimCompletion,
          // Reset saved/rejected status since it's been modified
          saved: false,
          rejected: false,
          savedTimestamp: undefined,
          rejectedTimestamp: undefined
        };
      }
      return log;
    }));
  };

  // Start editing a completion
  const startEditingCompletion = (entryIndex: number, currentCompletion: string) => {
    setEditingCompletion(prev => ({
      ...prev,
      [entryIndex]: currentCompletion
    }));
  };

  // Cancel editing a completion
  const cancelEditingCompletion = (entryIndex: number) => {
    setEditingCompletion(prev => {
      const updated = { ...prev };
      delete updated[entryIndex];
      return updated;
    });
  };

  // Confirm editing a completion
  const confirmEditingCompletion = (entryIndex: number) => {
    const editedText = editingCompletion[entryIndex];
    if (editedText !== undefined) {
      handleEditCompletion(entryIndex, editedText);
      cancelEditingCompletion(entryIndex);
    }
  };

  // Handle when a completion is accepted by the user
  const handleCompletionAccepted = (selectedCompletion: string, originalPrompt: string, fimCompletion: string) => {
    const modelConfig = getCurrentModelConfig();
    const acceptedDebugInfo: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      endpoint: modelConfig.endpoint,
      prompt: originalPrompt,
      response: [selectedCompletion],
      selectedCompletion,
      fimCompletion,
      statusCode: 200,
      modelUsed: `${modelConfig.name} (Accepted)`,
    };
    
    console.log('User accepted completion:', selectedCompletion);
    console.log('FIM completion:', fimCompletion);
    
    setDebugLogs(prev => [acceptedDebugInfo, ...prev].slice(0, loadConfig().ui.maxDebugEntries));
  };

  // Test function to manually trigger completion acceptance (for debugging)
  const testCompletionAcceptance = () => {
    console.log('🧪 TESTING COMPLETION ACCEPTANCE FLOW');
      const testCompletion = "Math.PI * radius * radius;";
    const testPrompt = "<fim_prefix>function calculateArea(radius) { return <fim_suffix>\n}<fim_middle>";
    const testFimCompletion = testPrompt.replace('<fim_middle>', `<fim_middle>${testCompletion}`);
    
    console.log('🧪 Test completion:', testCompletion);
    console.log('🧪 Test prompt:', testPrompt);
    console.log('🧪 Test FIM completion:', testFimCompletion);
    console.log('🧪 Active model:', getCurrentModelConfig().name);
    console.log('🧪 Secondary model:', getSecondaryModelConfig().name);
    
    handleCompletionAccepted(testCompletion, testPrompt, testFimCompletion);
    
    console.log('🧪 Test completion acceptance triggered');
  };

  // Generate filename based on current date
  const getDateBasedFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentConfig = loadConfig();
    return `${currentConfig.storage.filePrefix}${dateStr}.jsonl`;
  };

  // Save FIM completion to JSONL file (append to existing data)
  const saveFimToJsonl = async (fimCompletion: string) => {
    try {
      const filename = getDateBasedFilename();
      const today = new Date().toISOString().split('T')[0];
      const currentConfig = loadConfig();
      const storageKey = `${currentConfig.storage.keyPrefix}${today}`;
      
      console.log('🔄 SAVING PROCESS STARTED');
      console.log('📅 Today:', today);
      console.log('🔑 Storage key:', storageKey);
      console.log('📝 FIM completion to save:', fimCompletion);
      console.log('📊 Current savedCompletions count:', savedCompletions.length);
      
      const jsonlEntry = {
        content: fimCompletion,
        timestamp: new Date().toISOString(),
        model: getCurrentModelConfig().name
      };
      
      console.log('📄 JSONL entry created:', jsonlEntry);
      
      // Add to current state and localStorage for persistence
      const updatedCompletions = [...savedCompletions, jsonlEntry];
      console.log('📈 Updated completions array length:', updatedCompletions.length);
      
      setSavedCompletions(updatedCompletions);
      console.log('✅ State updated with setSavedCompletions');
      
      // Save to localStorage for persistence across sessions
      const serializedData = JSON.stringify(updatedCompletions);
      localStorage.setItem(storageKey, serializedData);
      console.log('💾 Data saved to localStorage');
      
      // Verify the save
      const verifyData = localStorage.getItem(storageKey);
      const parsedVerify = JSON.parse(verifyData || '[]');
      console.log('✅ VERIFICATION: localStorage contains', parsedVerify.length, 'entries');
      console.log('🔍 Last entry in localStorage:', parsedVerify[parsedVerify.length - 1]);
      
      console.log('✅ FIM completion appended to local storage');
      console.log(`📂 File: ${filename} (${updatedCompletions.length} total entries)`);
      console.log('📄 Latest entry:', jsonlEntry);
      console.log('💾 Stored in localStorage under key:', storageKey);
      console.log('🔍 To inspect in browser: Open DevTools → Application → Local Storage → localhost:5175');
      console.log('📋 localStorage content:', localStorage.getItem(storageKey));
      
      // Show alert with storage location
      alert(`✅ Accepted completion saved!\n\n` +
            `📁 Storage: Browser localStorage\n` +
            `🔑 Key: ${storageKey}\n` +
            `📊 Total entries: ${updatedCompletions.length}\n` +
            `📥 Download via button in header\n\n` +
            `🔍 View in DevTools:\n` +
            `Application → Local Storage → localhost:5175`);
      
      return true;
    } catch (error) {
      console.error('❌ Error saving FIM completion:', error);
      console.error('❌ Error details:', error);
      return false;
    }
  };

  // Handle accepting a FIM completion
  const handleFimAccept = async (fimCompletion: string, entryIndex: number) => {
    console.log('✅ User accepted FIM completion:', fimCompletion);
    
    const success = await saveFimToJsonl(fimCompletion);
    
    if (success) {
      // Update the debug log to mark it as saved
      setDebugLogs(prev => prev.map((log, index) => 
        index === entryIndex 
          ? { ...log, saved: true, savedTimestamp: new Date().toLocaleTimeString() }
          : log
      ));
    }
  };

  // Handle rejecting a FIM completion
  const handleFimReject = (entryIndex: number) => {
    console.log('❌ User rejected FIM completion');
    
    // Update the debug log to mark it as rejected
    setDebugLogs(prev => prev.map((log, index) => 
      index === entryIndex 
        ? { ...log, rejected: true, rejectedTimestamp: new Date().toLocaleTimeString() }
        : log
    ));
  };

  // Download all saved completions as JSONL
  const downloadAllCompletions = () => {
    if (savedCompletions.length === 0) {
      alert('No completions saved yet!');
      return;
    }

    const filename = getDateBasedFilename();
    // Convert to JSONL format (one JSON object per line)
    const jsonlContent = savedCompletions.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    
    const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`📥 Downloaded ${savedCompletions.length} completions to ${filename}`);
    console.log('📄 Complete JSONL content generated for download');
  };

  // Clear all saved completions (for debugging)
  const clearSavedCompletions = () => {
    if (confirm('Are you sure you want to clear all saved completions?')) {
      const today = new Date().toISOString().split('T')[0];
      const currentConfig = loadConfig();
      const storageKey = `${currentConfig.storage.keyPrefix}${today}`;
      localStorage.removeItem(storageKey);
      setSavedCompletions([]);
      console.log('🗑️ Cleared all saved completions');
    }
  };

  // Show localStorage contents (for debugging)
  const showStorageContents = () => {
    const today = new Date().toISOString().split('T')[0];
    const currentConfig = loadConfig();
    const storageKey = `${currentConfig.storage.keyPrefix}${today}`;
    const stored = localStorage.getItem(storageKey);
    
    console.log('🔍 INSPECTING LOCALSTORAGE');
    console.log('📅 Today:', today);
    console.log('🔑 Storage key:', storageKey);
    console.log('📊 Current savedCompletions state:', savedCompletions);
    console.log('💾 Raw localStorage data:', stored);
    
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        const prettyJson = JSON.stringify(parsedData, null, 2);
        
        console.log('✅ Parsed localStorage data:', parsedData);
        console.log('📋 Pretty JSON:', prettyJson);
        
        alert(`📂 localStorage Contents\n\n` +
              `🔑 Key: ${storageKey}\n` +
              `📊 Count: ${parsedData.length} completions\n` +
              `📊 State Count: ${savedCompletions.length} completions\n\n` +
              `📄 Data (first 1000 chars):\n${prettyJson.substring(0, 1000)}${prettyJson.length > 1000 ? '...' : ''}`);
        
        console.log('📂 Full localStorage contents:', parsedData);
      } catch (error) {
        console.error('❌ Error parsing localStorage data:', error);
        alert(`❌ Error parsing localStorage data: ${error}`);
      }
    } else {
      console.log('📂 No data found in localStorage');
      alert(`📂 No data found in localStorage\n\n🔑 Key: ${storageKey}\n📊 Count: 0 completions\n📊 State Count: ${savedCompletions.length} completions`);
    }
  };

  // Configuration modal handlers
  const handleConfigChange = () => {
    // Refresh the page to apply configuration changes
    console.log('🔄 Configuration changed, reloading to apply changes...');
    window.location.reload();
  };

  return (
    <div id="app-main">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0' }}>Web Code Editor with vLLM Models</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              background: getCurrentModelConfig().enabled ? '#4caf50' : '#f44336',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              🎯 Left: {getCurrentModelConfig().name} {getCurrentModelConfig().enabled ? '✓' : '✗'}
            </div>
            <div style={{
              background: getSecondaryModelConfig().enabled ? '#4caf50' : '#f44336',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              🎯 Right: {getSecondaryModelConfig().name} {getSecondaryModelConfig().enabled ? '✓' : '✗'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {savedCompletions.length > 0 && (
            <div style={{ 
              background: '#2196f3', 
              color: 'white', 
              padding: '6px 12px', 
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              📁 {savedCompletions.length} Saved
            </div>
          )}
          
          {savedCompletions.length > 0 && (
            <button 
              onClick={downloadAllCompletions}
              style={{
                background: '#2196f3',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              📥 Download JSONL ({savedCompletions.length})
            </button>
          )}

          {savedCompletions.length > 0 && (
            <button 
              onClick={clearSavedCompletions}
              style={{
                background: '#f44336',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              🗑️ Clear
            </button>
          )}
          
          <button 
            onClick={() => setShowConfigModal(true)}
            style={{
              background: '#607d8b',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            ⚙️ Settings
          </button>
          
          <button 
            onClick={showStorageContents} 
            style={{
              background: '#9c27b0',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🔍 View Storage
          </button>
          
          <button 
            onClick={testCompletionAcceptance} 
            style={{
              background: '#ff9800',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🧪 Test Accepted Completion
          </button>
        </div>
      </div>
      <div className="split-editors-container">
        <div className="split-editor">
          <CodeEditor
            value={code}
            language="javascript"
            onChange={handleChange}
            onRequestCompletion={handleCompletion1}
            onCompletionAccepted={handleCompletionAccepted}
            triggerCompletionSignal={completionSignal}
            onTab={handleTab}
            editorLabel={`${getCurrentModelConfig().name} (${getCurrentModelConfig().endpoint})`}
          />
        </div>
        
        {/* Right editor - Secondary model (only show if enabled) */}
        {/* Right editor temporarily disabled */}
        {/*
        {getSecondaryModelConfig().enabled && (
          <div className="split-editor">
            <CodeEditor
              value={code}
              language="javascript"
              onChange={handleChange}
              onRequestCompletion={handleCompletion2}
              onCompletionAccepted={handleCompletionAccepted}
              triggerCompletionSignal={completionSignal}
              onTab={handleTab}
              editorLabel={`${getSecondaryModelConfig().name} (${getSecondaryModelConfig().endpoint})`}
            />
          </div>
        )}
        */}
      </div>
      
      {/* Debug Window */}
      <div className="debug-window">
        <div className="debug-header">
          <h3>Debug Log - Dual vLLM API Calls ({debugLogs.length} request{debugLogs.length !== 1 ? 's' : ''})</h3>
          <button onClick={clearDebugLogs} className="clear-button">Clear</button>
        </div>
        <div className="debug-content">
          {debugLogs.length === 0 ? (
            <div className="debug-empty">
              No API calls yet. Press <strong>Tab</strong> or <strong>Ctrl+Space</strong> in either editor to trigger vLLM completion.
              <br /><br />
              <strong>Instructions:</strong>
              <br />• <strong>Left Editor</strong>: {getCurrentModelConfig().name} {getCurrentModelConfig().enabled ? '(Enabled)' : '(Disabled)'}
              <br />• <strong>Right Editor</strong>: {getSecondaryModelConfig().name} {getSecondaryModelConfig().enabled ? '(Enabled)' : '(Disabled)'}
              <br />• Type code and position cursor where you want completion
              <br />• Press Tab or Ctrl+Space to fetch completions from respective models
              <br />• Navigate suggestions with arrow keys, accept with Enter/Tab
              <br />• Configure models in ⚙️ Settings
            </div>
          ) : (
            debugLogs.map((log, index) => (
              <div key={index} className={`debug-entry ${log.error ? 'debug-error' : ''} ${log.selectedCompletion ? 'debug-accepted' : ''}`}>
                <div className="debug-meta">
                  <span className="debug-time">{log.timestamp}</span>
                  <span className="debug-endpoint">{log.endpoint}</span>
                  {log.statusCode && <span className="debug-status">Status: {log.statusCode}</span>}
                  {log.modelUsed && <span className="debug-model">Model: {log.modelUsed}</span>}
                  {log.selectedCompletion && <span className="debug-accepted-badge">ACCEPTED</span>}
                  {log.error && <span className="debug-error-badge">ERROR</span>}
                </div>
                <div className="debug-request">
                  <strong>Request URL:</strong>
                  <pre>{log.requestUrl}</pre>
                  <strong>Request Body:</strong>
                  <pre>{JSON.stringify(log.requestBody, null, 2)}</pre>
                </div>
                <div className="debug-prompt">
                  <strong>FIM Prompt:</strong>
                  <pre>{log.prompt}</pre>
                </div>
                {log.error ? (
                  <div className="debug-error-msg">
                    <strong>Error:</strong> {log.error}
                  </div>
                ) : (
                  <div className="debug-response">
                    {log.selectedCompletion ? (
                      // This is an accepted completion entry
                      <>
                        <strong style={{ color: '#ff9800', fontSize: '14px' }}>🎯 Selected Completion:</strong>
                        {editingCompletion[index] !== undefined ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>                            <textarea
                              value={editingCompletion[index]}
                              onChange={(e) => setEditingCompletion(prev => ({
                                ...prev,
                                [index]: e.target.value
                              }))}
                              style={{
                                width: '100%',
                                height: '120px',
                                fontSize: '13px',
                                padding: '12px',
                                borderRadius: '4px',
                                border: '2px solid #ff9800',
                                backgroundColor: '#1a1a1a',
                                color: '#ffffff',
                                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                                lineHeight: '1.5',
                                resize: 'vertical'
                              }}
                              placeholder="Edit your completion here..."
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => confirmEditingCompletion(index)}
                                style={{
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                ✓ Confirm
                              </button>
                              <button
                                onClick={() => cancelEditingCompletion(index)}
                                style={{
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}
                              >
                                ✗ Cancel
                              </button>
                            </div>
                          </div>                        ) : (
                          <div className="completion-display-wrapper" style={{ position: 'relative' }}>
                            <pre className="debug-completion accepted-completion">{log.selectedCompletion}</pre>
                            <button
                              onClick={() => startEditingCompletion(index, log.selectedCompletion || '')}
                              className="completion-edit-btn"
                              title="Edit this completion"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        )}
                        <strong style={{ color: '#2196f3', fontSize: '14px' }}>📝 FIM Completion (Original Prompt + Accepted Text):</strong>
                        <div style={{ position: 'relative' }}>
                          <pre className="debug-completion fim-completion">{log.fimCompletion}</pre>
                          
                          {/* Show status if saved or rejected */}
                          {log.saved && (
                            <div style={{ 
                              color: '#4caf50', 
                              fontSize: '12px', 
                              fontWeight: 'bold',
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ✅ Appended to JSONL at {log.savedTimestamp}
                            </div>
                          )}
                          
                          {log.rejected && (
                            <div style={{ 
                              color: '#f44336', 
                              fontSize: '12px', 
                              fontWeight: 'bold',
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ❌ Rejected at {log.rejectedTimestamp}
                            </div>
                          )}
                            {/* Show buttons only if not yet saved or rejected */}
                          {!log.saved && !log.rejected && (
                            <div style={{ 
                              display: 'flex', 
                              gap: '8px', 
                              marginTop: '8px',
                              justifyContent: 'flex-start' // Align buttons to the left
                            }}>
                              <button
                                onClick={() => handleFimAccept(log.fimCompletion || '', index)}
                                style={{
                                  background: '#4caf50',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#45a049'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#4caf50'}
                              >
                                ✓ Accept & Append to JSONL
                              </button>
                              <button
                                onClick={() => handleFimReject(index)}
                                style={{
                                  background: '#f44336',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#da190b'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#f44336'}
                              >
                                ✗ Reject
                              </button>
                              <button
                                onClick={() => startEditingCompletion(index, log.selectedCompletion || '')}
                                style={{
                                  background: '#ff9800',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#e68a00'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#ff9800'}
                              >
                                ✎ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      // This is a regular completion fetch entry
                      <>
                        <strong>✨ Completions Received ({log.response.length} suggestions):</strong>
                        {log.response.map((resp, i) => (
                          <div key={i}>
                            <strong style={{ color: '#00d084', fontSize: '13px' }}>Completion #{i + 1}:</strong>
                            <pre className="debug-completion">{resp}</pre>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Configuration Modal */}
      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}

export default App;
