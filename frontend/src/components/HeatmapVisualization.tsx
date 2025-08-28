'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 10dB刻みで詳細な色分けを行う関数（雨雲レーダー風）
 */
function getDetailedColorByDB(dB: number): THREE.Color {
  if (dB >= 80) return new THREE.Color('#8b0000'); // 暗赤（危険レベル）
  if (dB >= 70) return new THREE.Color('#ff0000'); // 真っ赤（非常に大きい）
  if (dB >= 60) return new THREE.Color('#ff4500'); // 赤オレンジ（大きい）
  if (dB >= 50) return new THREE.Color('#ff8c00'); // オレンジ（やや大きい）
  if (dB >= 40) return new THREE.Color('#ffd700'); // 金色（普通）
  if (dB >= 30) return new THREE.Color('#ffff00'); // 黄色（やや小さい）
  if (dB >= 20) return new THREE.Color('#80ff00'); // 薄緑（小さい）
  if (dB >= 10) return new THREE.Color('#42ffc6'); // 緑（静か）
  return new THREE.Color('#add8e6'); // 薄い青（微かな音）
}

interface HeatmapVisualizationProps {
  gridPoints: Array<{
    position: THREE.Vector3;
    dB: number;
    color: THREE.Color;
  }>;
  visible: boolean;
  gridSize?: number; // 動的グリッドサイズ
}

/**
 * 3D空間上でのヒートマップ可視化コンポーネント
 * 音の伝播計算結果を色分けされた平面メッシュで表示
 */
export const HeatmapVisualization: React.FC<HeatmapVisualizationProps> = ({
  gridPoints,
  visible,
  gridSize = 20
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // グリッドポイントから平面メッシュを生成
  const heatmapMeshes = useMemo(() => {
    if (gridPoints.length === 0) return [];

    return gridPoints
      .filter(point => point.dB > 10) // 10dB以下は完全に非表示
      .map((point, index) => {
        // グリッドサイズにぴったり合わせて重複を避ける
        const geometry = new THREE.PlaneGeometry(gridSize, gridSize);
        
        // 10dB刻みで色分け
        const color = getDetailedColorByDB(point.dB);
        
        const material = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: point.dB <= 10 ? 0.3 : point.dB <= 20 ? 0.4 : point.dB <= 30 ? 0.5 : 0.8,
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
          originalColor: color.clone()
        };

        return mesh;
      });
  }, [gridPoints, gridSize]);

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

  

};