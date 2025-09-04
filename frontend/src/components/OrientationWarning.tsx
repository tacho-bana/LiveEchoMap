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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '32px',
        margin: '16px',
        textAlign: 'center',
        maxWidth: '384px'
      }}>
        {/* 回転アイコン */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            margin: '0 auto',
            width: '64px',
            height: '64px',
            border: '4px solid #2563eb',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '32px',
              height: '20px',
              backgroundColor: '#2563eb',
              borderRadius: '4px'
            }}></div>
            <div style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              fontSize: '24px'
            }}>
              🔄
            </div>
          </div>
        </div>

        {/* メッセージ */}
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '16px'
        }}>
          横画面でご利用ください
        </h2>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '24px',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          本アプリケーションは横画面での利用を推奨しています。
          <br />
          デバイスを回転させて横画面モードに切り替えてください。
        </p>

        {/* 操作説明 */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'left'
        }}>
          <h3 style={{
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '8px',
            fontSize: '14px'
          }}>横画面での操作方法:</h3>
          <ul style={{
            fontSize: '12px',
            color: '#6b7280',
            listStyle: 'none',
            padding: 0,
            margin: 0
          }}>
            <li style={{ marginBottom: '4px' }}>• ピンチ: ズームイン/アウト</li>
            <li style={{ marginBottom: '4px' }}>• ドラッグ: カメラ回転</li>
            <li style={{ marginBottom: '4px' }}>• タップ: 音源配置</li>
            <li>• 2本指ドラッグ: カメラ移動</li>
          </ul>
        </div>
      </div>
    </div>
  );
};