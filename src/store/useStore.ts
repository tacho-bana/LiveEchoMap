import { create } from 'zustand';

interface Store {
  isModelLoaded: boolean;
  setModelLoaded: (loaded: boolean) => void;
  cameraPosition: { x: number; y: number; z: number };
  setCameraPosition: (position: { x: number; y: number; z: number }) => void;
}

// Zustandを使用したシンプルなストア例
export const useStore = create<Store>((set) => ({
  isModelLoaded: false,
  setModelLoaded: (loaded) => set({ isModelLoaded: loaded }),
  cameraPosition: { x: 0, y: 50, z: 100 },
  setCameraPosition: (position) => set({ cameraPosition: position }),
}));