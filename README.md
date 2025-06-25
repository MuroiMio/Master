# 🎵 Master

Node.jsで作られたプロフェッショナルなオーディオマスタリングツールです。inputディレクトリの音声ファイルを自動的に処理し、音圧を向上させた高品質なマスタリング済みファイルをoutputディレクトリに出力します。

## ✨ 特徴

- **バッチ処理** - ディレクトリ内の全音声ファイルを一括処理
- **高音圧マスタリング** - プロレベルの音圧向上処理
- **複数プリセット** - ジャンル別の最適化された設定
- **自動フォールバック** - エラー時の自動回復機能
- **詳細な音声解析** - ピークレベル、RMS、ダイナミックレンジの分析

## 🚀 クイックスタート

### 1. 必要な環境

- **Node.js** (v12以上)
- **FFmpeg** (システムにインストール必須)

#### FFmpegのインストール

```bash
# Windows (Chocolatey)
choco install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# または公式サイトからダウンロード
# https://ffmpeg.org/download.html
```

### 2. プロジェクトセットアップ

```bash
# プロジェクトフォルダを作成
mkdir Master
cd Master

# index.jsファイルを作成（プログラムコードを貼り付け）
# inputディレクトリを作成
mkdir input

# 音声ファイルをinputディレクトリに配置
cp your-audio-files.wav input/
```

### 3. 実行

```bash
# 基本実行（デフォルト音圧重視設定）
node index.js

# プリセット指定実行
node index.js input output rock
```

## 📁 ディレクトリ構成

```
your-project/
├── index.js              # メインプログラム
├── input/                # 処理対象の音声ファイル
│   ├── song1.wav
│   ├── song2.mp3
│   └── track3.flac
└── output/               # 処理済みファイル（自動作成）
    ├── song1_mastered.mp3
    ├── song2_mastered.mp3
    └── track3_mastered.mp3
```

## 🎛️ 使用方法

### 基本コマンド

```bash
# デフォルト設定で実行
node index.js

# カスタムディレクトリ指定
node index.js my_input my_output

# プリセット付きで実行
node index.js input output [プリセット名]
```

### プリセット一覧

| プリセット | 特徴 | 用途 |
|-----------|------|------|
| `pop` | バランス重視、中高音強調 | ポップス、J-POP |
| `rock` | 高音圧、パワフル | ロック、メタル |
| `classical` | 自然な音質、軽い圧縮 | クラシック、ジャズ |
| `loudness` | 最高音圧、超強力圧縮 | EDM、ヒップホップ |

### 使用例

```bash
# ポップス向けマスタリング
node index.js input output pop

# ロック向け高音圧マスタリング
node index.js input output rock

# 最高音圧設定
node index.js input output loudness
```

## 🎵 対応ファイル形式

### 入力対応形式
- **WAV** (.wav)
- **MP3** (.mp3)
- **FLAC** (.flac)
- **AAC** (.aac, .m4a)
- **OGG** (.ogg)
- **WMA** (.wma)

### 出力形式
- **MP3** (320kbps, 44.1kHz, ステレオ)

## ⚙️ マスタリング処理内容

### 音圧向上プロセス

1. **音声解析**
   - ピークレベル検出
   - RMSレベル測定
   - ダイナミックレンジ分析

2. **マスタリング処理**
   - 強力なコンプレッサー（ratio 4-8）
   - イコライザー調整
   - 音量ブースト（+4〜6dB）
   - リミッター（クリッピング防止）

3. **品質保証**
   - 自動ピーク制限（-0.1dB以下）
   - ステレオ幅最適化
   - 高品質MP3エンコード

### プリセット詳細

#### 🎤 Pop プリセット
```
- コンプレッサー: -10dB threshold, 4:1 ratio
- イコライザー: 低音+1dB, 中音+1dB, 高音+2dB
- 音量ブースト: +4dB
```

#### 🎸 Rock プリセット
```
- コンプレッサー: -8dB threshold, 6:1 ratio
- イコライザー: 低音+3dB, 中音+2dB, 高音+4dB
- 音量ブースト: +4dB
```

#### 🎼 Classical プリセット
```
- コンプレッサー: -15dB threshold, 3:1 ratio
- イコライザー: 低音±0dB, 中音±0dB, 高音+1dB
- 音量ブースト: +4dB
```

#### 🔥 Loudness プリセット
```
- コンプレッサー: -6dB threshold, 8:1 ratio
- イコライザー: 低音+2dB, 中音+3dB, 高音+3dB
- 音量ブースト: +6dB
```

## 🛠️ プログラム内での使用

```javascript
const { AudioMaster, MasteringPresets } = require('./index');

// 基本的な使用
const master = new AudioMaster();
await master
    .setInputFile('input.wav')
    .setOutputFile('output.mp3')
    .process();

// カスタム設定
master
    .setCompressor(true, -10, 6, 2, 50)
    .setEqualizer(true, 2, 1, 3)
    .setNormalization(false);

// プリセット使用
master.settings = MasteringPresets.rock();
```

## 📊 実行結果例

```
🎵 Audio Mastering Tool - Batch Processor

📁 入力ディレクトリ: input
📁 出力ディレクトリ: output
🎛️  プリセット: rock

🎵 3 個のファイルを処理します
📁 対象ファイル:
  1. song1.wav
  2. track2.mp3
  3. demo3.flac

🎯 処理中 (1/3): song1.wav
🎵 マスタリング処理を開始します...
📁 入力: input/song1.wav
📁 出力: output/song1_mastered.mp3
🔍 音声を解析中...
⏱️  継続時間: 180.45秒
📊 ピークレベル: -2.34 dBFS
📊 RMSレベル: -12.67 dBFS
📊 ダイナミックレンジ: 10.33 dB
🎛️  マスタリング処理中...
⏳ 処理中... time=00:03:00.45
✅ マスタリング処理が完了しました！
✅ 完了: song1_mastered.mp3

🎉 バッチ処理完了!
✅ 成功: 3 ファイル
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### ❌ FFmpegが見つからないエラー
```bash
# FFmpegがインストールされているか確認
ffmpeg -version

# パスが通っているか確認
which ffmpeg  # macOS/Linux
where ffmpeg  # Windows
```

#### ❌ 音声レベルが検出できない
- 無音ファイルの可能性
- ファイル形式の問題
- → 自動的にシンプルモードで処理されます

#### ❌ メモリ不足エラー
- 大きなファイルサイズ
- → ファイルを分割するか、他のアプリケーションを終了

#### ❌ 処理が遅い
- ファイルサイズに依存
- CPUパワーに依存
- → 一度に処理するファイル数を減らす

### エラーコード一覧

| エラーコード | 原因 | 対処法 |
|-------------|------|--------|
| 4294967262 | フィルター設定エラー | 自動的にシンプルモードで再試行 |
| 1 | ファイルが見つからない | ファイルパスを確認 |
| 2 | 権限エラー | ディレクトリの権限を確認 |

## 📈 パフォーマンス最適化

### 推奨環境
- **CPU**: 4コア以上
- **RAM**: 8GB以上
- **ストレージ**: SSD推奨

### 処理時間の目安
- **3分の楽曲**: 約30秒〜1分
- **アルバム10曲**: 約5〜10分
- **処理時間 ≈ 元ファイル時間 × 0.2〜0.3**

## 🔄 バージョン履歴

### v1.0.0
- 初回リリース
- 基本マスタリング機能
- バッチ処理対応
- 4つのプリセット搭載
<!-- 
## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🤝 貢献

バグ報告、機能要望、プルリクエストを歓迎します！

## 📞 サポート

問題が発生した場合は、以下の情報と共にお知らせください：

1. 使用しているOS
2. Node.jsバージョン (`node --version`)
3. FFmpegバージョン (`ffmpeg -version`)
4. エラーメッセージ全文
5. 処理しようとした音声ファイルの形式

---

🎵 **Happy Mastering!** 🎵 -->