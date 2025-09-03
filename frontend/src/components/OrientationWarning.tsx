'use client';

import { useState, useEffect } from 'react';

/**
 * スマホの縦画面時に横画面への回転を促すコンポーネント
 */
export const OrientationWarning: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // モバイルデバイスの判定
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);

      if (mobile) {
        // 画面の向きをチェック
        const isPortraitMode = window.innerHeight > window.innerWidth;
        setIsPortrait(isPortraitMode);
      }
    };

    // 初回チェック
    checkOrientation();

    // リサイズイベントでチェック
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // モバイルでかつ縦画面の場合のみ表示
  if (!isMobile || !isPortrait) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[9999] flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 m-4 text-center max-w-sm">
        {/* 回転アイコン */}
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 border-4 border-blue-600 rounded-lg flex items-center justify-center relative">
            <div className="w-8 h-5 bg-blue-600 rounded-sm"></div>
            <div className="absolute -top-2 -right-2 text-2xl animate-bounce">
              🔄
            </div>
          </div>
        </div>

        {/* メッセージ */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          横画面でご利用ください
        </h2>
        
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          LiveEchoMapは横画面での利用を推奨しています。
          <br />
          デバイスを回転させて横画面モードに切り替えてください。
        </p>

        {/* 操作説明 */}
        <div className="bg-gray-50 rounded-lg p-4 text-left">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm">横画面での操作方法:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• ピンチ: ズームイン/アウト</li>
            <li>• ドラッグ: カメラ回転</li>
            <li>• タップ: 音源配置</li>
            <li>• 2本指ドラッグ: カメラ移動</li>
          </ul>
        </div>

        {/* 強制続行ボタン（小さく） */}
        <button
          onClick={() => setIsPortrait(false)}
          className="mt-4 text-xs text-gray-400 underline hover:text-gray-600"
        >
          このまま続行する
        </button>
      </div>
    </div>
  );
};