'use client';

import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface AudioSimulationProps {
  gridPoints: Array<{
    position: THREE.Vector3;
    dB: number;
    color: THREE.Color;
    bassDb?: number;
  }>;
  soundSourcePosition: THREE.Vector3;
  gridSize: number;
  onPointClick: (point: { position: THREE.Vector3; dB: number; bassDb?: number }) => void;
}

/**
 * 既存のヒートマップに長押しクリック機能と視覚的フィードバックを追加
 */
export const AudioSimulation: React.FC<AudioSimulationProps> = ({
  gridPoints,
  soundSourcePosition,
  gridSize,
  onPointClick
}) => {
  const { raycaster, pointer, camera, scene } = useThree();
  const [clickStart, setClickStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [pressedPoint, setPressedPoint] = useState<{ position: THREE.Vector3; color: THREE.Color } | null>(null);
  const pressIndicatorRef = useRef<THREE.Mesh | null>(null);

  // 長押しフィードバック表示
  useEffect(() => {
    if (pressedPoint && scene) {
      // 長押し中のリング表示
      const ringGeometry = new THREE.RingGeometry(gridSize * 0.6, gridSize * 0.8, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(pressedPoint.position.x, pressedPoint.position.y + 4, pressedPoint.position.z);
      ring.rotation.x = -Math.PI / 2;
      
      scene.add(ring);
      pressIndicatorRef.current = ring;

      // アニメーション: リングが徐々に小さくなる
      const animateRing = () => {
        if (ring && ring.scale.x > 0.3) {
          ring.scale.x -= 0.02;
          ring.scale.y -= 0.02;
          ring.material.opacity -= 0.01;
          requestAnimationFrame(animateRing);
        }
      };
      animateRing();

    } else if (pressIndicatorRef.current && scene) {
      // フィードバック削除
      scene.remove(pressIndicatorRef.current);
      pressIndicatorRef.current = null;
    }

    return () => {
      if (pressIndicatorRef.current && scene) {
        scene.remove(pressIndicatorRef.current);
        pressIndicatorRef.current = null;
      }
    };
  }, [pressedPoint, scene, gridSize]);

  // 誤タップ防止付きクリックハンドラー
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!camera) return;

      const clickStart = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      };
      setClickStart(clickStart);

      // 既存のヒートマップパネルとの交差判定
      raycaster.setFromCamera(pointer, camera);
      
      // ヒートマップのメッシュを探す（userData.dBがあるもの）
      const allObjects: THREE.Object3D[] = [];
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.dB !== undefined) {
          allObjects.push(child);
        }
      });

      const intersects = raycaster.intersectObjects(allObjects);
      
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const meshData = intersectedObject.userData;
        
        if (meshData && meshData.dB >= 10) {
          // 長押しフィードバック表示開始
          setPressedPoint({
            position: new THREE.Vector3().copy(intersects[0].point),
            color: meshData.originalColor || new THREE.Color(0xffffff)
          });
          console.log(`🎵 長押し開始: 音量=${meshData.dB.toFixed(1)}dB`);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!camera || !clickStart) return;

      // 誤タップ防止: 移動距離と時間をチェック
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - clickStart.x, 2) + 
        Math.pow(event.clientY - clickStart.y, 2)
      );
      const holdTime = Date.now() - clickStart.time;

      // フィードバック削除
      setPressedPoint(null);

      // 移動距離が10px以下、かつ長押し（500ms以上）でのみ反応
      if (moveDistance <= 10 && holdTime >= 500 && holdTime <= 2000) {
        raycaster.setFromCamera(pointer, camera);
        
        // 再度交差判定
        const allObjects: THREE.Object3D[] = [];
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.dB !== undefined) {
            allObjects.push(child);
          }
        });

        const intersects = raycaster.intersectObjects(allObjects);
        
        if (intersects.length > 0) {
          const intersectedObject = intersects[0].object;
          const meshData = intersectedObject.userData;
          
          if (meshData && meshData.dB >= 10) {
            // 対応するgridPointを探す
            const clickedPoint = gridPoints.find(point => 
              Math.abs(point.position.x - intersects[0].point.x) < gridSize/2 &&
              Math.abs(point.position.z - intersects[0].point.z) < gridSize/2
            );

            if (clickedPoint) {
              console.log(`🎵 音響パネル長押し成功: 位置=(${clickedPoint.position.x.toFixed(1)}, ${clickedPoint.position.z.toFixed(1)}), 音量=${clickedPoint.dB.toFixed(1)}dB`);
              onPointClick(clickedPoint);
            }
          }
        }
      } else if (holdTime < 500) {
        console.log('⏱️ 長押し時間が短すぎます（0.5秒以上必要）');
      }

      setClickStart(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, pointer, raycaster, onPointClick, clickStart, gridPoints, scene, gridSize]);

  // このコンポーネントは視覚的要素を描画しない（既存のヒートマップを使用）
  return null;
};