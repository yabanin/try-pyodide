# Pyodideの試用

ブラウザでPythonを実行できる環境を提供するにはどんな方法が良いか、ためしにPyodideを使ってみることにした。

Pyodideドキュメント
[https://pyodide.org/en/stable/index.html](https://pyodide.org/en/stable/index.html])


デモページ
[https://yabanin.github.io/try-pyodide/](https://yabanin.github.io/try-pyodide/)

## Pyodideでできること
- サーバー不要の実行  
Pythonのコードをサーバー側ではなく、すべて手元のブラウザで実行できる
- ライブラリの利用  
NumPy、pandas、SciPy、Matplotlib、scikit-learn といった主要なデータ分析・科学技術計算・機械学習ライブラリがブラウザ上で動作する
- パッケージ管理  
 micropip を使って、PyPIからPythonのパッケージをインストールできる


## Pyodideの実行方法
 インポート
```html
<script src="https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js"></script>
```

初期化
```javascript
let pyodide = loadPyodide()
```

実行
```javascript
pyodide.runPython(`#python code
print("Hello, World!")
`)
```

## 本コードでの実装

今回はブラウザでコードエディタのように操作できる環境で、Pythonが実行できるかを試したかったため、コードの保存やファイルの追加は実装していない。


main.pyとexternal_code.pyはレポジトリのsample-src/にあるもの取得して、実行している。
