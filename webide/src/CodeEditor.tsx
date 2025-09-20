import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { getEditorConfig, type EditorConfig } from './config';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string | undefined) => void;
  onRequestCompletion: (code: string, position: number) => Promise<string[]>;
  onCompletionAccepted?: (selectedCompletion: string, originalPrompt: string, fimCompletion: string) => void; // New callback
  triggerCompletionSignal?: number; // incremented to trigger completion externally
  onTab?: () => void; // callback for Tab key
  editorLabel?: string; // label for the editor
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, language, onChange, onRequestCompletion, onCompletionAccepted, triggerCompletionSignal, onTab, editorLabel }) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const lastSuggestionsRef = useRef<string[]>([]);
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(getEditorConfig());

  const handleEditorDidMount: OnMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Configure Monaco editor based on configuration settings
    const configureEditor = () => {
      const config = getEditorConfig();
      
      // Configure TypeScript compiler options for diagnostics
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types'],
        strict: config.enableTypeScriptDiagnostics,
        noUnusedLocals: config.showUnusedWarnings,
        noUnusedParameters: config.showUnusedWarnings,
        noImplicitAny: config.enableSyntaxChecking,
        strictNullChecks: config.enableSyntaxChecking,
      });

      // Configure JavaScript compiler options for diagnostics
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        allowJs: true,
        noEmit: true,
        esModuleInterop: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        strict: config.enableJavaScriptDiagnostics,
        noUnusedLocals: config.showUnusedWarnings,
        noUnusedParameters: config.showUnusedWarnings,
      });

      // Configure diagnostics options
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: !config.enableSemanticValidation,
        noSyntaxValidation: !config.enableSyntaxChecking,
        noSuggestionDiagnostics: !config.enableSuggestionChecking,
      });

      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: !config.enableSemanticValidation,
        noSyntaxValidation: !config.enableSyntaxChecking,
        noSuggestionDiagnostics: !config.enableSuggestionChecking,
      });

      // Update editor options
      editor.updateOptions({
        quickSuggestions: config.enableQuickInfo,
        parameterHints: {
          enabled: config.enableQuickInfo
        },
        hover: {
          enabled: config.enableQuickInfo
        },
        occurrencesHighlight: config.enableSyntaxChecking,
        selectionHighlight: config.enableSyntaxChecking,
        wordHighlight: config.enableSyntaxChecking,
      });

      console.log('✅ Monaco editor configured with settings:', config);
    };

    // Initial configuration
    configureEditor();
      // Listen for configuration changes
    const configUpdateInterval = setInterval(() => {
      const newConfig = getEditorConfig();
      if (JSON.stringify(newConfig) !== JSON.stringify(editorConfig)) {
        setEditorConfig(newConfig);
        configureEditor();
        console.log('🔄 Editor configuration updated');
      }
    }, 1000); // Check every second

    // Cleanup function for the interval
    const cleanup = () => {
      clearInterval(configUpdateInterval);
    };

    // Store cleanup function for later use
    (editor as any)._configCleanup = cleanup;

    // Store fetched completions and original context for tracking accepted completions
    let pendingCompletions: string[] = [];
    let originalFimPrompt: string = '';
    let completionContext: { code: string; position: any } | null = null;
    let recentCompletionDecorations: string[] = []; // Track decorations for highlighting
    
    // Register completion provider that uses pre-fetched completions
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: async (_model: any, position: any) => {
        console.log('Monaco completion provider called at', position);
        
        // Check if we have pending completions from Tab key press
        if (pendingCompletions.length > 0) {
          const completions = [...pendingCompletions]; // Copy the array
          console.log(`Using pending completions (${completions.length}):`, completions);
          
          // Don't clear immediately - let the user see all suggestions
          
          return {
            suggestions: completions.map((completion: string, index: number) => {
              const cleanText = completion.trim();
              
              // Create a more readable label
              const lines = cleanText.split('\n');
              const firstLine = lines[0] || cleanText;
              const previewText = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
              
              return {
                label: {
                  label: `${index + 1}. ${previewText}`,
                  detail: ` (${lines.length} line${lines.length !== 1 ? 's' : ''})`
                },
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: cleanText,
                detail: `StarCoder2 7B - Suggestion ${index + 1}`,
                documentation: {
                  value: `**vLLM Completion ${index + 1}**\n\n\`\`\`${language}\n${cleanText}\n\`\`\``,
                  isTrusted: true
                },
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endColumn: position.column,
                },
                sortText: `${index.toString().padStart(3, '0')}`,
                filterText: previewText,
                preselect: index === 0, // Preselect the first suggestion
                commitCharacters: ['\t', '\n'],
                // Add a command to track when this completion is accepted
                command: {
                  id: 'vllm.completionAccepted',
                  title: 'Track Completion Acceptance',
                  arguments: [cleanText, originalFimPrompt]
                }
              };
            }),
          };
        }
        
        // Fallback: return empty suggestions (don't auto-fetch to avoid conflicts)
        console.log('No pending completions available');
        return { suggestions: [] };
      },
      triggerCharacters: [], // No automatic triggers - only manual via Tab/Ctrl+Space
    });

    // Register command for tracking completion acceptance
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => {
      // This is just a placeholder command registration
    });    // Register a command handler for completion acceptance tracking
    monaco.editor.registerCommand('vllm.completionAccepted', (_accessor: any, acceptedText: string, originalPrompt: string) => {
      console.log('🎉 Completion accepted via command!');
      console.log('📝 Accepted text:', acceptedText);
      console.log('📋 Original prompt:', originalPrompt);
      
      if (onCompletionAccepted) {
        const fimCompletion = originalPrompt.replace('<fim_middle>', `<fim_middle>${acceptedText}`);
        
        // Highlight the accepted completion if we have context
        if (completionContext) {
          highlightAcceptedCompletion(completionContext.position, acceptedText);
        }
        
        onCompletionAccepted(acceptedText, originalPrompt, fimCompletion);
        
        // Clear the context
        originalFimPrompt = '';
        completionContext = null;
        pendingCompletions = [];
      }
    });    // Function to highlight recently accepted completion text
    const highlightAcceptedCompletion = (startPosition: any, acceptedText: string) => {
      if (!acceptedText || acceptedText.trim().length === 0) return;
      
      const lines = acceptedText.split('\n');
      const ranges = [];
      
      let currentLine = startPosition.lineNumber;
      let currentColumn = startPosition.column;
      
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        
        if (i === 0) {
          // First line: start from the insertion column
          if (lineText.length > 0) {
            ranges.push({
              startLineNumber: currentLine,
              startColumn: currentColumn,
              endLineNumber: currentLine,
              endColumn: currentColumn + lineText.length
            });
          }
        } else {
          // Subsequent lines: full line width
          if (lineText.length > 0) {
            ranges.push({
              startLineNumber: currentLine,
              startColumn: 1,
              endLineNumber: currentLine,
              endColumn: lineText.length + 1
            });
          }
        }
        
        if (i < lines.length - 1) {
          currentLine++;
          currentColumn = 1;
        } else {
          currentColumn += lineText.length;
        }
      }
      
      if (ranges.length === 0) return; // Nothing to highlight
      
      // Clear previous decorations
      recentCompletionDecorations = editor.deltaDecorations(recentCompletionDecorations, []);
      
      // Add new decorations with highlighting
      const decorations = ranges.map(range => ({
        range: range,
        options: {
          className: 'auto-completion-highlight',
          inlineClassName: 'auto-completion-inline',
          hoverMessage: { 
            value: `**🤖 Auto-completed Text**\n\nThis text was recently inserted by the AI completion system.\n\n*Press Escape to clear highlighting*`
          }
        }
      }));
      
      recentCompletionDecorations = editor.deltaDecorations([], decorations);
      
      console.log(`🎨 Highlighted ${ranges.length} range(s) for auto-completed text`);
      
      // Remove highlight after 15 seconds
      setTimeout(() => {
        recentCompletionDecorations = editor.deltaDecorations(recentCompletionDecorations, []);
        console.log('⏰ Auto-completion highlighting expired');
      }, 15000);
    };

    // Listen for completion acceptance events using Monaco's built-in events
    editor.onDidChangeModelContent((e: any) => {
      // Check if the change was due to accepting a completion
      if (e.changes && e.changes.length > 0 && originalFimPrompt && pendingCompletions.length > 0) {
        const change = e.changes[0];
        const insertedText = change.text;
        
        // More lenient matching - check if any part of the inserted text matches a completion
        const matchingCompletion = pendingCompletions.find(completion => {
          const cleanCompletion = completion.trim();
          const cleanInserted = insertedText.trim();
          
          // Check various matching conditions
          return cleanCompletion === cleanInserted || 
                 cleanInserted.includes(cleanCompletion) ||
                 cleanCompletion.includes(cleanInserted) ||
                 (cleanCompletion.length > 10 && cleanInserted.length > 5 && 
                  cleanCompletion.substring(0, Math.min(50, cleanInserted.length)) === cleanInserted.substring(0, Math.min(50, cleanCompletion.length)));
        });        if (matchingCompletion && onCompletionAccepted && completionContext) {
          // Create the FIM completion by appending the selected text to <fim_middle>
          const fimCompletion = originalFimPrompt.replace('<fim_middle>', `<fim_middle>${insertedText}`);
          
          console.log('✅ Completion accepted!');
          console.log('📝 Inserted text:', insertedText);
          console.log('🎯 Matching completion:', matchingCompletion);
          console.log('📋 FIM completion:', fimCompletion);
          
          // Highlight the accepted completion text using the actual change position
          const highlightPosition = {
            lineNumber: change.range.startLineNumber,
            column: change.range.startColumn
          };
          highlightAcceptedCompletion(highlightPosition, insertedText);
          
          onCompletionAccepted(insertedText, originalFimPrompt, fimCompletion);
          
          // Clear the context after successful tracking
          originalFimPrompt = '';
          completionContext = null;
          pendingCompletions = [];
        }
      }
    });

    // Alternative: Listen for suggestion widget acceptance events
    editor.onDidCompositionEnd(() => {
      // This fires when text composition ends, which can include completion acceptance
      console.log('🔍 Composition ended - checking for completion acceptance');
    });    // Listen for Tab key and Ctrl+Space to fetch completions and trigger suggestion widget
    editor.onKeyDown(async (e: any) => {
      // Escape key to clear highlighting
      if (e.keyCode === monaco.KeyCode.Escape) {
        if (recentCompletionDecorations.length > 0) {
          recentCompletionDecorations = editor.deltaDecorations(recentCompletionDecorations, []);
          console.log('🧹 Cleared auto-completion highlighting');
        }
      }
      
      // Tab key handler
      if (e.keyCode === monaco.KeyCode.Tab) {
        e.preventDefault(); // Prevent default tab behavior
        e.stopPropagation();
        
        console.log('Tab key pressed, fetching completions...');
        
        // Get current position and code
        const position = editor.getPosition();
        const model = editor.getModel();
        const code = model.getValue();
        const offset = model.getOffsetAt(position);
        
        try {          // Store the context for completion tracking
          completionContext = { code, position };
          
          // Generate and store the original FIM prompt for tracking
          const prefix = code.substring(0, offset);
          const suffix = code.substring(offset);
          originalFimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
          
          // Fetch completions
          const suggestions = await onRequestCompletion(code, offset);
          console.log(`Tab: Fetched ${suggestions.length} completions:`, suggestions);
          
          if (suggestions.length > 0) {
            // Store completions for the completion provider
            pendingCompletions = suggestions;
            
            // Clear any cached suggestions
            lastSuggestionsRef.current = [];
            
            console.log('📋 Stored completions for tracking:', suggestions);
            console.log('🎯 Original FIM prompt stored:', originalFimPrompt);
            
            // Trigger the suggestion widget immediately
            editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
            console.log('Triggered suggestion widget');
            
            // Clear pending completions after a short delay to allow the widget to show
            setTimeout(() => {
              console.log('🕒 Clearing pending completions after timeout');
              pendingCompletions = [];
            }, 5000); // Increased timeout to 5 seconds for better testing
          } else {
            console.log('No completions received');
          }
        } catch (error) {
          console.error('Error fetching completions on Tab:', error);
        }
        
        // Call the onTab callback for debug logging
        if (onTab) onTab();
      }
      
      // Ctrl+Space handler (alternative trigger)
      if (e.keyCode === monaco.KeyCode.Space && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Ctrl+Space pressed, fetching completions...');
        
        const position = editor.getPosition();
        const model = editor.getModel();
        const code = model.getValue();
        const offset = model.getOffsetAt(position);
        
        try {          // Store the context for completion tracking
          completionContext = { code, position };
          
          // Generate and store the original FIM prompt for tracking
          const prefix = code.substring(0, offset);
          const suffix = code.substring(offset);
          originalFimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;
          
          const suggestions = await onRequestCompletion(code, offset);
          console.log(`Ctrl+Space: Fetched ${suggestions.length} completions:`, suggestions);
          
          if (suggestions.length > 0) {
            pendingCompletions = suggestions;
            lastSuggestionsRef.current = [];
            
            editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
            console.log('Triggered suggestion widget via Ctrl+Space');
            
            // Clear pending completions after a short delay
            setTimeout(() => {
              console.log('🕒 Clearing pending completions after Ctrl+Space timeout');
              pendingCompletions = [];
            }, 5000); // Increased timeout to 5 seconds for better testing
          }
        } catch (error) {
          console.error('Error fetching completions on Ctrl+Space:', error);
        }
      }
    });
  };

  // Effect to trigger completion externally
  useEffect(() => {
    if (editorRef.current && monacoRef.current && triggerCompletionSignal && triggerCompletionSignal > 0) {
      // Small delay to ensure the completion provider is ready
      setTimeout(() => {
        editorRef.current.trigger('external', 'editor.action.triggerSuggest', {});
      }, 100);
    }
  }, [triggerCompletionSignal]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up configuration update interval when component unmounts
      if (editorRef.current && (editorRef.current as any)._configCleanup) {
        (editorRef.current as any)._configCleanup();
      }
    };
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {editorLabel && (
        <div style={{ 
          padding: '8px 12px', 
          backgroundColor: '#333', 
          color: '#fff', 
          fontSize: '14px',
          fontWeight: 'bold',
          borderBottom: '1px solid #555'
        }}>
          {editorLabel}
        </div>
      )}
      <Editor
        height="100%"
        width="100%"
        defaultLanguage={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 16,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          suggest: {
            showSnippets: true,
            showWords: false,
            showMethods: true,
            showFunctions: true,
            showConstructors: true,
            showFields: true,
            showVariables: true,
            showClasses: true,
            showStructs: true,
            showInterfaces: true,
            showModules: true,
            showProperties: true,
            showEvents: true,
            showOperators: true,
            showValues: true,
            showConstants: true,
            showEnums: true,
            showEnumMembers: true,
            showKeywords: false,
            showColors: true,
            showFiles: true,
            showReferences: true,
            showFolders: true,
            showTypeParameters: true,
            filterGraceful: true,
            snippetsPreventQuickSuggestions: false,
            localityBonus: false,
            shareSuggestSelections: false,
          },
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          tabCompletion: 'on',
          quickSuggestions: {
            other: false,
            comments: false,
            strings: false
          },
          quickSuggestionsDelay: 100,
          suggestOnTriggerCharacters: true,
          wordBasedSuggestions: 'off',
        }}
      />
    </div>
  );
};

export default CodeEditor;
