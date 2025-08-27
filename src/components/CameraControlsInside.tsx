'use client';

import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

interface CameraControlsInsideProps {
  onCameraInfo?: (info: { position: THREE.Vector3; target: THREE.Vector3 }) => void;
  cameraCommand?: { 
    type: 'move'; 
    position: [number, number, number]; 
    target: [number, number, number];
  } | null;
}

export const CameraControlsInside: React.FC<CameraControlsInsideProps> = ({ 
  onCameraInfo, 
  cameraCommand 
}) => {
  const { camera, controls, scene } = useThree();

  useFrame(() => {
    if (controls && onCameraInfo) {
      const target = (controls as any).target || new THREE.Vector3(0, 0, 0);
      onCameraInfo({
        position: camera.position.clone(),
        target: target.clone()
      });
    }
  });

  useEffect(() => {
    if (cameraCommand && cameraCommand.type === 'move' && controls) {
      camera.position.set(...cameraCommand.position);
      (controls as any).target.set(...cameraCommand.target);
      (controls as any).update();
    }
  }, [cameraCommand, camera, controls]);

  // Auto-fit to models when they load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (controls && scene) {
        const boundingBox = new THREE.Box3();
        let hasGeometry = false;

        scene.traverse((object) => {
          if (object instanceof THREE.Mesh && object.geometry) {
            const box = new THREE.Box3().setFromObject(object);
            if (box.isEmpty() === false) {
              boundingBox.expandByObject(object);
              hasGeometry = true;
            }
          }
        });

        if (hasGeometry && !boundingBox.isEmpty()) {
          const center = boundingBox.getCenter(new THREE.Vector3());
          const size = boundingBox.getSize(new THREE.Vector3());
          const maxSize = Math.max(size.x, size.y, size.z);
          const distance = maxSize * 1.5;
          
          camera.position.set(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7
          );
          
          (controls as any).target.copy(center);
          (controls as any).update();
        }
      }
    }, 2000); // Wait for models to load

    return () => clearTimeout(timer);
  }, [camera, controls, scene]);

  return null;
};