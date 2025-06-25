const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class AudioMaster {
    constructor() {
        this.inputFile = '';
        this.outputFile = '';
        this.settings = {
            normalize: true,
            normalizeLevel: -1.0,
            compressor: {
                enabled: true,
                threshold: -12,
                ratio: 4,
                attack: 5,
                release: 50
            },
            equalizer: {
                enabled: true,
                lowGain: 0,      // 100Hz周辺
                midGain: 1,      // 1kHz周辺  
                highGain: 2      // 10kHz周辺
            },
            limiter: {
                enabled: true,
                ceiling: -0.1,
                release: 5
            },
            stereoEnhancer: {
                enabled: true,
                width: 1.2
            }
        };
    }

    // 入力ファイルを設定
    setInputFile(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`入力ファイルが見つかりません: ${filePath}`);
        }
        this.inputFile = filePath;
        return this;
    }

    // 出力ファイルを設定
    setOutputFile(filePath) {
        this.outputFile = filePath;
        return this;
    }

    // ノーマライゼーション設定
    setNormalization(enabled, level = -1.0) {
        this.settings.normalize = enabled;
        this.settings.normalizeLevel = level;
        return this;
    }

    // コンプレッサー設定
    setCompressor(enabled, threshold = -12, ratio = 4, attack = 5, release = 50) {
        this.settings.compressor = {
            enabled,
            threshold,
            ratio,
            attack,
            release
        };
        return this;
    }

    // イコライザー設定
    setEqualizer(enabled, lowGain = 0, midGain = 0, highGain = 0) {
        this.settings.equalizer = {
            enabled,
            lowGain,
            midGain,
            highGain
        };
        return this;
    }

    // リミッター設定
    setLimiter(enabled, ceiling = -0.1, release = 5) {
        this.settings.limiter = {
            enabled,
            ceiling,
            release
        };
        return this;
    }

    // ステレオエンハンサー設定
    setStereoEnhancer(enabled, width = 1.2) {
        this.settings.stereoEnhancer = {
            enabled,
            width
        };
        return this;
    }

    // FFmpegフィルターチェーンを構築（音圧重視版）
    buildFilterChain() {
        const filters = [];

        // イコライザー（音圧に有利な設定）
        if (this.settings.equalizer.enabled) {
            const eq = this.settings.equalizer;
            if (eq.lowGain !== 0) {
                filters.push(`equalizer=f=100:width_type=h:width=50:g=${Math.max(-20, Math.min(20, eq.lowGain))}`);
            }
            if (eq.midGain !== 0) {
                filters.push(`equalizer=f=1000:width_type=h:width=100:g=${Math.max(-20, Math.min(20, eq.midGain))}`);
            }
            if (eq.highGain !== 0) {
                filters.push(`equalizer=f=10000:width_type=h:width=200:g=${Math.max(-20, Math.min(20, eq.highGain))}`);
            }
        }

        // 強めのコンプレッサー（音圧アップ）
        if (this.settings.compressor.enabled) {
            const comp = this.settings.compressor;
            const threshold = Math.max(-60, Math.min(-1, comp.threshold));
            const ratio = Math.max(1, Math.min(20, comp.ratio));
            const attack = Math.max(0.01, Math.min(1000, comp.attack));
            const release = Math.max(0.01, Math.min(9000, comp.release));
            filters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}`);
        }

        // 音量アップ
        filters.push('volume=4dB');

        // リミッター（クリッピング防止）
        filters.push('alimiter=level_in=1:level_out=0.95:limit=-0.1dB:attack=1:release=5');

        // フィルターが少ない場合は基本の音圧アップ処理
        if (filters.length <= 2) {
            return 'acompressor=threshold=-12dB:ratio=6:attack=1:release=50,volume=6dB,alimiter=level_in=1:level_out=0.95:limit=-0.1dB:attack=1:release=5';
        }

        return filters.join(',');
    }

    // 音声解析
    async analyzeAudio() {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', this.inputFile,
                '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
                '-f', 'null',
                '-'
            ];

            const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
            let output = '';
            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    const analysis = this.parseAudioAnalysis(errorOutput);
                    resolve(analysis);
                } else {
                    reject(new Error(`音声解析エラー: ${errorOutput}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpegエラー: ${err.message}`));
            });
        });
    }

    // 解析結果をパース
    parseAudioAnalysis(output) {
        const analysis = {
            duration: 0,
            peakLevel: 0,
            rmsLevel: 0,
            dynamicRange: 0
        };

        // 継続時間を抽出
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
            const hours = parseInt(durationMatch[1]);
            const minutes = parseInt(durationMatch[2]);
            const seconds = parseFloat(durationMatch[3]);
            analysis.duration = hours * 3600 + minutes * 60 + seconds;
        }

        // ピークレベルとRMSレベルを抽出
        const peakMatch = output.match(/Max level: (-?\d+\.\d+) dBFS/);
        const rmsMatch = output.match(/RMS level: (-?\d+\.\d+) dBFS/);
        
        if (peakMatch) analysis.peakLevel = parseFloat(peakMatch[1]);
        if (rmsMatch) analysis.rmsLevel = parseFloat(rmsMatch[1]);

        analysis.dynamicRange = Math.abs(analysis.peakLevel - analysis.rmsLevel);

        return analysis;
    }

    // マスタリング処理を実行
    async process() {
        if (!this.inputFile) {
            throw new Error('入力ファイルが設定されていません');
        }

        if (!this.outputFile) {
            const ext = path.extname(this.inputFile);
            const basename = path.basename(this.inputFile, ext);
            this.outputFile = path.join(path.dirname(this.inputFile), `${basename}_mastered${ext}`);
        }

        console.log('🎵 マスタリング処理を開始します...');
        console.log(`📁 入力: ${this.inputFile}`);
        console.log(`📁 出力: ${this.outputFile}`);

        try {
            // 音声解析
            console.log('🔍 音声を解析中...');
            const analysis = await this.analyzeAudio();
            console.log(`⏱️  継続時間: ${analysis.duration.toFixed(2)}秒`);
            console.log(`📊 ピークレベル: ${analysis.peakLevel.toFixed(2)} dBFS`);
            console.log(`📊 RMSレベル: ${analysis.rmsLevel.toFixed(2)} dBFS`);
            console.log(`📊 ダイナミックレンジ: ${analysis.dynamicRange.toFixed(2)} dB`);

            // 問題のあるファイルを検出
            if (analysis.peakLevel === 0 && analysis.rmsLevel === 0) {
                console.log('⚠️  音声レベルが検出できません。シンプルモードで処理します...');
                await this.applySimpleMastering();
            } else {
                // 通常のマスタリング処理
                console.log('🎛️  マスタリング処理中...');
                try {
                    await this.applyMastering();
                } catch (error) {
                    console.log('⚠️  通常モードで失敗しました。シンプルモードで再試行します...');
                    await this.applySimpleMastering();
                }
            }
            
            console.log('✅ マスタリング処理が完了しました！');
            return this.outputFile;

        } catch (error) {
            console.error('❌ エラーが発生しました:', error.message);
            throw error;
        }
    }

    // マスタリング処理を適用
    async applyMastering() {
        return new Promise((resolve, reject) => {
            const filterChain = this.buildFilterChain();
            
            const args = [
                '-i', this.inputFile,
                '-af', filterChain,
                '-c:a', 'libmp3lame',
                '-b:a', '320k',
                '-ar', '44100',  // サンプリングレート固定
                '-ac', '2',      // ステレオに固定
                '-y',
                this.outputFile
            ];

            console.log(`🔧 FFmpeg実行: ffmpeg ${args.join(' ')}`);
            
            const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
            let progress = '';
            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                const dataStr = data.toString();
                progress += dataStr;
                errorOutput += dataStr;
                
                // 進捗表示（簡易版）
                const timeMatch = dataStr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                if (timeMatch) {
                    const currentTime = timeMatch[0];
                    process.stdout.write(`\r⏳ 処理中... ${currentTime}`);
                }
            });

            ffmpeg.on('close', (code) => {
                console.log(''); // 改行
                if (code === 0) {
                    resolve();
                } else {
                    console.error('📋 FFmpeg詳細エラー:');
                    console.error(errorOutput);
                    reject(new Error(`マスタリング処理エラー (コード: ${code})`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpegプロセスエラー: ${err.message}`));
            });
        });
    }

    // シンプルなマスタリング処理（音圧重視版）
    async applySimpleMastering() {
        return new Promise((resolve, reject) => {
            // 音圧を重視したフィルターチェーン
            const args = [
                '-i', this.inputFile,
                '-af', 'acompressor=threshold=-12dB:ratio=6:attack=1:release=50,volume=6dB,alimiter=level_in=1:level_out=0.95:limit=-0.1dB:attack=1:release=5',
                '-c:a', 'libmp3lame',
                '-b:a', '320k',
                '-ar', '44100',
                '-ac', '2',
                '-y',
                this.outputFile
            ];

            console.log(`🔧 高音圧モードでFFmpeg実行`);
            
            const ffmpeg = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                const dataStr = data.toString();
                errorOutput += dataStr;
                
                const timeMatch = dataStr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                if (timeMatch) {
                    const currentTime = timeMatch[0];
                    process.stdout.write(`\r⏳ 処理中... ${currentTime}`);
                }
            });

            ffmpeg.on('close', (code) => {
                console.log(''); // 改行
                if (code === 0) {
                    resolve();
                } else {
                    console.error('📋 FFmpeg詳細エラー:');
                    console.error(errorOutput);
                    reject(new Error(`高音圧マスタリング処理エラー (コード: ${code})`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpegプロセスエラー: ${err.message}`));
            });
        });
    }

    // 設定をJSONファイルに保存
    saveSettings(filePath) {
        fs.writeFileSync(filePath, JSON.stringify(this.settings, null, 2));
        console.log(`💾 設定を保存しました: ${filePath}`);
    }

    // JSONファイルから設定を読み込み
    loadSettings(filePath) {
        if (fs.existsSync(filePath)) {
            this.settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`📂 設定を読み込みました: ${filePath}`);
        }
        return this;
    }
}

// プリセット設定（音圧重視版）
class MasteringPresets {
    static pop() {
        return {
            normalize: false,  // loudnormを無効化
            normalizeLevel: -16.0,
            compressor: {
                enabled: true,
                threshold: -10,
                ratio: 4,      // より強い圧縮
                attack: 2,     // 速いアタック
                release: 100
            },
            equalizer: {
                enabled: true,
                lowGain: 1,
                midGain: 1,    // 中音域も少し強調
                highGain: 2
            },
            limiter: {
                enabled: true,
                ceiling: -0.1,
                release: 5
            },
            stereoEnhancer: {
                enabled: false,
                width: 1.1
            }
        };
    }

    static rock() {
        return {
            normalize: false,  // loudnormを無効化
            normalizeLevel: -14.0,
            compressor: {
                enabled: true,
                threshold: -8,   // より低いしきい値
                ratio: 6,        // より強い圧縮
                attack: 1,       // 非常に速いアタック
                release: 80
            },
            equalizer: {
                enabled: true,
                lowGain: 3,      // より強い低音
                midGain: 2,      // 中音域強調
                highGain: 4      // より強い高音
            },
            limiter: {
                enabled: true,
                ceiling: -0.1,
                release: 3
            },
            stereoEnhancer: {
                enabled: false,
                width: 1.3
            }
        };
    }

    static classical() {
        return {
            normalize: false,  // loudnormを無効化
            normalizeLevel: -23.0,
            compressor: {
                enabled: true,
                threshold: -15,  // より緩やか
                ratio: 3,        // 軽い圧縮
                attack: 5,
                release: 150
            },
            equalizer: {
                enabled: true,
                lowGain: 0,
                midGain: 0,
                highGain: 1
            },
            limiter: {
                enabled: true,
                ceiling: -0.5,   // より余裕を持たせる
                release: 10
            },
            stereoEnhancer: {
                enabled: false,
                width: 1.0
            }
        };
    }

    // 新しい高音圧プリセット
    static loudness() {
        return {
            normalize: false,
            normalizeLevel: -12.0,
            compressor: {
                enabled: true,
                threshold: -6,   // 非常に低いしきい値
                ratio: 8,        // 非常に強い圧縮
                attack: 0.5,     // 超高速アタック
                release: 30      // 短いリリース
            },
            equalizer: {
                enabled: true,
                lowGain: 2,
                midGain: 3,      // 中音域を強調
                highGain: 3
            },
            limiter: {
                enabled: true,
                ceiling: -0.05,  // ギリギリまで上げる
                release: 2
            },
            stereoEnhancer: {
                enabled: false,
                width: 1.0
            }
        };
    }
}

// ディレクトリ内の音声ファイルを取得
function getAudioFiles(directory) {
    const audioExtensions = ['.wav', '.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wma'];
    const files = [];
    
    if (!fs.existsSync(directory)) {
        return files;
    }
    
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (audioExtensions.includes(ext)) {
                files.push(itemPath);
            }
        }
    }
    
    return files;
}

// ディレクトリを作成（存在しない場合）
function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 ディレクトリを作成しました: ${dirPath}`);
    }
}

// バッチ処理でファイルを処理
async function processBatch(inputDir, outputDir, preset = null) {
    const inputFiles = getAudioFiles(inputDir);
    
    if (inputFiles.length === 0) {
        console.log(`⚠️  ${inputDir} に音声ファイルが見つかりません`);
        return;
    }
    
    console.log(`🎵 ${inputFiles.length} 個のファイルを処理します`);
    console.log('📁 対象ファイル:');
    inputFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${path.basename(file)}`);
    });
    
    ensureDirectory(outputDir);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < inputFiles.length; i++) {
        const inputFile = inputFiles[i];
        const fileName = path.basename(inputFile, path.extname(inputFile));
        const outputFile = path.join(outputDir, `${fileName}_mastered.mp3`);
        
        console.log(`\n🎯 処理中 (${i + 1}/${inputFiles.length}): ${path.basename(inputFile)}`);
        
        try {
            const master = new AudioMaster();
            
            // プリセット適用
            if (preset) {
                switch (preset.toLowerCase()) {
                    case 'pop':
                        master.settings = MasteringPresets.pop();
                        break;
                    case 'rock':
                        master.settings = MasteringPresets.rock();
                        break;
                    case 'classical':
                        master.settings = MasteringPresets.classical();
                        break;
                    case 'loudness':
                        master.settings = MasteringPresets.loudness();
                        break;
                }
            }
            
            await master
                .setInputFile(inputFile)
                .setOutputFile(outputFile)
                .process();
                
            successCount++;
            console.log(`✅ 完了: ${path.basename(outputFile)}`);
            
        } catch (error) {
            errorCount++;
            console.error(`❌ エラー: ${path.basename(inputFile)} - ${error.message}`);
        }
    }
    
    console.log(`\n🎉 バッチ処理完了!`);
    console.log(`✅ 成功: ${successCount} ファイル`);
    if (errorCount > 0) {
        console.log(`❌ エラー: ${errorCount} ファイル`);
    }
}

// 使用例とメイン処理
async function main() {
    try {
        const args = process.argv.slice(2);
        const inputDir = args[0] || 'input';
        const outputDir = args[1] || 'output';
        const preset = args[2] || null;

        console.log(`
🎵 Audio Mastering Tool - Batch Processor

📁 入力ディレクトリ: ${inputDir}
📁 出力ディレクトリ: ${outputDir}
🎛️  プリセット: ${preset || 'デフォルト'}

対応フォーマット: WAV, MP3, FLAC, AAC, M4A, OGG, WMA
        `);

        // 入力ディレクトリの確認
        if (!fs.existsSync(inputDir)) {
            console.log(`⚠️  入力ディレクトリが存在しません: ${inputDir}`);
            console.log(`📁 ディレクトリを作成してください`);
            ensureDirectory(inputDir);
            console.log(`ℹ️  ${inputDir} ディレクトリに音声ファイルを配置してから再実行してください`);
            return;
        }

        if (preset && !['pop', 'rock', 'classical', 'loudness'].includes(preset.toLowerCase())) {
            console.log('⚠️  不明なプリセットです。利用可能: pop, rock, classical, loudness');
            console.log('デフォルト設定で処理を続行します...\n');
        }

        await processBatch(inputDir, outputDir, preset);

    } catch (error) {
        console.error('❌ エラー:', error.message);
        process.exit(1);
    }
}

// モジュールとして使用する場合
module.exports = { AudioMaster, MasteringPresets };

// 直接実行する場合
if (require.main === module) {
    main();
}