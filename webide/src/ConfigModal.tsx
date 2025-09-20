import React, { useState } from 'react';
import { loadConfig, saveConfig, type AppConfig, type ModelConfig } from './config';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, onConfigChange }) => {
  const [config, setConfig] = useState<AppConfig>(loadConfig());

  if (!isOpen) return null;

  const handleModelUpdate = (modelKey: 'starcoder' | 'alternative', field: keyof ModelConfig, value: any) => {
    const updatedConfig = { ...config };
    updatedConfig.models[modelKey] = { ...updatedConfig.models[modelKey], [field]: value };
    setConfig(updatedConfig);
  };

  const handleSave = () => {
    saveConfig(config);
    onConfigChange();
    onClose();
  };

  const handleReset = () => {
    if (confirm('Reset to default configuration? This will clear all custom settings.')) {
      localStorage.removeItem('vllm_webide_config');
      window.location.reload();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        border: '1px solid #ddd',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#333' }}>⚙️ Configuration</h2>
          <button 
            onClick={onClose}
            style={{
              background: '#f44336',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#333', marginBottom: '12px' }}>🤖 Model Configurations</h3>
          
          {/* StarCoder2 7B Configuration */}
          <div style={{ marginBottom: '20px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: '#2196f3' }}>StarCoder2 7B</h4>
              <input
                type="checkbox"
                checked={config.models.starcoder.enabled}
                onChange={(e) => handleModelUpdate('starcoder', 'enabled', e.target.checked)}
                style={{ marginLeft: '12px' }}
              />
              <label style={{ marginLeft: '4px', fontSize: '12px' }}>Enabled</label>
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Endpoint URL:
              </label>
              <input
                type="text"
                value={config.models.starcoder.endpoint}
                onChange={(e) => handleModelUpdate('starcoder', 'endpoint', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                placeholder="http://localhost:8000"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Max Tokens:
                </label>
                <input
                  type="number"
                  value={config.models.starcoder.maxTokens}
                  onChange={(e) => handleModelUpdate('starcoder', 'maxTokens', parseInt(e.target.value))}
                  style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Temperature:
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={config.models.starcoder.temperature}
                  onChange={(e) => handleModelUpdate('starcoder', 'temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* Alternative Model Configuration */}
          <div style={{ marginBottom: '20px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ margin: 0, color: '#ff9800' }}>Alternative Model</h4>
              <input
                type="checkbox"
                checked={config.models.alternative.enabled}
                onChange={(e) => handleModelUpdate('alternative', 'enabled', e.target.checked)}
                style={{ marginLeft: '12px' }}
              />
              <label style={{ marginLeft: '4px', fontSize: '12px' }}>Enabled</label>
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Endpoint URL:
              </label>
              <input
                type="text"
                value={config.models.alternative.endpoint}
                onChange={(e) => handleModelUpdate('alternative', 'endpoint', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
                placeholder="http://localhost:8001"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Max Tokens:
                </label>
                <input
                  type="number"
                  value={config.models.alternative.maxTokens}
                  onChange={(e) => handleModelUpdate('alternative', 'maxTokens', parseInt(e.target.value))}
                  style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Temperature:
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={config.models.alternative.temperature}
                  onChange={(e) => handleModelUpdate('alternative', 'temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#333', marginBottom: '12px' }}>🎛️ API Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Default Model:
              </label>
              <select
                value={config.api.defaultModel}
                onChange={(e) => setConfig({ ...config, api: { ...config.api, defaultModel: e.target.value as 'starcoder' | 'alternative' } })}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="starcoder">StarCoder2 7B</option>
                <option value="alternative">Alternative Model</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Timeout (ms):
              </label>
              <input
                type="number"
                value={config.api.timeout}
                onChange={(e) => setConfig({ ...config, api: { ...config.api, timeout: parseInt(e.target.value) } })}
                style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>🔄 Editor Layout</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>
              <strong>Dual Editor Mode:</strong> Both models enabled = Split-screen layout<br/>
              <strong>Single Editor Mode:</strong> Only one model enabled = Full-width editor
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setConfig({
                    ...config,
                    models: {
                      ...config.models,
                      starcoder: { ...config.models.starcoder, enabled: true },
                      alternative: { ...config.models.alternative, enabled: true }
                    }
                  });
                }}
                style={{
                  background: '#4caf50',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🔄 Enable Dual Mode
              </button>
              <button
                onClick={() => {
                  const enablePrimary = config.api.defaultModel;
                  const disableSecondary = enablePrimary === 'starcoder' ? 'alternative' : 'starcoder';
                  setConfig({
                    ...config,
                    models: {
                      ...config.models,
                      [enablePrimary]: { ...config.models[enablePrimary], enabled: true },
                      [disableSecondary]: { ...config.models[disableSecondary], enabled: false }
                    }
                  });
                }}
                style={{
                  background: '#ff9800',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                📱 Enable Single Mode
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#333', marginBottom: '12px' }}>🎨 Editor Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableSyntaxChecking}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableSyntaxChecking: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Syntax Checking</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableSemanticValidation}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableSemanticValidation: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Semantic Validation</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableTypeScriptDiagnostics}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableTypeScriptDiagnostics: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>TypeScript Diagnostics</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableJavaScriptDiagnostics}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableJavaScriptDiagnostics: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>JavaScript Diagnostics</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableSpellCheck}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableSpellCheck: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Spell Check</strong>
              </label>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableSuggestionChecking}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableSuggestionChecking: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Suggestion Diagnostics</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.enableQuickInfo}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, enableQuickInfo: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Quick Info & Hover</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.showUnusedWarnings}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, showUnusedWarnings: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Unused Variable Warnings</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={config.editor.showDeprecatedWarnings}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    editor: { ...config.editor, showDeprecatedWarnings: e.target.checked } 
                  })}
                  style={{ marginRight: '8px' }}
                />
                <strong>Deprecated API Warnings</strong>
              </label>
            </div>
          </div>
          
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#e65100' }}>
              <strong>💡 Tip:</strong> Disable syntax checking for faster performance or when working with complex code patterns. 
              Changes take effect immediately in the editor.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            style={{
              background: '#9e9e9e',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🔄 Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            💾 Save Configuration
          </button>
        </div>

        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#666' }}>💡 URL Parameters</h4>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
            You can also configure endpoints via URL parameters:<br/>
            <code>?starcoder_endpoint=http://localhost:8000&alternative_endpoint=http://localhost:8001&default_model=starcoder</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
