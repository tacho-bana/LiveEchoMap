'use client';

import * as THREE from 'three';

export interface SoundSource {
  id: string;
  position: THREE.Vector3;
  intensity: number; // dB値
}

export interface HeatmapDataPoint {
  coordinates: [number, number]; // [lng, lat]
  intensity: number; // 正規化された強度 (0-1)
}

export interface CalculationResult {
  heatmapData: HeatmapDataPoint[];
  gridPoints: Array<{
    position: THREE.Vector3;
    dB: number;
    color: THREE.Color;
  }>;
}

/**
 * 音響伝播計算エンジン
 * PLATEAUの建物データを使用して、軽量な音の伝播シミュレーションを行う
 */
export class SoundCalculationEngine {
  private gridSize: number;
  private calculationRadius: number;
  private raycaster: THREE.Raycaster;
  
  // 地理座標の基準点（山下ふ頭）
  private readonly referenceCoords = { longitude: 139.63, latitude: 35.45 };

  constructor(gridSize: number = 20, calculationRadius: number = 100) {
    this.gridSize = gridSize;
    this.calculationRadius = calculationRadius;
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * 音源からの音の伝播を計算する（軽量化版）
   * @param soundSource 音源情報
   * @param buildingMeshes 建物メッシュの配列
   * @returns 計算結果（ヒートマップデータとグリッド点データ）
   */
  calculateSoundPropagation(
    soundSource: SoundSource,
    buildingMeshes: THREE.Mesh[]
  ): CalculationResult {
    console.log(`音響計算開始: 音源位置 ${soundSource.position.x}, ${soundSource.position.y}, ${soundSource.position.z}`);
    console.log(`計算範囲: 半径${this.calculationRadius}m, グリッドサイズ: ${this.gridSize}m`);
    console.log(`音の伝播方向: 全方向（360度）- 音源を中心とした円形の範囲で計算`);

    const gridPoints: Array<{
      position: THREE.Vector3;
      dB: number;
      color: THREE.Color;
    }> = [];

    const heatmapData: HeatmapDataPoint[] = [];

    // 計算グリッドの生成（軽量化: より粗いグリッド）
    const steps = Math.floor(this.calculationRadius / this.gridSize);
    
    // 建物メッシュを事前にフィルタリング（パフォーマンス改善）
    const nearbyBuildings = this.filterNearbyBuildings(
      buildingMeshes, 
      soundSource.position, 
      soundSource.position
    );
    
    console.log(`建物フィルタリング: ${buildingMeshes.length} → ${nearbyBuildings.length}`);
    
    let calculatedPoints = 0;
    const totalPoints = (2 * steps + 1) ** 2;
    
    for (let x = -steps; x <= steps; x += 1) { // ステップを1に（間引かない）
      for (let z = -steps; z <= steps; z += 1) {
        const gridX = soundSource.position.x + x * this.gridSize;
        const gridZ = soundSource.position.z + z * this.gridSize;
        const gridY = soundSource.position.y; // 音源と同じ高さで計算

        const gridPosition = new THREE.Vector3(gridX, gridY, gridZ);
        
        // 音源からの距離チェック
        const distance = soundSource.position.distanceTo(gridPosition);
        if (distance > this.calculationRadius || distance < 1) continue;

        // 軽量化された音の伝播計算
        const dB = this.calculateSoundAtPointLight(soundSource, gridPosition, nearbyBuildings);
        const color = this.dBToColor(dB);

        gridPoints.push({
          position: gridPosition.clone(),
          dB,
          color
        });

        // 3D座標を地理座標に変換してヒートマップデータに追加
        const geoCoords = this.worldToGeo(gridPosition);
        const normalizedIntensity = this.normalizeIntensity(dB);
        
        heatmapData.push({
          coordinates: [geoCoords.longitude, geoCoords.latitude],
          intensity: normalizedIntensity
        });
        
        calculatedPoints++;
      }
    }

    console.log(`音響計算完了: ${calculatedPoints}個のグリッド点を計算 (全体の${Math.round(calculatedPoints/totalPoints*100)}%)`);
    
    return {
      heatmapData,
      gridPoints
    };
  }

  /**
   * 特定の地点での音の強さを計算
   * @param soundSource 音源
   * @param targetPosition 計算対象の位置
   * @param buildingMeshes 建物メッシュ
   * @returns dB値
   */
  private calculateSoundAtPoint(
    soundSource: SoundSource,
    targetPosition: THREE.Vector3,
    buildingMeshes: THREE.Mesh[]
  ): number {
    const distance = soundSource.position.distanceTo(targetPosition);
    
    // 自由空間での減衰計算
    // dB_r = dB_initial - 20 * log10(distance)
    let dB = soundSource.intensity - 20 * Math.log10(distance);

    // レイキャスティングで建物による遮蔽・透過を計算
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, soundSource.position)
      .normalize();

    this.raycaster.set(soundSource.position, direction);
    
    // 近くの建物のみを対象にして計算負荷を軽減
    const nearbyBuildings = this.filterNearbyBuildings(
      buildingMeshes, 
      soundSource.position, 
      targetPosition
    );

    const intersections = this.raycaster.intersectObjects(nearbyBuildings, false);
    
    // 音源と対象地点の間にある遮蔽物をカウント
    let obstructionCount = 0;
    for (const intersection of intersections) {
      if (intersection.distance < distance) {
        obstructionCount++;
      }
    }

    // 建物による透過損失（1回の透過につき-10dB）
    dB -= obstructionCount * 10;

    // 最小値を設定（完全に無音にはならない）
    return Math.max(dB, 20);
  }

  /**
   * 軽量版：特定の地点での音の強さを計算（簡易版）
   * @param soundSource 音源
   * @param targetPosition 計算対象の位置
   * @param nearbyBuildings 事前フィルタリング済みの建物メッシュ
   * @returns dB値
   */
  private calculateSoundAtPointLight(
    soundSource: SoundSource,
    targetPosition: THREE.Vector3,
    nearbyBuildings: THREE.Mesh[]
  ): number {
    const distance = soundSource.position.distanceTo(targetPosition);
    
    // 自由空間での減衰計算
    let dB = soundSource.intensity - 20 * Math.log10(distance);

    // 簡易遮蔽計算（レイキャスティングを簡素化）
    if (nearbyBuildings.length > 0) {
      const direction = new THREE.Vector3()
        .subVectors(targetPosition, soundSource.position)
        .normalize();

      this.raycaster.set(soundSource.position, direction);
      
      // 最初に当たった建物のみ考慮（計算量大幅削減）
      const intersections = this.raycaster.intersectObjects(nearbyBuildings, false);
      
      if (intersections.length > 0 && intersections[0].distance < distance) {
        // 簡易遮蔽損失
        dB -= 15; // 固定値で処理を軽量化
      }
    }

    return Math.max(dB, 20);
  }

  /**
   * 計算対象となる近くの建物をフィルタリング（軽量化版）
   * パフォーマンス最適化のため
   */
  private filterNearbyBuildings(
    buildingMeshes: THREE.Mesh[],
    soundPosition: THREE.Vector3,
    targetPosition: THREE.Vector3
  ): THREE.Mesh[] {
    // 音源から一定範囲内の建物のみを対象（より狭い範囲）
    const searchRadius = Math.min(this.calculationRadius * 0.5, 50);

    return buildingMeshes.slice(0, 10).filter(mesh => { // 最大10個の建物のみ考慮
      const meshPosition = new THREE.Vector3();
      mesh.getWorldPosition(meshPosition);
      
      return soundPosition.distanceTo(meshPosition) <= searchRadius;
    });
  }

  /**
   * dB値を色に変換
   * @param dB デシベル値
   * @returns THREE.Color
   */
  private dBToColor(dB: number): THREE.Color {
    if (dB >= 80) return new THREE.Color(0xff0000); // 赤
    if (dB >= 60) return new THREE.Color(0xff8800); // オレンジ
    if (dB >= 40) return new THREE.Color(0xffff00); // 黄色
    return new THREE.Color(0x00ff00); // 緑
  }

  /**
   * 3D座標を地理座標に変換
   * @param worldPosition 3D座標
   * @returns 地理座標
   */
  private worldToGeo(worldPosition: THREE.Vector3): { longitude: number; latitude: number } {
    // より現実的な変換スケール（1m ≈ 0.00001度程度）
    const scale = 0.00001; // 1メートル当たりの度数
    
    return {
      longitude: this.referenceCoords.longitude + worldPosition.x * scale,
      latitude: this.referenceCoords.latitude + worldPosition.z * scale
    };
  }

  /**
   * dB値を0-1の範囲に正規化
   * @param dB デシベル値
   * @returns 正規化された値
   */
  private normalizeIntensity(dB: number): number {
    const minDB = 20;
    const maxDB = 100;
    return Math.max(0, Math.min(1, (dB - minDB) / (maxDB - minDB)));
  }
}