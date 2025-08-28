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
  gridSize: number; // 動的グリッドサイズを追加
}

export interface ApiSoundResult {
  x: number;
  y: number;
  z: number;
  db: number;
  distance: number;
  obstruction_count: number;
}

/**
 * 音響伝播計算エンジン（API版）
 * バックエンドAPIを呼び出して現実的な音の伝播シミュレーションを行う
 */
export class SoundCalculationEngineAPI {
  private gridSize: number;
  private calculationRadius: number;
  private apiBaseUrl: string;
  
  // 地理座標の基準点（山下ふ頭）
  private readonly referenceCoords = { longitude: 139.63, latitude: 35.45 };

  constructor(gridSize: number = 20, calculationRadius: number = 300) {
    this.gridSize = gridSize;
    this.calculationRadius = calculationRadius;
    this.apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  }

  /**
   * APIを使用した音響伝播計算
   * @param soundSource 音源情報
   * @param buildingMeshes 使用しない（API側で処理）
   * @returns 計算結果（ヒートマップデータとグリッド点データ）
   */
  async calculateSoundPropagation(
    soundSource: SoundSource,
    buildingMeshes?: THREE.Mesh[]
  ): Promise<CalculationResult> {
    console.log(`API音響計算開始: 音源位置 ${soundSource.position.x}, ${soundSource.position.y}, ${soundSource.position.z}`);
    console.log(`計算範囲: 半径${this.calculationRadius}m, グリッドサイズ: ${this.gridSize}m`);

    try {
      // APIリクエストデータを準備
      const requestData = {
        source_pos: [
          soundSource.position.x,
          soundSource.position.y, 
          soundSource.position.z
        ],
        initial_db: soundSource.intensity,
        grid_size: this.gridSize,
        calc_range: this.calculationRadius
      };

      console.log('APIリクエスト:', requestData);

      // バックエンドAPIを呼び出し
      const response = await fetch(`${this.apiBaseUrl}/calculate_sound/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`API計算完了: ${data.points_processed}個のポイントを処理`);

      // API結果をフロントエンド形式に変換（グリッドサイズ情報も含む）
      return this.convertApiResultToCalculationResult(data.results, data.grid_size || this.gridSize);

    } catch (error) {
      console.error('API音響計算エラー:', error);
      
      // フォールバック: 簡易的な結果を返す
      return this.generateFallbackResult(soundSource);
    }
  }

  /**
   * API結果をCalculationResult形式に変換
   */
  private convertApiResultToCalculationResult(apiResults: ApiSoundResult[], actualGridSize: number): CalculationResult {
    const gridPoints: Array<{
      position: THREE.Vector3;
      dB: number;
      color: THREE.Color;
    }> = [];

    const heatmapData: HeatmapDataPoint[] = [];

    for (const result of apiResults) {
      // グリッド点データ
      gridPoints.push({
        position: new THREE.Vector3(result.x, result.y, result.z),
        dB: result.db,
        color: this.dBToColor(result.db)
      });

      // ヒートマップデータ（地理座標に変換）
      const geoCoords = this.worldToGeo(new THREE.Vector3(result.x, result.y, result.z));
      heatmapData.push({
        coordinates: [geoCoords.longitude, geoCoords.latitude],
        intensity: this.normalizeIntensity(result.db)
      });
    }

    return {
      heatmapData,
      gridPoints,
      gridSize: actualGridSize
    };
  }

  /**
   * API接続失敗時のフォールバック結果生成
   */
  private generateFallbackResult(soundSource: SoundSource): CalculationResult {
    console.warn('APIフォールバック: 簡易計算を使用');
    
    const gridPoints: Array<{
      position: THREE.Vector3;
      dB: number;
      color: THREE.Color;
    }> = [];

    const heatmapData: HeatmapDataPoint[] = [];

    // 簡易的な同心円計算
    const steps = Math.floor(this.calculationRadius / this.gridSize);
    
    for (let x = -steps; x <= steps; x++) {
      for (let z = -steps; z <= steps; z++) {
        const gridX = soundSource.position.x + x * this.gridSize;
        const gridZ = soundSource.position.z + z * this.gridSize;
        const gridY = 0;

        const gridPosition = new THREE.Vector3(gridX, gridY, gridZ);
        const distance = soundSource.position.distanceTo(gridPosition);
        
        if (distance > this.calculationRadius || distance < 1) continue;

        // 簡易距離減衰
        let dB = soundSource.intensity;
        if (distance <= 10) {
          dB = soundSource.intensity - (soundSource.intensity - 80) * (distance / 10);
        } else if (distance <= 100) {
          dB = 80 - 20 * (distance - 10) / 90;
        } else {
          dB = 60 - 20 * (distance - 100) / 900;
        }

        dB = Math.max(dB, 20);

        gridPoints.push({
          position: gridPosition.clone(),
          dB,
          color: this.dBToColor(dB)
        });

        const geoCoords = this.worldToGeo(gridPosition);
        heatmapData.push({
          coordinates: [geoCoords.longitude, geoCoords.latitude],
          intensity: this.normalizeIntensity(dB)
        });
      }
    }

    return {
      heatmapData,
      gridPoints,
      gridSize: this.gridSize
    };
  }

  /**
   * モデル情報を取得
   */
  async getModelInfo() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/model_info`);
      if (response.ok) {
        const info = await response.json();
        console.log('モデル情報:', info);
        return info;
      }
    } catch (error) {
      console.warn('モデル情報の取得に失敗:', error);
    }
    return null;
  }

  /**
   * dB値を色に変換
   */
  private dBToColor(dB: number): THREE.Color {
    if (dB >= 70) return new THREE.Color(0xff0000); // 赤
    if (dB >= 60) return new THREE.Color(0xff8800); // オレンジ
    if (dB >= 50) return new THREE.Color(0xffff00); // 黄色
    if (dB >= 40) return new THREE.Color(0x88ff00); // 黄緑
    return new THREE.Color(0x00ff00); // 緑
  }

  /**
   * 3D座標を地理座標に変換
   */
  private worldToGeo(worldPosition: THREE.Vector3): { longitude: number; latitude: number } {
    // より現実的な変換スケール
    const scale = 0.00001;
    
    return {
      longitude: this.referenceCoords.longitude + worldPosition.x * scale,
      latitude: this.referenceCoords.latitude + worldPosition.z * scale
    };
  }

  /**
   * dB値を0-1の範囲に正規化
   */
  private normalizeIntensity(dB: number): number {
    const minDB = 20;
    const maxDB = 90;
    return Math.max(0, Math.min(1, (dB - minDB) / (maxDB - minDB)));
  }
}