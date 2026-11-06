import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import './App.css'

// OS のダークモード設定に合わせてエディタのテーマを切り替える
function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)'
  const [dark, setDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return dark
}

const BASE_URL = 'https://raw.githubusercontent.com/yabanin/try-pyodide/refs/heads/main/sample-src'

// 先頭のファイルがエントリーポイントとして実行される
const FILES = [
  { name: 'main.py', url: `${BASE_URL}/main.py` },
  { name: 'external_code.py', url: `${BASE_URL}/external_code.py` },
]
const MAIN_FILE = FILES[0].name

const DEFAULT_STDIN = `Pyodide
1 2
`

// Load Pyodide only once (even with StrictMode double-invoking effects)
let pyodidePromise = null
function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = window.loadPyodide()
  }
  return pyodidePromise
}

function App() {
  const [files, setFiles] = useState(() => Object.fromEntries(FILES.map((f) => [f.name, ''])))
  const [activeFile, setActiveFile] = useState(MAIN_FILE)
  const [stdin, setStdin] = useState(DEFAULT_STDIN)
  const [output, setOutput] = useState('')
  const [isError, setIsError] = useState(false)
  const [status, setStatus] = useState('loading') // loading | ready | running
  const pyodideRef = useRef(null)
  const theme = usePrefersDark() ? 'vs-dark' : 'light'

  useEffect(() => {
    getPyodide()
      .then((pyodide) => {
        pyodideRef.current = pyodide
        setStatus('ready')
      })
      .catch((err) => {
        setOutput(`Pyodide の読み込みに失敗しました: ${err}`)
        setIsError(true)
      })

    FILES.forEach(async ({ name, url }) => {
      try {
        const response = await fetch(url)
        const text = await response.text()
        setFiles((prev) => ({ ...prev, [name]: text }))
      } catch (err) {
        console.error(`Failed to load ${name}:`, err)
      }
    })
  }, [])

  async function runCode() {
    const pyodide = pyodideRef.current
    if (!pyodide) return

    setStatus('running')
    setOutput('')
    setIsError(false)

    // エディタで編集中の全ファイルを Pyodide の FS に配置
    for (const [name, content] of Object.entries(files)) {
      pyodide.FS.writeFile(name, content, { encoding: 'utf8' })
    }
    // import のキャッシュを破棄して編集内容を反映させる
    pyodide.runPython(
      `import sys\nfor m in ${JSON.stringify(FILES.map((f) => f.name.replace(/\.py$/, '')))}: sys.modules.pop(m, None)`,
    )
    const code = files[MAIN_FILE]

    // 標準入力: 1行ずつ input() に渡す
    const lines = stdin.split('\n')
    let lineIndex = 0
    pyodide.setStdin({
      stdin: () => (lineIndex < lines.length ? lines[lineIndex++] : undefined),
    })

    // 標準出力 / 標準エラー出力を収集
    const out = []
    pyodide.setStdout({ batched: (s) => out.push(s) })
    pyodide.setStderr({ batched: (s) => out.push(s) })

    try {
      // 実行ごとにグローバル変数をリセット
      const globals = pyodide.globals.get('dict')()
      await pyodide.loadPackagesFromImports(code)
      await pyodide.runPythonAsync(code, { globals })
      globals.destroy()
      setOutput(out.join('\n'))
    } catch (err) {
      out.push(String(err.message ?? err))
      setOutput(out.join('\n'))
      setIsError(true)
    } finally {
      setStatus('ready')
    }
  }

  // Monaco のコマンドは登録時のクロージャを保持するため、最新の runCode を ref 経由で呼ぶ
  const runRef = useRef(null)
  useEffect(() => {
    runRef.current = () => {
      if (status === 'ready') runCode()
    }
  })

  function handleEditorMount(editor, monaco) {
    // Ctrl/Cmd + Enter で実行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.())
  }

  const buttonLabel =
    status === 'loading' ? 'Pyodide 読み込み中…' : status === 'running' ? '実行中…' : '▶ 実行'

  return (
    <main className="playground">
      <p>PyodideでPython実行環境を作るデモ。 レポジトリ：<a href='https://github.com/yabanin/try-pyodide'>https://github.com/yabanin/try-pyodide</a></p>
      <section className="panel">
        <label>コード</label>
        <div className="tabs" role="tablist">
          {FILES.map(({ name }) => (
            <button
              key={name}
              role="tab"
              aria-selected={name === activeFile}
              className={`tab${name === activeFile ? ' active' : ''}`}
              onClick={() => setActiveFile(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="editor">
          <Editor
            height="360px"
            defaultLanguage="python"
            path={activeFile}
            value={files[activeFile]}
            onChange={(value) => setFiles((prev) => ({ ...prev, [activeFile]: value ?? '' }))}
            onMount={handleEditorMount}
            theme={theme}
            options={{
              fontSize: 15,
              minimap: { enabled: false },
              tabSize: 4,
              insertSpaces: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
        <div className="toolbar">
          <button onClick={runCode} disabled={status !== 'ready'}>
            {buttonLabel}
          </button>
          <span className="hint">Ctrl / ⌘ + Enter でも実行できます</span>
        </div>
      </section>

      <div className="io">
        <section className="panel">
          <label htmlFor="stdin">標準入力</label>
          <textarea
            id="stdin"
            className="stdin"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            spellCheck={false}
            rows={8}
          />
        </section>

        <section className="panel">
          <label>出力</label>
          <pre className={`output${isError ? ' error' : ''}`}>{output}</pre>
        </section>
      </div>
    </main>
  )
}

export default App
