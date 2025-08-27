'use client';

import { useState, useEffect, useRef } from 'react';

export interface HeatmapDataPoint {
  coordinates: [number, number]; // [lng, lat]
  intensity: number; // 0-1の正規化された値
}

interface SimpleMapViewerProps {
  heatmapData: HeatmapDataPoint[];
  center: [number, number]; // [lng, lat]
  zoom: number;
}

/**
 * シンプルなCanvasベースの2Dマップビューア
 * サードパーティライブラリに依存しない軽量な実装
 */
export const SimpleMapViewer: React.FC<SimpleMapViewerProps> = ({
  heatmapData,
  center,
  zoom
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [testData, setTestData] = useState<HeatmapDataPoint[]>([]);
  const [viewCenter, setViewCenter] = useState<[number, number]>(center);
  const [viewZoom, setViewZoom] = useState(zoom);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // 地理座標をCanvas座標に変換
  const geoToCanvas = (lng: number, lat: number, canvasWidth: number, canvasHeight: number) => {
    const scale = Math.pow(2, viewZoom - 10); // ズームレベルによるスケール調整
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    const x = centerX + (lng - viewCenter[0]) * scale * 10000;
    const y = centerY - (lat - viewCenter[1]) * scale * 10000;
    
    return { x, y };
  };

  // Canvas座標を地理座標に変換
  const canvasToGeo = (x: number, y: number, canvasWidth: number, canvasHeight: number) => {
    const scale = Math.pow(2, viewZoom - 10);
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    
    const lng = viewCenter[0] + (x - centerX) / (scale * 10000);
    const lat = viewCenter[1] - (y - centerY) / (scale * 10000);
    
    return { lng, lat };
  };

  // 強度から色を取得
  const intensityToColor = (intensity: number): string => {
    if (intensity >= 0.8) return '#ff0000'; // 赤
    if (intensity >= 0.6) return '#ff8800'; // オレンジ  
    if (intensity >= 0.4) return '#ffff00'; // 黄色
    if (intensity >= 0.2) return '#88ff00'; // 黄緑
    return '#00ff00'; // 緑
  };

  // 地図の描画
  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    
    // 背景をクリア
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // グリッド線を描画
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 中心点を描画
    const centerPos = geoToCanvas(viewCenter[0], viewCenter[1], width, height);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(centerPos.x, centerPos.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 座標テキストを表示
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText(`中心: ${viewCenter[0].toFixed(4)}, ${viewCenter[1].toFixed(4)}`, 10, 25);
    ctx.fillText(`ズーム: ${viewZoom.toFixed(1)}`, 10, 45);

    // ヒートマップデータを描画
    const dataToDisplay = heatmapData.length > 0 ? heatmapData : testData;
    
    dataToDisplay.forEach(point => {
      const pos = geoToCanvas(point.coordinates[0], point.coordinates[1], width, height);
      
      // 画面内にある場合のみ描画
      if (pos.x >= -20 && pos.x <= width + 20 && pos.y >= -20 && pos.y <= height + 20) {
        const color = intensityToColor(point.intensity);
        const radius = 8 + point.intensity * 12;
        
        // グラデーション円を描画
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
        gradient.addColorStop(0, color + '80'); // 中心は不透明
        gradient.addColorStop(1, color + '20'); // 外側は透明
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // データ情報を表示
    ctx.fillStyle = '#333';
    ctx.fillText(`データポイント: ${dataToDisplay.length}個`, 10, height - 25);
  };

  // テストデータ生成
  const generateTestData = () => {
    const testDataPoints: HeatmapDataPoint[] = [];
    for (let i = 0; i < 50; i++) {
      const lng = center[0] + (Math.random() - 0.5) * 0.01;
      const lat = center[1] + (Math.random() - 0.5) * 0.01;
      const intensity = Math.random();
      
      testDataPoints.push({
        coordinates: [lng, lat],
        intensity: intensity
      });
    }
    setTestData(testDataPoints);
    console.log('Simpleマップ テストデータ生成:', {
      count: testDataPoints.length,
      center: center,
      sampleData: testDataPoints.slice(0, 3),
      dataToDisplay: heatmapData.length > 0 ? 'heatmapData' : 'testData'
    });
  };

  // データクリア
  const clearData = () => {
    setTestData([]);
  };

  // マウスイベントハンドラー
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging && dragStart && canvasRef.current) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      const scale = Math.pow(2, viewZoom - 10);
      const lngDelta = -deltaX / (scale * 10000);
      const latDelta = deltaY / (scale * 10000);
      
      setViewCenter([viewCenter[0] + lngDelta, viewCenter[1] + latDelta]);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // ホイールズーム
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setViewZoom(prev => Math.max(8, Math.min(20, prev + delta)));
  };

  // リセット機能
  const resetView = () => {
    setViewCenter(center);
    setViewZoom(zoom);
  };

  // Canvas描画の更新
  useEffect(() => {
    drawMap();
  }, [heatmapData, testData, viewCenter, viewZoom]);

  // Canvas サイズの調整
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawMap();
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const dataToDisplay = heatmapData.length > 0 ? heatmapData : testData;

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* コントロールパネル */}
      <div className="absolute top-4 left-4 bg-white rounded-lg p-4 shadow-lg z-10">
        <div className="text-sm font-semibold mb-3">Simple 2Dマップ</div>
        
        <div className="space-y-3">
          <div className="text-xs text-gray-600">
            データポイント: <span className="font-medium">{dataToDisplay.length}個</span>
          </div>
          
          <div className="text-xs text-gray-600">
            ズーム: <span className="font-medium">{viewZoom.toFixed(1)}</span>
          </div>

          <div className="text-xs text-gray-600">
            中心: <span className="font-mono">{viewCenter[0].toFixed(4)}, {viewCenter[1].toFixed(4)}</span>
          </div>

          <div className="space-y-2">
            <button
              onClick={generateTestData}
              className="w-full px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              テストデータ生成
            </button>

            <button
              onClick={clearData}
              className="w-full px-3 py-2 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
            >
              データクリア
            </button>

            <button
              onClick={resetView}
              className="w-full px-3 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
            >
              ビューリセット
            </button>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg p-3 shadow-lg z-10">
        <div className="text-sm font-semibold mb-2">音量レベル</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span>最高強度</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            <span>高強度</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            <span>中強度</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span>低強度</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t text-xs text-gray-500">
          Canvas + JavaScript
        </div>
      </div>

      {/* 操作説明 */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow-lg z-10">
        <div className="text-sm font-semibold mb-2">操作方法</div>
        <div className="text-xs space-y-1">
          <div>• ドラッグ: 地図移動</div>
          <div>• ホイール: ズーム</div>
          <div>• リセット: 初期位置に戻る</div>
          <div>• テストボタン: サンプル表示</div>
        </div>
      </div>

      {/* データなしの場合のメッセージ */}
      {dataToDisplay.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-white rounded-lg p-6 shadow-lg pointer-events-auto">
            <div className="text-gray-600 mb-4 text-center">ヒートマップデータがありません</div>
            <button
              onClick={generateTestData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full"
            >
              テストデータを生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
};