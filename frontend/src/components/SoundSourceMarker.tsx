'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SoundSourceMarkerProps {
  position: THREE.Vector3;
  intensity: number;
  id: string;
  onRemove: (id: string) => void;
}

/**
 * 3D空間に配置される音源マーカーコンポーネント
 * 赤い球体で音源を可視化し、アニメーション効果を追加
 */
export const SoundSourceMarker: React.FC<SoundSourceMarkerProps> = ({
  position,
  intensity,
  id,
  onRemove
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // アニメーション用の時間管理
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // ホバー時のスケール変化のみ
      const targetScale = hovered ? 1.2 : 1.0;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  /**
   * 音源の強度に基づいて色を決定
   */
  const getIntensityColor = (dB: number): string => {
    if (dB >= 90) return '#ff0000'; // 非常に高い
    if (dB >= 80) return '#ff4400'; // 高い
    if (dB >= 70) return '#ff8800'; // 中程度
    if (dB >= 60) return '#ffaa00'; // やや低い
    return '#ffdd00'; // 低い
  };

  /**
   * クリック時の削除処理
   */
  const handleClick = (event: any) => {
    event.stopPropagation();
    onRemove(id);
  };

  const intensityColor = getIntensityColor(intensity);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 音源本体（シンプルな赤い球体） */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[4, 16, 16]} />
        <meshStandardMaterial 
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* 音源情報表示（ホバー時） */}
      {hovered && (
        <group position={[0, 10, 0]}>
          <mesh>
            <planeGeometry args={[16, 6]} />
            <meshBasicMaterial 
              color="white" 
              transparent 
              opacity={0.9}
            />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <planeGeometry args={[15, 5]} />
            <meshBasicMaterial 
              color="#333333"
            />
          </mesh>
          {/* 音源情報テキスト領域 */}
          <group position={[0, 0, 0.2]}>
            {/* 実際のテキスト表示は今後追加可能 */}
          </group>
        </group>
      )}
    </group>
  );
};