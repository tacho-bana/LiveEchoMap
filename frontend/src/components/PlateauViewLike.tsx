'use client';

import { OrbitControls, Environment, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useCallback, useRef } from 'react';
import { PlateauModel } from './PlateauModel';
import { CameraControlsInside } from './CameraControlsInside';
import { SoundClickHandler } from './SoundClickHandler';
import { SoundSourceMarker } from './SoundSourceMarker';
import { SoundControlPanel } from './SoundControlPanel';
import { HeatmapVisualization, HeatmapLegend } from './HeatmapVisualization';
import { LeafletHeatmap, HeatmapDataPoint } from './LeafletHeatmap';
import { SimpleMapViewer } from './SimpleMapViewer';
import { SoundCalculationEngine, SoundSource, CalculationResult } from './SoundCalculationEngine';
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
      modelPath: '/models/test2.glb/bldg_Building.glb',
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
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [show3DHeatmap, setShow3DHeatmap] = useState(false);
  const [mapType, setMapType] = useState<'simple' | 'leaflet'>('leaflet');
  const [buildingMeshes, setBuildingMeshes] = useState<THREE.Mesh[]>([]);
  const [currentCamera, setCurrentCamera] = useState<THREE.Camera | null>(null);
  
  const calculationEngine = useRef(new SoundCalculationEngine(20, 80)); // グリッドサイズ20m、計算範囲80m
  
  // 地理座標の設定（山下ふ頭の座標）
  const referenceCoords = { longitude: 139.63, latitude: 35.45 };

  // 音源配置ハンドラー
  const handleSoundSourcePlaced = useCallback((source: SoundSource) => {
    setSoundSources(prev => [...prev, { ...source, intensity: currentIntensity }]);
    console.log('音源が配置されました:', source);
  }, [currentIntensity]);

  // 直接音源配置ハンドラー（カメラの現在位置に配置）
  const handleDirectPlace = useCallback(() => {
    if (!currentCamera) {
      console.warn('カメラが設定されていません');
      return;
    }

    const sourceId = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // カメラの現在位置を使用（少し下に配置）
    const position = currentCamera.position.clone();
    position.y = Math.max(position.y - 5, 2); // 最低2mの高さを保持
    
    const soundSource: SoundSource = {
      id: sourceId,
      position: position,
      intensity: currentIntensity
    };

    setSoundSources(prev => [...prev, soundSource]);
    console.log('音源配置（カメラ位置）:', {
      id: sourceId,
      position: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`,
      cameraPosition: `(${currentCamera.position.x.toFixed(1)}, ${currentCamera.position.y.toFixed(1)}, ${currentCamera.position.z.toFixed(1)})`,
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

  // ヒートマップ計算の実行
  const handleCalculationTrigger = useCallback(async () => {
    if (soundSources.length === 0 || buildingMeshes.length === 0) {
      console.warn('音源または建物データが不足しています');
      return;
    }

    setIsCalculating(true);
    try {
      // 複数の音源があれば最初の音源で計算（拡張可能）
      const primarySource = soundSources[0];
      const result = calculationEngine.current.calculateSoundPropagation(
        primarySource,
        buildingMeshes
      );

      setCalculationResult(result);
      setHeatmapData(result.heatmapData);
      setShowHeatmap(true);
      setShow3DHeatmap(true);
      console.log('音響計算が完了しました');
    } catch (error) {
      console.error('音響計算中にエラーが発生しました:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [soundSources, buildingMeshes]);

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
            <h1 className="text-xl font-bold text-gray-800">PLATEAU 3D都市モデル - 音響シミュレーション</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  showHeatmap
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showHeatmap ? '3Dビュー（自由視点）' : '上空からの視点'}
              </button>
              
            </div>
            
            <button
              onClick={() => setShow3DHeatmap(!show3DHeatmap)}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                show3DHeatmap
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              3Dヒートマップ {show3DHeatmap ? 'ON' : 'OFF'}
            </button>
            
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              Stats {showStats ? 'OFF' : 'ON'}
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
      />

      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner />}

      {/* 3D Canvas or 2D Heatmap */}
      {!showHeatmap ? (
        <Canvas
          camera={{ 
            position: [0, 50, 0], 
            fov: 45,
            near: 0.1,
            far: 10000
          }}
          shadows
          className="bg-gradient-to-b from-blue-200 to-blue-100"
        >
          {showStats && <Stats />}
          
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
          
          <fog attach="fog" args={['#87CEEB', 100, 1000]} />
          
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
            />
          ))}
          
          {/* 3D Heatmap Visualization */}
          {calculationResult && (
            <HeatmapVisualization
              gridPoints={calculationResult.gridPoints}
              visible={show3DHeatmap}
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
            maxPolarAngle={Math.PI * 0.45}
            target={[0, 0, 0]}
          />
        </Canvas>
      ) : (
        <Canvas
          camera={{ 
            position: [0, 500, 0], 
            up: [0, 0, -1],
            fov: 60,
            near: 0.1,
            far: 10000
          }}
          shadows
          className="bg-gradient-to-b from-blue-200 to-blue-100"
        >
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[0, 100, 0]}
            intensity={1}
            castShadow
          />
          
          {/* Sound Source Markers */}
          {soundSources.map((source) => (
            <SoundSourceMarker
              key={source.id}
              position={source.position}
              intensity={source.intensity}
              id={source.id}
              onRemove={handleSoundSourceRemove}
            />
          ))}
          
          {/* 3D Heatmap Visualization */}
          {calculationResult && (
            <HeatmapVisualization
              gridPoints={calculationResult.gridPoints}
              visible={true}
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
          
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxDistance={1000}
            minDistance={200}
            maxPolarAngle={Math.PI * 0.15} // 上からの視点に制限（少し緩く）
            minPolarAngle={0}
            target={[0, 0, 0]}
          />
        </Canvas>
      )}

      {/* 3D Heatmap Legend */}
      <HeatmapLegend visible={show3DHeatmap} />
    </div>
  );
}