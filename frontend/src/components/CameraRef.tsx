'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraRefProps {
  onCameraRef: (camera: THREE.Camera) => void;
}

/**
 * カメラの参照を取得して親コンポーネントに渡す
 */
export const CameraRef: React.FC<CameraRefProps> = ({ onCameraRef }) => {
  const { camera } = useThree();

  useEffect(() => {
    onCameraRef(camera);
  }, [camera, onCameraRef]);

  return null;
};