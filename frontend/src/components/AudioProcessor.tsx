'use client';

import { useRef, useEffect, useState } from 'react';

interface AudioProcessorProps {
  soundFile: string;
  targetDb: number;
  bassDb?: number;
  distance: number;
  isPlaying: boolean;
  onStop: () => void;
}

/**
 * 距離と音響データに基づいて音をフィルタリングして再生
 */
export const AudioProcessor: React.FC<AudioProcessorProps> = ({
  soundFile,
  targetDb,
  bassDb,
  distance,
  isPlaying,
  onStop
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
  const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [audioSource, setAudioSource] = useState<'file' | 'synthetic'>('file');

  // Web Audio APIの初期化
  useEffect(() => {
    if (!isInitialized && isPlaying) {
      initializeAudio();
    }
  }, [isPlaying, isInitialized]);

  // 音響効果の適用
  useEffect(() => {
    if (isInitialized && audioContextRef.current && gainNodeRef.current && lowpassFilterRef.current && highpassFilterRef.current) {
      applyAudioEffects();
    }
  }, [targetDb, bassDb, distance, isInitialized]);

  const initializeAudio = async () => {
    try {
      // AudioContextの作成
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 音声ファイルの読み込み（複数のパスを試行）
      const possiblePaths = [
        soundFile,
        '/sound/Ambulance-Siren03/Ambulance-Siren03-1(Close).mp3',
        '/sound/Ambulance-Siren03/Ambulance-Siren03-1Close.mp3',
        '/Ambulance-Siren03-1(Close).mp3',
        '/sounds/siren.mp3'
      ];
      
      let response: Response | null = null;
      let usedPath = '';
      
      for (const path of possiblePaths) {
        try {
          console.log(`🔍 音声ファイル試行: ${path}`);
          // URLエンコーディングを適切に処理
          const encodedPath = encodeURI(path);
          const testResponse = await fetch(encodedPath);
          if (testResponse.ok) {
            response = testResponse;
            usedPath = path;
            console.log(`✅ 音声ファイル発見: ${usedPath} (実際のURL: ${encodedPath})`);
            break;
          } else {
            console.log(`❌ ${testResponse.status} ${testResponse.statusText}: ${path}`);
          }
        } catch (error) {
          console.log(`❌ 音声ファイル取得失敗: ${path}`, error);
        }
      }
      
      if (!response) {
        throw new Error('音声ファイルが見つかりません。フォールバック音声を生成します。');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('音声ファイルが空です');
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // ノードの作成と接続
      const source = audioContextRef.current.createBufferSource();
      const gainNode = audioContextRef.current.createGain();
      const lowpassFilter = audioContextRef.current.createBiquadFilter();
      const highpassFilter = audioContextRef.current.createBiquadFilter();

      source.buffer = audioBuffer;
      source.loop = false; // 一回再生で終了

      // フィルターの設定
      lowpassFilter.type = 'lowpass';
      highpassFilter.type = 'highpass';

      // ノードの接続: source → highpass → lowpass → gain → destination
      source.connect(highpassFilter);
      highpassFilter.connect(lowpassFilter);
      lowpassFilter.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      lowpassFilterRef.current = lowpassFilter;
      highpassFilterRef.current = highpassFilter;

      setIsInitialized(true);
      setAudioSource('file');
      
      console.log('🎵 Audio初期化完了');
    } catch (error) {
      console.error('Audio初期化エラー:', error);
      
      // フォールバック: 合成音声でサイレン音を生成
      try {
        await initializeSyntheticSiren();
      } catch (fallbackError) {
        console.error('フォールバック音声の生成にも失敗:', fallbackError);
      }
    }
  };

  // 合成サイレン音の生成（フォールバック）
  const initializeSyntheticSiren = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    console.log('🎵 合成サイレン音を生成中...');
    
    // 5秒間のサイレン音を生成
    const duration = 5;
    const sampleRate = audioContextRef.current.sampleRate;
    const frameCount = sampleRate * duration;
    const audioBuffer = audioContextRef.current.createBuffer(1, frameCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // サイレン音の生成（二つの周波数が交互に変化）
    for (let i = 0; i < frameCount; i++) {
      const time = i / sampleRate;
      const cycleTime = time % 2; // 2秒周期
      
      // 440Hz ↔ 600Hz を繰り返すサイレン
      const frequency = cycleTime < 1 ? 440 + (cycleTime * 160) : 600 - ((cycleTime - 1) * 160);
      
      const sample = Math.sin(2 * Math.PI * frequency * time) * 0.3;
      channelData[i] = sample;
    }

    // オーディオノードの設定
    const source = audioContextRef.current.createBufferSource();
    const gainNode = audioContextRef.current.createGain();
    const lowpassFilter = audioContextRef.current.createBiquadFilter();
    const highpassFilter = audioContextRef.current.createBiquadFilter();

    source.buffer = audioBuffer;
    source.loop = false; // 一回再生で終了

    lowpassFilter.type = 'lowpass';
    highpassFilter.type = 'highpass';

    source.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    sourceRef.current = source;
    gainNodeRef.current = gainNode;
    lowpassFilterRef.current = lowpassFilter;
    highpassFilterRef.current = highpassFilter;

    setIsInitialized(true);
    setAudioSource('synthetic');
    console.log('✅ 合成サイレン音の初期化完了');
  };

  const applyAudioEffects = () => {
    if (!gainNodeRef.current || !lowpassFilterRef.current || !highpassFilterRef.current) return;

    // 音量調整（dB値から線形ゲインに変換）
    const referenceDb = 80; // 基準音量
    const dbDifference = targetDb - referenceDb;
    const linearGain = Math.pow(10, dbDifference / 20);
    const finalGain = Math.max(0.01, Math.min(1.0, linearGain));
    
    gainNodeRef.current.gain.setValueAtTime(finalGain, audioContextRef.current!.currentTime);

    // 距離に応じた周波数フィルタリング
    let lowpassFreq = 20000; // 基準: 20kHz（全周波数通す）
    let highpassFreq = 20;   // 基準: 20Hz（低域カット無し）

    if (distance > 50) {
      // 遠距離: 高周波カット、重低音優遇
      lowpassFreq = Math.max(800, 20000 - (distance - 50) * 30);
      highpassFreq = Math.max(20, Math.min(200, (distance - 50) * 2));
    } else if (distance > 20) {
      // 中距離: 軽度の高周波カット
      lowpassFreq = Math.max(2000, 20000 - (distance - 20) * 50);
    }

    // 重低音データがある場合の調整
    if (bassDb !== undefined && bassDb > targetDb) {
      // 重低音が強い場合、低域を強調
      highpassFreq = Math.max(20, highpassFreq * 0.5);
      lowpassFreq = Math.max(lowpassFreq, 1000);
    }

    lowpassFilterRef.current.frequency.setValueAtTime(lowpassFreq, audioContextRef.current!.currentTime);
    highpassFilterRef.current.frequency.setValueAtTime(highpassFreq, audioContextRef.current!.currentTime);

    console.log(`🎛️ オーディオフィルター適用: 音量=${finalGain.toFixed(3)}, ローパス=${lowpassFreq}Hz, ハイパス=${highpassFreq}Hz, 距離=${distance.toFixed(1)}m`);
  };

  // 再生開始/停止
  useEffect(() => {
    if (isInitialized && sourceRef.current) {
      if (isPlaying) {
        // 再生終了時のイベントリスナーを追加
        sourceRef.current.addEventListener('ended', () => {
          console.log('🏁 音声再生終了');
          onStop(); // 自動的にUIを閉じる
        });
        
        sourceRef.current.start();
        console.log('🎵 音声再生開始');
      } else {
        stopAudio();
      }
    }

    return () => {
      if (!isPlaying) {
        stopAudio();
      }
    };
  }, [isPlaying, isInitialized]);

  // パラメータ変更時に音声を再初期化（位置変更対応）
  useEffect(() => {
    if (isInitialized && isPlaying) {
      console.log('🔄 音響パラメータ変更により音声を再初期化');
      // 現在の音声を停止
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
          sourceRef.current.disconnect();
        } catch (error) {
          // 既に停止済みの場合のエラーを無視
        }
        sourceRef.current = null;
      }
      
      // 新しいパラメータで再初期化
      setIsInitialized(false);
    }
  }, [targetDb, distance, isPlaying]);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (error) {
        // 既に停止済みの場合のエラーを無視
      }
      sourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsInitialized(false);
    onStop();
    console.log('🛑 音声停止');
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 z-50 max-w-xs">
      <div className="flex items-center space-x-4">
        <div className="text-sm flex-1">
          <div className="font-medium text-green-600 mb-1">
            🎵 音響再生中 
            {audioSource === 'synthetic' && (
              <span className="text-xs text-orange-600 ml-1">(合成音)</span>
            )}
          </div>
          <div>音量: {targetDb.toFixed(1)}dB</div>
          {bassDb && <div>重低音: {bassDb.toFixed(1)}dB</div>}
          <div>距離: {distance.toFixed(1)}m</div>
          <div className="text-xs text-gray-500 mt-1">
            別の場所を長押しして切り替え可能
          </div>
          {audioSource === 'synthetic' && (
            <div className="text-xs text-orange-600 mt-1">
              ⚠️ 音声ファイル未検出のため合成音を使用中
            </div>
          )}
        </div>
        <button
          onClick={stopAudio}
          className="px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 flex-shrink-0"
        >
          停止
        </button>
      </div>
    </div>
  );
};