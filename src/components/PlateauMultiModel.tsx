'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface PlateauMultiModelProps {
  basePath: string;
  models: {
    buildings?: string;
    terrain?: string;
    roads?: string;
  };
  position?: [number, number, number];
  scale?: number;
}

const ModelComponent: React.FC<{ 
  path: string; 
  color?: string; 
  opacity?: number;
  position?: [number, number, number];
}> = ({ path, color, opacity = 1, position = [0, 0, 0] }) => {
  const { scene } = useGLTF(path, true);

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          if (color && child.material instanceof THREE.MeshStandardMaterial) {
            child.material = child.material.clone();
            child.material.color.setStyle(color);
            child.material.opacity = opacity;
            child.material.transparent = opacity < 1;
          }
        }
      });
    }
  }, [scene, color, opacity]);

  if (!scene) return null;

  return <primitive object={scene.clone()} position={position} />;
};

export const PlateauMultiModel: React.FC<PlateauMultiModelProps> = ({ 
  basePath, 
  models,
  position = [0, 0, 0],
  scale = 1
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      // Optional: Add subtle animation or updates
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={position} 
      scale={[scale, scale, scale]}
    >
      {/* 地形 (最下層) */}
      {models.terrain && (
        <ModelComponent 
          path={`${basePath}/${models.terrain}`}
          color="#8B4513"
          opacity={0.9}
          position={[0, -0, 0]}
        />
      )}
      
      {/* 道路 */}
      {models.roads && (
        <ModelComponent 
          path={`${basePath}/${models.roads}`}
          color="#555555"
          opacity={1}
          position={[0, 0, 0]}
        />
      )}
      
      {/* 建築物 (最上層) */}
      {models.buildings && (
        <ModelComponent 
          path={`${basePath}/${models.buildings}`}
          color="#E6E6FA"
          opacity={1}
          position={[0, 0, 0]}
        />
      )}
    </group>
  );
};

// Preload all models
export const preloadMultiModels = (basePath: string, models: PlateauMultiModelProps['models']) => {
  if (models.buildings) useGLTF.preload(`${basePath}/${models.buildings}`);
  if (models.terrain) useGLTF.preload(`${basePath}/${models.terrain}`);
  if (models.roads) useGLTF.preload(`${basePath}/${models.roads}`);
};