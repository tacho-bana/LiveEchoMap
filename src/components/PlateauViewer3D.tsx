'use client';

import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { PlateauModel } from './PlateauModel';
import { PlateauMultiModel } from './PlateauMultiModel';

interface PlateauViewer3DProps {
  modelUrl: string;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" wireframe />
    </mesh>
  );
}

export default function PlateauViewer3D({ modelUrl }: PlateauViewer3DProps) {
  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ 
          position: [50, 50, 100], 
          fov: 45,
          near: 0.1,
          far: 2000
        }}
        shadows
      >
        
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        
        <Suspense fallback={<LoadingFallback />}>
          {modelUrl.includes('/models/test2.glb') ? (
            <PlateauMultiModel 
              basePath="/models/test2.glb"
              models={{
                buildings: 'bldg_Building.glb',
                terrain: 'dem_ReliefFeature.glb',
                roads: 'tran_Road.glb'
              }}
            />
          ) : (
            <PlateauModel path={modelUrl} />
          )}
        </Suspense>
        
        <Grid 
          args={[1000, 1000]} 
          position={[0, -0.1, 0]} 
          cellColor="#666666"
          sectionColor="#888888"
        />
        
        <Environment preset="city" />
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxDistance={500}
          minDistance={10}
          maxPolarAngle={Math.PI * 0.49}
        />
      </Canvas>
      
      {/* UI オーバーレイ */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
        <div className="text-lg font-semibold">
          {modelUrl.includes('/models/test2.glb') ? '山下ふ頭 3D都市モデル' : 'PLATEAU 3D Model Viewer'}
        </div>
        <div className="text-sm text-gray-300 mt-1">
          {modelUrl.includes('/models/test2.glb') ? (
            <div>
              <div>建築物・道路・地形</div>
              <div className="mt-1">React Three Fiber + Three.js</div>
            </div>
          ) : (
            'React Three Fiber + Three.js'
          )}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
        <div className="text-sm font-semibold mb-2">操作方法</div>
        <div className="text-xs space-y-1">
          <div>• マウスドラッグ: 視点回転</div>
          <div>• マウスホイール: ズーム</div>
          <div>• 右クリックドラッグ: パン</div>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-30 text-white p-4 rounded-lg">
        <div className="text-xs flex items-center space-x-4">
          <div>React Three Fiber</div>
          <div>•</div>
          <div>Three.js</div>
          <div>•</div>
          <div>PLATEAU</div>
        </div>
      </div>
    </div>
  );
}