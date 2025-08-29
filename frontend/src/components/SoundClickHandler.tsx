'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SoundSource } from './SoundCalculationEngineAPI';

interface SoundClickHandlerProps {
  onSoundSourcePlaced: (source: SoundSource) => void;
  buildingMeshes: THREE.Mesh[];
  enabled: boolean;
}

/**
 * 3D空間でのクリック検出とサウンドソース配置を処理するコンポーネント
 * THREE.Raycasterを使用して、クリックした地点の3D座標を取得
 */
export const SoundClickHandler: React.FC<SoundClickHandlerProps> = ({
  onSoundSourcePlaced,
  buildingMeshes,
  enabled
}) => {
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  useFrame(() => {
    // フレームごとの処理は特になし（クリックイベントで処理）
  });

  /**
   * マウスクリックイベントハンドラー
   * カメラの現在位置に音源を配置
   */
  const handleClick = (event: MouseEvent) => {
    if (!enabled) return;

    // カメラの現在位置を取得（少し前方に配置）
    const cameraPosition = camera.position.clone();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // カメラから少し前方（10単位）の位置に音源を配置
    const position = cameraPosition.clone().add(cameraDirection.multiplyScalar(10));

    // 音源IDを生成
    const sourceId = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 音源オブジェクトを作成
    const soundSource: SoundSource = {
      id: sourceId,
      position: position,
      intensity: 80 // デフォルト値（後でUIから変更可能）
    };

    console.log('音源配置:', {
      id: sourceId,
      position: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`,
      cameraPosition: `(${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})`
    });

    // 親コンポーネントに音源配置を通知
    onSoundSourcePlaced(soundSource);
  };

  // マウスクリックイベントリスナーの設定
  useEffect(() => {
    const canvas = gl.domElement;
    
    if (enabled) {
      canvas.addEventListener('click', handleClick);
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.removeEventListener('click', handleClick);
      canvas.style.cursor = 'default';
    }

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.style.cursor = 'default';
    };
  }, [enabled, camera, gl.domElement, onSoundSourcePlaced]);

  // このコンポーネントは視覚的な要素を持たない
  return null;
};