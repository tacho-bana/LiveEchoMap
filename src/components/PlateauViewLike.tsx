'use client';

import { OrbitControls, Environment, Grid, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { PlateauModel } from './PlateauModel';
import { CameraControlsInside } from './CameraControlsInside';
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
            <h1 className="text-xl font-bold text-gray-800">PLATEAU 3D都市モデル</h1>
            <div className="text-sm text-gray-600">横浜市</div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            >
              Stats {showStats ? 'OFF' : 'ON'}
            </button>
          </div>
        </div>
      </div>

      


      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner />}

      {/* 3D Canvas */}
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
    </div>
  );
}