'use client';

import { OrbitControls, Environment, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useCallback, useRef, useEffect } from 'react';
import { PlateauModel } from './PlateauModel';
import { CameraControlsInside } from './CameraControlsInside';
import { SoundClickHandler } from './SoundClickHandler';
import { SoundSourceMarker } from './SoundSourceMarker';
import { SoundControlPanel } from './SoundControlPanel';
import { HeatmapVisualization, HeatmapLegend } from './HeatmapVisualization';
import { AudioSimulation } from './AudioSimulation';
import { AudioProcessor } from './AudioProcessor';
import { SoundCalculationEngineAPI, SoundSource, CalculationResult, HeatmapDataPoint } from './SoundCalculationEngineAPI';
import { CameraRef } from './CameraRef';
import * as THREE from 'three';

interface PlateauViewLikeProps {
  modelUrl: string;
}

interface LayerControl {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  loading: boolean;
  modelPath: string;
  color?: string;
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div className="text-gray-700">3Dモデルを読み込み中...</div>
      </div>
    </div>
  );
}

export default function PlateauViewLike({ modelUrl }: PlateauViewLikeProps) {
  const [layers, setLayers] = useState<LayerControl[]>([
    {
      id: 'buildings', 
      name: '建築物',
      icon: '🏢',
      enabled: true,
      loading: false,
      modelPath: '/models/sinjuku/bldg_Building.glb',
      color: '#E6E6FA'
    }
  ]);

  const [showStats, setShowStats] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraInfo, setCameraInfo] = useState<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [cameraCommand, setCameraCommand] = useState<{ 
    type: 'move'; 
    position: [number, number, number]; 
    target: [number, number, number];
  } | null>(null);
  const [currentMoveSpeed, setCurrentMoveSpeed] = useState(10);

  // 音響シミュレーション関連の状態
  const [soundSources, setSoundSources] = useState<SoundSource[]>([]);
  const [currentIntensity, setCurrentIntensity] = useState(80);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapDataPoint[]>([]);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [show3DHeatmap, setShow3DHeatmap] = useState(false);
  const [showAudioSimulation, setShowAudioSimulation] = useState(false);
  const [buildingMeshes, setBuildingMeshes] = useState<THREE.Mesh[]>([]);
  const [currentCamera, setCurrentCamera] = useState<THREE.Camera | null>(null);
  const [windDirection, setWindDirection] = useState(0); // 風向き（度）
  const [windSpeed, setWindSpeed] = useState(0); // 風速（m/s）
  
  // 音響再生関連の状態
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [selectedAudioPoint, setSelectedAudioPoint] = useState<{
    position: THREE.Vector3;
    dB: number;
    bassDb?: number;
    distance: number;
  } | null>(null);
  
  const calculationEngine = useRef(new SoundCalculationEngineAPI(20, 300)); // グリッドサイズ20m、計算範囲300m
  
  const referenceCoords = { longitude: 139.63, latitude: 35.45 };

  // 音源配置ハンドラー（1個のみ許可）
  const handleSoundSourcePlaced = useCallback((source: SoundSource) => {
    setSoundSources([{ ...source, intensity: currentIntensity }]); // 配列を置き換え
    console.log('音源が配置されました（既存の音源を置き換え）:', source);
  }, [currentIntensity]);

  // 直接音源配置ハンドラー（カメラのXZ位置、Y=0に配置）
  const handleDirectPlace = useCallback(() => {
    if (!currentCamera) {
      console.warn('カメラが設定されていません');
      return;
    }

    const sourceId = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // カメラのXZ位置を使用、Y座標は0（地面レベル）に固定
    const position = new THREE.Vector3(
      currentCamera.position.x,
      currentCamera.position.y, // カメラの現在のY座標
      currentCamera.position.z
    );
    
    const soundSource: SoundSource = {
      id: sourceId,
      position: position,
      intensity: currentIntensity
    };

    setSoundSources([soundSource]); // 配列を置き換え
    console.log('音源配置（既存の音源を置き換え）:', {
      id: sourceId,
      position: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
      intensity: currentIntensity
    });
  }, [currentIntensity, currentCamera]);

  // 音源削除ハンドラー
  const handleSoundSourceRemove = useCallback((id: string) => {
    setSoundSources(prev => prev.filter(source => source.id !== id));
  }, []);

  // 建物メッシュの更新
  const handleModelLoad = useCallback((meshes: THREE.Mesh[]) => {
    setBuildingMeshes(meshes);
    console.log(`建物メッシュが読み込まれました: ${meshes.length}個`);
  }, []);

  // 音響ポイントクリック時のハンドラー
  const handleAudioPointClick = useCallback((point: { position: THREE.Vector3; dB: number; bassDb?: number }) => {
    if (soundSources.length === 0) {
      console.warn('音源が配置されていません');
      return;
    }

    const soundSource = soundSources[0];
    const distance = soundSource.position.distanceTo(point.position);
    
    // 既に再生中の場合は一度停止してから新しい音を再生
    if (isAudioPlaying && selectedAudioPoint) {
      console.log('🔄 再生中の音響を停止して新しい地点の音響を再生');
      setIsAudioPlaying(false);
      
      // 少し待ってから新しい音を開始（音声の重複を避ける）
      setTimeout(() => {
        setSelectedAudioPoint({
          position: point.position,
          dB: point.dB,
          bassDb: point.bassDb,
          distance: distance
        });
        
        setIsAudioPlaying(true);
        console.log(`🎵 音響再生切り替え: 位置=(${point.position.x.toFixed(1)}, ${point.position.z.toFixed(1)}), 音量=${point.dB.toFixed(1)}dB, 距離=${distance.toFixed(1)}m`);
      }, 200); // 200ms待機
    } else {
      // 新規再生
      setSelectedAudioPoint({
        position: point.position,
        dB: point.dB,
        bassDb: point.bassDb,
        distance: distance
      });
      
      setIsAudioPlaying(true);
      console.log(`🎵 音響再生開始: 位置=(${point.position.x.toFixed(1)}, ${point.position.z.toFixed(1)}), 音量=${point.dB.toFixed(1)}dB, 距離=${distance.toFixed(1)}m`);
    }
  }, [soundSources, isAudioPlaying, selectedAudioPoint]);

  // 音響再生停止ハンドラー
  const handleAudioStop = useCallback(() => {
    setIsAudioPlaying(false);
    setSelectedAudioPoint(null);
    console.log('🛑 音響再生停止');
  }, []);

  // ヒートマップ計算の実行
  const handleCalculationTrigger = useCallback(async () => {
    if (soundSources.length === 0) {
      console.warn('音源が配置されていません');
      return;
    }

    setIsCalculating(true);
    try {
      // 複数の音源があれば最初の音源で計算（拡張可能）
      const primarySource = soundSources[0];
      const result = await calculationEngine.current.calculateSoundPropagation(
        primarySource,
        buildingMeshes,
        windDirection,
        windSpeed
      );

      setCalculationResult(result);
      setHeatmapData(result.heatmapData);
      setShow3DHeatmap(true);
      console.log('API音響計算が完了しました');
    } catch (error) {
      console.error('API音響計算中にエラーが発生しました:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [soundSources, buildingMeshes]);

  // 風向きをテキストで表示するヘルパー関数
  const getWindDirectionText = (direction: number): string => {
    if (direction >= 337.5 || direction < 22.5) return '北';
    if (direction >= 22.5 && direction < 67.5) return '北東';
    if (direction >= 67.5 && direction < 112.5) return '東';
    if (direction >= 112.5 && direction < 157.5) return '南東';
    if (direction >= 157.5 && direction < 202.5) return '南';
    if (direction >= 202.5 && direction < 247.5) return '南西';
    if (direction >= 247.5 && direction < 292.5) return '西';
    if (direction >= 292.5 && direction < 337.5) return '北西';
    return '北';
  };

  const toggleLayer = async (layerId: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        if (!layer.enabled && !layer.loading) {
          // Start loading
          return { ...layer, loading: true };
        } else if (layer.enabled) {
          // Disable
          return { ...layer, enabled: false };
        }
      }
      return layer;
    }));

    // Simulate loading delay for large models
    if (layers.find(l => l.id === layerId && !l.enabled)) {
      setTimeout(() => {
        setLayers(prev => prev.map(layer => 
          layer.id === layerId 
            ? { ...layer, enabled: true, loading: false }
            : layer
        ));
      }, layerId === 'terrain' ? 3000 : layerId === 'buildings' ? 2000 : 1000);
    }
  };

  return (
    <div className="w-full h-screen relative bg-gray-100">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShow3DHeatmap(!show3DHeatmap)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                show3DHeatmap
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              3Dヒートマップ {show3DHeatmap ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setShowAudioSimulation(!showAudioSimulation)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                showAudioSimulation
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title="色パネルを長押し（0.5秒）で音響体験"
            >
              音響体験 {showAudioSimulation ? 'ON' : 'OFF'}
            </button>
            
          </div>
        </div>
      </div>


      {/* Sound Control Panel */}
      <SoundControlPanel
        currentIntensity={currentIntensity}
        onIntensityChange={setCurrentIntensity}
        onCalculationTrigger={handleCalculationTrigger}
        onModeToggle={setIsPlacementMode}
        isPlacementMode={isPlacementMode}
        isCalculating={isCalculating}
        soundSources={soundSources}
        onSoundSourceRemove={handleSoundSourceRemove}
        onDirectPlace={handleDirectPlace}
        windDirection={windDirection}
        windSpeed={windSpeed}
        onWindDirectionChange={setWindDirection}
        onWindSpeedChange={setWindSpeed}
      />

      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner />}

      {/* 3D Canvas */}
      <Canvas
        camera={{ 
          position: [100, 80, 100], 
          fov: 45,
          near: 0.1,
          far: 10000
        }}
        shadows
        className="bg-gradient-to-b from-blue-200 to-blue-100"
      >
          {showStats && <Stats />}
          
          {/* Fog control - disabled for clear visibility */}
          
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[100, 100, 50]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-far={500}
            shadow-camera-left={-200}
            shadow-camera-right={200}
            shadow-camera-top={200}
            shadow-camera-bottom={-200}
          />
          
          {/* Camera Reference */}
          <CameraRef onCameraRef={setCurrentCamera} />

          {/* Sound Click Handler */}
          <SoundClickHandler
            onSoundSourcePlaced={handleSoundSourcePlaced}
            buildingMeshes={buildingMeshes}
            enabled={isPlacementMode}
          />
          
          {/* Sound Source Markers */}
          {soundSources.map((source) => (
            <SoundSourceMarker
              key={source.id}
              position={source.position}
              intensity={source.intensity}
              id={source.id}
              onRemove={handleSoundSourceRemove}
              windDirection={windDirection}
              windSpeed={windSpeed}
            />
          ))}
          
          {/* 3D Heatmap Visualization */}
          {calculationResult && (
            <HeatmapVisualization
              gridPoints={calculationResult.gridPoints}
              visible={show3DHeatmap}
              gridSize={calculationResult.gridSize}
            />
          )}
          
          {/* Audio Simulation Points */}
          {calculationResult && showAudioSimulation && soundSources.length > 0 && (
            <AudioSimulation
              gridPoints={calculationResult.gridPoints}
              soundSourcePosition={soundSources[0].position}
              gridSize={calculationResult.gridSize}
              onPointClick={handleAudioPointClick}
            />
          )}
          
          {/* Render enabled layers */}
          <Suspense fallback={null}>
            {layers.filter(layer => layer.enabled).map(layer => {
              return (
                <group key={layer.id}>
                  <PlateauModel 
                    path={layer.modelPath} 
                    scale={1}
                    position={[0, 0, 0]}
                    centerModel={false}
                    alignToGround={false}
                    onMeshLoad={handleModelLoad}
                  />
                </group>
              );
            })}
          </Suspense>
          
          <Environment preset="city" />
          
          <CameraControlsInside 
            onCameraInfo={setCameraInfo}
            cameraCommand={cameraCommand}
          />
          
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxDistance={1000}
            minDistance={20}
            target={[0, 0, 0]}
            enablePan={true}
            panSpeed={1.0}
            rotateSpeed={0.5}
            zoomSpeed={1.0}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN
            }}
          />
        </Canvas>


      {/* 3D Heatmap Legend */}
      <HeatmapLegend visible={show3DHeatmap} />

      {/* Audio Simulation Instructions */}
      {showAudioSimulation && calculationResult && soundSources.length > 0 && (
        <div className="fixed top-20 left-4 bg-green-50 border border-green-200 rounded-lg p-3 z-40 max-w-xs">
          <div className="text-sm text-green-800">
            <div className="font-medium mb-1">🎵 音響体験モード</div>
            <div className="text-xs">
              色付きパネルを<strong>0.5秒長押し</strong>で、その地点での音の聞こえ方を体験できます
            </div>
          </div>
        </div>
      )}

      {/* Audio Processor */}
      {isAudioPlaying && selectedAudioPoint && (
        <AudioProcessor
          soundFile="/sound/Ambulance-Siren03/Ambulance-Siren03-1(Close).mp3"
          targetDb={selectedAudioPoint.dB}
          bassDb={selectedAudioPoint.bassDb}
          distance={selectedAudioPoint.distance}
          isPlaying={isAudioPlaying}
          onStop={handleAudioStop}
        />
      )}
    </div>
  );
}