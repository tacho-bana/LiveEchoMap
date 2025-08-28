'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMap } from 'react-leaflet';

// Leafletを動的インポートしてSSRの問題を回避
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });

export interface HeatmapDataPoint {
  coordinates: [number, number];
  intensity: number;
}

interface LeafletHeatmapProps {
  heatmapData: HeatmapDataPoint[];
  center: [number, number];
  zoom: number;
}

// ヒートマップレイヤーコンポーネント
const HeatmapLayer: React.FC<{ data: HeatmapDataPoint[] }> = ({ data }) => {
  const heatLayerRef = useRef<any>(null);
  const map = useMap();

  useEffect(() => {
    const loadHeatmapLayer = async () => {
      if (typeof window === 'undefined' || !map) return;

      try {
        // 動的にleaflet.heatを読み込み
        const L = (await import('leaflet')).default;
        await import('leaflet.heat');

        // 既存のヒートマップレイヤーを削除
        if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
          map.removeLayer(heatLayerRef.current);
        }

        if (data.length > 0) {
          // データを[lat, lng, intensity]形式に変換
          const heatArray = data.map(point => [
            point.coordinates[1], // latitude
            point.coordinates[0], // longitude
            point.intensity
          ]);

          // ヒートマップレイヤーを作成
          heatLayerRef.current = (L as any).heatLayer(heatArray, {
            radius: 20,
            blur: 15,
            maxZoom: 17,
            max: 1.0,
            gradient: {
              0.0: '#3388ff',
              0.2: '#00ff00',
              0.4: '#ffff00',
              0.6: '#ff8800',
              0.8: '#ff4400',
              1.0: '#ff0000'
            }
          }).addTo(map);

          console.log(`Leafletヒートマップ更新: ${heatArray.length}個のデータポイント`);
        }
      } catch (error) {
        console.error('ヒートマップレイヤーの読み込みに失敗しました:', error);
      }
    };

    loadHeatmapLayer();

    return () => {
      if (heatLayerRef.current && map && map.hasLayer(heatLayerRef.current)) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [data, map]);

  return null;
};

// カスタムコントロールコンポーネント
const MapControls: React.FC<{
  onTestData: () => void;
  dataCount: number;
  onClearData: () => void;
}> = ({ onTestData, dataCount, onClearData }) => {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(16);
  const [currentCenter, setCurrentCenter] = useState({ lat: 35.45, lng: 139.63 });

  useEffect(() => {
    if (!map) return;

    const updateInfo = () => {
      try {
        setCurrentZoom(map.getZoom());
        setCurrentCenter(map.getCenter());
      } catch (error) {
        console.warn('Map info update failed:', error);
      }
    };

    // 初期値を設定
    updateInfo();

    map.on('zoomend', updateInfo);
    map.on('moveend', updateInfo);

    return () => {
      map.off('zoomend', updateInfo);
      map.off('moveend', updateInfo);
    };
  }, [map]);

  return (
    null
  );
};

export const LeafletHeatmap: React.FC<LeafletHeatmapProps> = ({
  heatmapData,
  center,
  zoom
}) => {
  const [testData, setTestData] = useState<HeatmapDataPoint[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Leaflet CSSの動的読み込み
    const existingLink = document.querySelector('link[href*="leaflet.css"]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      link.onload = () => console.log('Leaflet CSS loaded successfully');
      link.onerror = () => console.error('Failed to load Leaflet CSS');
      document.head.appendChild(link);

      return () => {
        try {
          document.head.removeChild(link);
        } catch (e) {
          console.warn('Failed to remove Leaflet CSS link:', e);
        }
      };
    }
  }, []);

  const generateTestData = () => {
    const testDataPoints: HeatmapDataPoint[] = [];
    for (let i = 0; i < 100; i++) {
      const lng = center[0] + (Math.random() - 0.5) * 0.02;
      const lat = center[1] + (Math.random() - 0.5) * 0.02;
      const intensity = Math.random();
      
      testDataPoints.push({
        coordinates: [lng, lat],
        intensity: intensity
      });
    }
    setTestData(testDataPoints);
    console.log('テストデータ生成:', {
      count: testDataPoints.length,
      center: center,
      sampleData: testDataPoints.slice(0, 3),
      bounds: {
        minLng: Math.min(...testDataPoints.map(p => p.coordinates[0])),
        maxLng: Math.max(...testDataPoints.map(p => p.coordinates[0])),
        minLat: Math.min(...testDataPoints.map(p => p.coordinates[1])),
        maxLat: Math.max(...testDataPoints.map(p => p.coordinates[1]))
      }
    });
  };

  const clearData = () => {
    setTestData([]);
    console.log('データをクリア');
  };

  const dataToDisplay = heatmapData.length > 0 ? heatmapData : testData;
  
  console.log('LeafletHeatmap render:', {
    isClient,
    heatmapDataLength: heatmapData.length,
    testDataLength: testData.length,
    dataToDisplayLength: dataToDisplay.length,
    center,
    zoom
  });

  if (!isClient) {
    return (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-700">地図を読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[center[1], center[0]]} // [lat, lng]
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* OpenStreetMapタイル */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* ヒートマップレイヤー */}
        <HeatmapLayer data={dataToDisplay} />
        
        {/* カスタムコントロール */}
        <MapControls
          onTestData={generateTestData}
          dataCount={dataToDisplay.length}
          onClearData={clearData}
        />
      </MapContainer>

      {dataToDisplay.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
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