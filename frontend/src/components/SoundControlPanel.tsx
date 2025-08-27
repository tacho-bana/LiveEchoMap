'use client';

import { useState } from 'react';
import { SoundSource } from './SoundCalculationEngine';

interface SoundControlPanelProps {
  currentIntensity: number;
  onIntensityChange: (intensity: number) => void;
  onCalculationTrigger: () => void;
  onModeToggle: (enabled: boolean) => void;
  isPlacementMode: boolean;
  isCalculating: boolean;
  soundSources: SoundSource[];
  onSoundSourceRemove: (id: string) => void;
  onDirectPlace?: () => void; // 直接配置用の関数
}

/**
 * 音響シミュレーション用のコントロールパネル
 * 音源配置、音量設定、計算実行などの機能を提供
 */
export const SoundControlPanel: React.FC<SoundControlPanelProps> = ({
  currentIntensity,
  onIntensityChange,
  onCalculationTrigger,
  onModeToggle,
  isPlacementMode,
  isCalculating,
  soundSources,
  onSoundSourceRemove,
  onDirectPlace
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="absolute top-20 left-4 bg-white rounded-lg shadow-lg z-50 min-w-80 max-w-sm">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-800">音響シミュレーション</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg 
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* 音源配置セクション */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">音源配置</label>
              <div className="flex space-x-2">
                {onDirectPlace && (
                  <button
                    onClick={onDirectPlace}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    🔴 音源配置
                  </button>
                )}
                <button
                  onClick={() => onModeToggle(!isPlacementMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPlacementMode ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPlacementMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>🔴 ボタン: 現在のカメラ位置に配置</p>
              <p>モード切替: {isPlacementMode ? 'クリックで配置可能' : 'クリック配置無効'}</p>
              <p className="text-blue-600 font-medium">WASD: カメラ移動, Shift: 高速, Space: 上昇</p>
            </div>
          </div>

          {/* 音の強度設定 */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              音の強度: {currentIntensity} dB
            </label>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={currentIntensity}
              onChange={(e) => onIntensityChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10B981 0%, #F59E0B ${(currentIntensity - 30) / 70 * 50}%, #EF4444 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>30dB (静か)</span>
              <span>100dB (非常に大きい)</span>
            </div>
          </div>

          {/* 音源リスト */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">配置済み音源</h4>
              <span className="text-xs text-gray-500">{soundSources.length}個</span>
            </div>
            
            {soundSources.length === 0 ? (
              <p className="text-xs text-gray-400 italic">音源が配置されていません</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2">
                {soundSources.map((source, index) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                  >
                    <div>
                      <div className="font-medium">音源 {index + 1}</div>
                      <div className="text-gray-500">
                        {source.intensity}dB | 
                        ({source.position.x.toFixed(1)}, {source.position.y.toFixed(1)}, {source.position.z.toFixed(1)})
                      </div>
                    </div>
                    <button
                      onClick={() => onSoundSourceRemove(source.id)}
                      className="p-1 text-red-500 hover:bg-red-100 rounded"
                      title="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 計算実行ボタン */}
          <div className="space-y-3">
            <button
              onClick={onCalculationTrigger}
              disabled={soundSources.length === 0 || isCalculating}
              className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                soundSources.length === 0 || isCalculating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isCalculating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  計算中...
                </div>
              ) : (
                '音響計算を実行'
              )}
            </button>
            

          </div>

        </div>
      )}
    </div>
  );
};