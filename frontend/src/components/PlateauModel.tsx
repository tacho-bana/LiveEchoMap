'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface PlateauModelProps {
  path: string;
  position?: [number, number, number];
  scale?: number;
  centerModel?: boolean;
  alignToGround?: boolean;
  onMeshLoad?: (meshes: THREE.Mesh[]) => void;
}

export const PlateauModel: React.FC<PlateauModelProps> = ({ 
  path, 
  position = [0, 0, 0],
  scale = 1,
  centerModel = true,
  alignToGround = false,
  onMeshLoad
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  const { scene } = useGLTF(path, true);

  const processModel = useCallback((scene: THREE.Object3D) => {
    const meshes: THREE.Mesh[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.metalness = 0.1;
          child.material.roughness = 0.9;
        }
        
        // Collect meshes for sound calculation
        meshes.push(child);
      }
    });

    // Pass meshes to parent component for sound calculation
    if (onMeshLoad && meshes.length > 0) {
      onMeshLoad(meshes);
    }

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Center the model only if requested
    if (centerModel) {
      scene.position.sub(center);
    }
    
    // Align model to ground if requested
    if (alignToGround) {
      scene.position.y = -box.min.y;
    }
    
    // Log model information for debugging
    console.log('Model loaded:', path, {
      center: center.toArray(),
      size: size.toArray(),
      bounds: {
        min: box.min.toArray(),
        max: box.max.toArray()
      },
      originalPosition: scene.position.toArray(),
      meshCount: meshes.length
    });
    
    return { scene, center, size };
  }, [centerModel, alignToGround, onMeshLoad]);

  useEffect(() => {
    if (scene) {
      processModel(scene);
      setModelLoaded(true);
      console.log('PLATEAU GLB model loaded:', path);
    }
  }, [scene, processModel, path]);

  useFrame(() => {
    if (groupRef.current && modelLoaded) {
      // Optional: Add subtle animation or updates
    }
  });

  if (!scene) {
    return null;
  }

  return (
    <group 
      ref={groupRef} 
      position={position} 
      scale={[scale, scale, scale]}
    >
      {scene && <primitive object={scene.clone()} />}
    </group>
  );
};

useGLTF.preload = (path: string) => {
  useGLTF(path, true);
};