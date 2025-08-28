'use client';

import { useRef, useState, useMemo } from 'react';
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
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
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

    // マテリアルの色を強制更新
    if (materialRef.current) {
      materialRef.current.color.copy(intensityColor);
      materialRef.current.emissive.copy(intensityColor);
      materialRef.current.needsUpdate = true;
    }
  });

  /**
   * 音源の強度に基づいて色を決定
   */
  const getIntensityColor = (dB: number): string => {
    if (dB >= 80) return '#8b0000'; // 暗赤（危険レベル）
    if (dB >= 70) return '#ff0000'; // 真っ赤（非常に大きい）
    if (dB >= 60) return '#ff4500'; // 赤オレンジ（大きい）
    if (dB >= 50) return '#ff8c00'; // オレンジ（やや大きい）
    if (dB >= 40) return '#ffd700'; // 金色（普通）
    if (dB >= 30) return '#ffff00'; // 黄色（やや小さい）
    if (dB >= 20) return '#80ff00'; // 薄緑（小さい）
    if (dB >= 10) return '#42ffc6'; // 緑（静か）
    return '#add8e6'; // 薄い青（微かな音）
  };

  /**
   * クリック時の削除処理
   */
  const handleClick = (event: any) => {
    event.stopPropagation();
    onRemove(id);
  };

  const intensityColor = useMemo(() => {
    const colorString = getIntensityColor(intensity);
    console.log(`Sound source ${id}: intensity=${intensity}dB, color=${colorString}`);
    return new THREE.Color(colorString);
  }, [intensity, id]);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 音源本体（シンプルな赤い球体） */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        key={`${id}-${intensity}`}
      >
        <sphereGeometry args={[intensity >= 80 ? 6 : 4, 16, 16]} />
        <meshStandardMaterial 
          ref={materialRef}
          key={`${id}-material-${intensity}`}
          color={intensityColor}
          emissive={intensityColor}
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