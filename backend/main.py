# main.py
import numpy as np
import trimesh
from fastapi import FastAPI
from pydantic import BaseModel
import logging

# ログの設定
logging.basicConfig(level=logging.INFO)

# --- FastAPIアプリケーションの定義 ---
app = FastAPI()

# --- グローバル変数（モデルのキャッシュ） ---
# サーバー起動時に一度だけモデルを読み込み、メモリに保持します
building_mesh = None

# --- APIリクエストのデータモデル ---
class SoundRequest(BaseModel):
    source_pos: list[float]  # [x, y, z]
    initial_db: float        # 初期音量（dB）

# --- サーバー起動時の処理 ---
@app.on_event("startup")
def load_model():
    """API起動時にGLBファイルを読み込み、メッシュをキャッシュする"""
    global building_mesh
    file_path = "../frontend/public/models/test2.glb/bldg_Building.glb"
    try:
        # GLBファイルを読み込み、すべてのメッシュを結合
        scene = trimesh.load(file_path)
        # シーン内の全てのメッシュを結合し、一つのメッシュとして扱う
        building_mesh = trimesh.util.concatenate(
            tuple(g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh))
        )
        if building_mesh:
            logging.info("Building mesh loaded successfully.")
    except Exception as e:
        logging.error(f"Failed to load GLB file: {e}")
        building_mesh = None

# --- APIエンドポイント ---
@app.post("/calculate_sound/")
async def calculate_sound(request: SoundRequest):
    """音響シミュレーションを実行し、グリッドデータを返す"""
    if building_mesh is None:
        return {"error": "Building model not loaded."}, 500

    # パラメータの取得
    source_pos = np.array(request.source_pos, dtype=np.float64)
    initial_db = request.initial_db
    
    # 計算グリッドの定義
    grid_size = 5
    grid_range = 200 # 音源から半径200m
    
    x_coords = np.arange(source_pos[0] - grid_range, source_pos[0] + grid_range, grid_size)
    z_coords = np.arange(source_pos[2] - grid_range, source_pos[2] + grid_range, grid_size)
    
    results = []
    ray_origins = []
    ray_directions = []

    # Rayの生成
    for x in x_coords:
        for z in z_coords:
            target_pos = np.array([x, source_pos[1], z], dtype=np.float64)
            direction = target_pos - source_pos
            ray_origins.append(source_pos)
            ray_directions.append(direction / np.linalg.norm(direction))
    
    # trimeshのRaycastingを実行（複数Rayを一括処理）
    locations, index_ray, index_tri = building_mesh.ray.intersects_location(
        ray_origins=ray_origins,
        ray_directions=ray_directions
    )
    
    # 各Rayの交差回数をカウント
    intersection_counts = np.zeros(len(ray_origins), dtype=np.int32)
    unique_rays, counts = np.unique(index_ray, return_counts=True)
    for i, ray_index in enumerate(unique_rays):
        intersection_counts[ray_index] = counts[i]

    # 音の強さの計算
    idx = 0
    for x in x_coords:
        for z in z_coords:
            distance = np.linalg.norm(np.array([x, source_pos[1], z]) - source_pos)
            
            # 自由空間減衰
            # 距離が0に近づくとlogが無限大になるため、最小値を設定
            distance_clamped = max(distance, 1e-6)
            db_decay = 20 * np.log10(distance_clamped)
            
            # 透過減衰（交差回数に応じて減算）
            transmission_loss = intersection_counts[idx] * 10
            
            # 最終的な音の強さ
            final_db = initial_db - db_decay - transmission_loss
            
            results.append({"x": x, "z": z, "db": final_db})
            idx += 1
            
    return {"results": results}