'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HeatmapVisualizationProps {
  gridPoints: Array<{
    position: THREE.Vector3;
    dB: number;
    color: THREE.Color;
  }>;
  visible: boolean;
}

/**
 * 3D空間上でのヒートマップ可視化コンポーネント
 * 音の伝播計算結果を色分けされた平面メッシュで表示
 */
export const HeatmapVisualization: React.FC<HeatmapVisualizationProps> = ({
  gridPoints,
  visible
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // グリッドポイントから平面メッシュを生成
  const heatmapMeshes = useMemo(() => {
    if (gridPoints.length === 0) return [];

    return gridPoints.map((point, index) => {
      // 各グリッドポイントに小さな平面を配置
      const geometry = new THREE.PlaneGeometry(4, 4);
      const material = new THREE.MeshBasicMaterial({
        color: point.color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // 位置を設定（少し上に浮かせて建物と重ならないようにする）
      mesh.position.copy(point.position);
      mesh.position.y += 2;
      
      // 水平に配置（上から見えるように）
      mesh.rotation.x = -Math.PI / 2;
      
      // メッシュにメタデータを追加
      mesh.userData = {
        dB: point.dB,
        originalColor: point.color.clone()
      };

      return mesh;
    });
  }, [gridPoints]);

  // 静的表示（アニメーション削除）
  useFrame(() => {
    // アニメーション効果を削除して静的表示
    return;
  });

  if (!visible || gridPoints.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef}>
      {heatmapMeshes.map((mesh, index) => (
        <primitive key={`heatmap-${index}`} object={mesh} />
      ))}
      
      {/* ヒートマップの境界を示すワイヤーフレーム */}
      <group>
        {gridPoints.length > 0 && (
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(200, 1, 200)]} />
            <lineBasicMaterial color="white" transparent opacity={0.3} />
          </lineSegments>
        )}
      </group>
    </group>
  );
};

/**
 * ヒートマップの凡例を表示するための2Dオーバーレイコンポーネント
 */
export const HeatmapLegend: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="absolute bottom-4 right-4 bg-white rounded-lg p-4 shadow-lg z-30">
      <h4 className="text-sm font-semibold mb-3 text-gray-800">音の強度レベル</h4>
      <div className="space-y-2 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          <span>80dB以上 (非常に大きい)</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
          <span>60-79dB (大きい)</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
          <span>40-59dB (普通)</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
          <span>40dB未満 (静か)</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        <p>• 色が濃いほど音が大きい</p>
        <p>• 建物による遮蔽効果を考慮</p>
      </div>
    </div>
  );
};