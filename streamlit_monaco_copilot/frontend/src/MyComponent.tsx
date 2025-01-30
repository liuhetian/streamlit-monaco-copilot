import {
  Streamlit,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import React, { useEffect, useState, ReactElement, useRef } from "react"
import Editor, { OnMount, loader } from "@monaco-editor/react"
import * as monaco from 'monaco-editor'

/**
 * This is a React-based component template. The passed props are coming from the 
 * Streamlit library. Your custom args can be accessed via the `args` props.
 */

// Generate UUID function
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Editor Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div>Editor failed to load. Please refresh the page to retry.</div>
    }

    return this.props.children
  }
}

function MyComponent({ args, disabled, theme }: ComponentProps): ReactElement {
  const { suggestion, defaultLanguage = "python", initialCode = "" } = args
  const [code, setCode] = useState(initialCode)
  const [show, setShow] = useState(true)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const disposableRef = useRef<monaco.IDisposable | null>(null)

  // Ensure editor loads only once
  useEffect(() => {
    loader.init().then(() => {
      setIsEditorReady(true)
    }).catch(error => {
      console.error('Monaco Editor failed to load:', error)
    })
  }, [])

  useEffect(() => {
    Streamlit.setFrameHeight()
  }, [theme])

  useEffect(() => {
    if (suggestion) {
      setShow(true)
    }
  }, [suggestion])

  // Cleanup function
  useEffect(() => {
    return () => {
      if (disposableRef.current) {
        disposableRef.current.dispose()
      }
    }
  }, [])

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !show || !suggestion || !isEditorReady) return

    const editor = editorRef.current
    const monaco = monacoRef.current

    try {
      // Clear old provider
      if (disposableRef.current) {
        disposableRef.current.dispose()
      }

      editor.trigger('keyboard', 'editor.action.inlineSuggest.hide', {})

      disposableRef.current = monaco.languages.registerInlineCompletionsProvider(defaultLanguage, {
        provideInlineCompletions: (model, position) => {
          return {
            items: [{
              insertText: suggestion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            }]
          }
        },
        freeInlineCompletions: () => {}
      })

      const position = editor.getPosition()
      if (position) {
        const tempPosition = position.clone()
        editor.setPosition({ lineNumber: tempPosition.lineNumber, column: tempPosition.column + 1 })
        setTimeout(() => {
          if (editor.getModel()) {
            editor.setPosition(tempPosition)
            editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
          }
        }, 50)
      }
    } catch (error) {
      console.error('Failed to set inline suggestions:', error)
    }
  }, [suggestion, show, isEditorReady, defaultLanguage])

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value)
      setShow(false)
    }
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    try {
      editorRef.current = editor
      monacoRef.current = monaco

      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        try {
          const model = editor.getModel()
          const position = editor.getPosition()
          
          if (model && position) {
            const beforeCursor = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            })

            const afterCursor = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: model.getLineCount(),
              endColumn: model.getLineMaxColumn(model.getLineCount())
            })

            // 获取选中的文本
            const selection = editor.getSelection()
            const selectedText = selection ? model.getValueInRange(selection) : ""

            // 获取光标位置
            const cursorPosition = {
              lineNumber: position.lineNumber,
              column: position.column
            }

            const dataToSend = {
              beforeCursor,
              afterCursor,
              selectedText,
              cursorPosition,
              uuid: generateUUID()
            }

            Streamlit.setComponentValue(dataToSend)
          }
        } catch (error) {
          console.error('Failed to send data:', error)
        }
      })

      editor.onDidChangeCursorPosition(() => {
        setShow(false)
      })
    } catch (error) {
      console.error('Failed to mount editor:', error)
    }
  }

  const handleEditorWillMount = (monaco: typeof import('monaco-editor')) => {
    // Configure Monaco instance
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true
    })
  }

  const handleEditorValidation = (markers: any[]) => {
    // Handle editor validation errors
    if (markers.length > 0) {
      console.log('Editor validation warnings:', markers)
    }
  }

  return (
    <ErrorBoundary>
      <div style={{ border: `1px solid ${theme?.primaryColor || "gray"}`, minHeight: "200px" }}>
        {isEditorReady ? (
          <Editor
            height="200px"
            defaultLanguage={defaultLanguage}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
            loading={<div>Loading editor...</div>}
            options={{
              minimap: { enabled: false },
              lineNumbers: "on",
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: disabled,
              inlineSuggest: {
                enabled: show,
                mode: "subwordSmart",
                showToolbar: "never"
              }
            }}
          />
        ) : (
          <div>Initializing editor...</div>
        )}
      </div>
    </ErrorBoundary>
  )
}

// "withStreamlitConnection" is a wrapper function. It bootstraps the
// connection between your component and the Streamlit app, and handles
// passing arguments from Python -> Component.
//
// You don't need to edit withStreamlitConnection (but you're welcome to!).
export default withStreamlitConnection(MyComponent)
