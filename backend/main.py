# main.py - Clean and Optimized Sound Calculation API
import numpy as np
import trimesh
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing as mp
from functools import partial
import threading
import time

# ログの設定
logging.basicConfig(level=logging.INFO)

# FastAPIアプリケーション
app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# グローバル変数（モデルのキャッシュ）
building_mesh = None
model_info = {
    "vertices": 0,
    "faces": 0,
    "bounds": None,
    "loaded": False
}

# 進捗管理
progress_lock = threading.Lock()
current_progress = {
    "total": 0,
    "completed": 0,
    "percentage": 0.0,
    "status": "idle",
    "start_time": None
}

# APIリクエストのデータモデル
class SoundRequest(BaseModel):
    source_pos: list[float]  # [x, y, z]
    initial_db: float        # 初期音量（dB）
    grid_size: int = 40      # グリッドサイズ（m）
    calc_range: int = 2000   # 計算範囲（m）

class SoundResult(BaseModel):
    x: float
    y: float  
    z: float
    db: float
    distance: float

# サーバー起動時の処理
@app.on_event("startup")
def load_model():
    """GLBファイルを読み込み"""
    global building_mesh, model_info
    
    potential_paths = [
        "../frontend/public/models/sinjuku/bldg_Building.glb",
        "frontend/public/models/sinjuku/bldg_Building.glb",
        "./frontend/public/models/sinjuku/bldg_Building.glb"
    ]
    
    for file_path in potential_paths:
        try:
            if not os.path.exists(file_path):
                continue
                
            logging.info(f"Loading model from: {file_path}")
            scene = trimesh.load(file_path)
            
            meshes = []
            if hasattr(scene, 'geometry'):
                for name, geom in scene.geometry.items():
                    if isinstance(geom, trimesh.Trimesh) and len(geom.vertices) > 0:
                        geom.remove_degenerate_faces()
                        geom.remove_duplicate_faces()
                        meshes.append(geom)
            
            if meshes:
                building_mesh = trimesh.util.concatenate(meshes)
                model_info.update({
                    "vertices": len(building_mesh.vertices),
                    "faces": len(building_mesh.faces),
                    "bounds": building_mesh.bounds.tolist(),
                    "loaded": True
                })
                logging.info(f"Model loaded: {model_info['vertices']} vertices, {model_info['faces']} faces")
                break
                
        except Exception as e:
            logging.error(f"Failed to load {file_path}: {e}")
            continue
    
    if building_mesh is None:
        logging.error("No valid model could be loaded")
        model_info["loaded"] = False

# APIエンドポイント
@app.get("/model_info")
async def get_model_info():
    """モデルの読み込み状況を確認"""
    return model_info

@app.get("/calculation_progress")
async def get_calculation_progress():
    """計算の進捗状況を取得"""
    with progress_lock:
        progress_data = current_progress.copy()
        
    # 経過時間を計算
    if progress_data["start_time"]:
        elapsed_time = time.time() - progress_data["start_time"]
        progress_data["elapsed_time"] = elapsed_time
        
        # 推定残り時間
        if progress_data["percentage"] > 0:
            estimated_total_time = elapsed_time / (progress_data["percentage"] / 100)
            progress_data["estimated_remaining_time"] = max(0, estimated_total_time - elapsed_time)
        else:
            progress_data["estimated_remaining_time"] = None
    else:
        progress_data["elapsed_time"] = 0
        progress_data["estimated_remaining_time"] = None
        
    return progress_data

@app.post("/calculate_sound/")
async def calculate_sound(request: SoundRequest):
    """音響シミュレーションを実行"""
    if building_mesh is None or not model_info["loaded"]:
        raise HTTPException(status_code=500, detail="Building model not loaded")

    source_pos = np.array(request.source_pos, dtype=np.float64)
    initial_db = request.initial_db
    grid_size = request.grid_size
    calc_range = request.calc_range
    
    logging.info(f"Calculating sound: source={source_pos}, initial_db={initial_db}, "
                f"grid={grid_size}, range={calc_range}")
    
    # 計算点を生成
    steps = int(calc_range / grid_size)
    calculation_points = []
    
    for x_step in range(-steps, steps + 1):
        for z_step in range(-steps, steps + 1):
            x = source_pos[0] + x_step * grid_size
            z = source_pos[2] + z_step * grid_size
            y = source_pos[1]
            
            # 円形範囲チェック
            xz_distance = np.sqrt((x - source_pos[0])**2 + (z - source_pos[2])**2)
            if xz_distance <= calc_range:
                target_pos = np.array([x, y, z])
                distance = np.linalg.norm(target_pos - source_pos)
                if distance >= 1:
                    calculation_points.append((x, y, z, distance))
    
    total_points = len(calculation_points)
    logging.info(f"Total calculation points: {total_points}")
    
    # 並列処理で計算実行
    chunk_size = max(1, total_points // (mp.cpu_count() * 2))
    chunks = [calculation_points[i:i + chunk_size] 
              for i in range(0, total_points, chunk_size)]
    
    results = []
    with ProcessPoolExecutor(max_workers=mp.cpu_count()) as executor:
        # 各チャンクを並列処理
        future_to_chunk = {
            executor.submit(
                process_chunk, 
                chunk, 
                source_pos.tolist(), 
                initial_db, 
                building_mesh.vertices.tolist(),
                building_mesh.faces.tolist()
            ): chunk for chunk in chunks
        }
        
        completed = 0
        for future in as_completed(future_to_chunk):
            try:
                chunk_results = future.result()
                results.extend(chunk_results)
                completed += len(chunk_results)
                
                progress = (completed / total_points) * 100
                if completed % 500 == 0 or completed == total_points:
                    logging.info(f"Progress: {completed}/{total_points} points ({progress:.1f}%) completed")
                    
            except Exception as e:
                logging.error(f"Chunk calculation failed: {e}")
    
    logging.info(f"Sound calculation completed: {len(results)} points processed")
    
    return {
        "results": results,
        "source_pos": source_pos.tolist(),
        "initial_db": initial_db,
        "grid_size": grid_size,
        "calc_range": calc_range,
        "points_processed": len(results)
    }

def process_chunk(points, source_pos, initial_db, mesh_vertices, mesh_faces):
    """チャンクの計算処理（プロセス間で実行）"""
    # メッシュを再構築
    vertices = np.array(mesh_vertices)
    faces = np.array(mesh_faces)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
    
    source_pos = np.array(source_pos)
    results = []
    
    for x, y, z, distance in points:
        target_pos = np.array([x, y, z])
        
        # 高速な音響計算
        final_db = calculate_fast_sound_attenuation(
            source_pos, target_pos, initial_db, mesh
        )
        
        results.append({
            "x": x,
            "y": y,
            "z": z,
            "db": final_db,
            "distance": distance
        })
    
    return results

def calculate_fast_sound_attenuation(source_pos, target_pos, initial_db, mesh):
    """高速な音の減衰計算"""
    distance = np.linalg.norm(target_pos - source_pos)
    if distance < 0.1:
        return initial_db
    
    # 距離による減衰
    distance_loss = 20 * np.log10(distance)
    
    # 建物による遮蔽（高速版）
    obstruction_loss = calculate_fast_obstruction(source_pos, target_pos, mesh)
    
    # 空気吸収（簡略版）
    air_absorption = distance * 0.001
    
    final_db = initial_db - distance_loss - obstruction_loss - air_absorption
    return max(final_db, 0)

def calculate_fast_obstruction(source_pos, target_pos, mesh):
    """高速な遮蔽計算"""
    try:
        direction = target_pos - source_pos
        distance = np.linalg.norm(direction)
        
        if distance < 1e-6:
            return 0
        
        ray_direction = direction / distance
        
        # レイキャスティング
        locations, _, _ = mesh.ray.intersects_location(
            ray_origins=[source_pos],
            ray_directions=[ray_direction]
        )
        
        # 有効な交点をカウント
        valid_intersections = 0
        for loc in locations:
            intersection_distance = np.linalg.norm(loc - source_pos)
            if 0.1 < intersection_distance < distance - 0.1:
                valid_intersections += 1
        
        # 遮蔽による損失（簡略版）
        if valid_intersections == 0:
            return 0
        elif valid_intersections <= 2:
            return 15  # 軽度の遮蔽
        elif valid_intersections <= 4:
            return 25  # 中程度の遮蔽
        else:
            return 35  # 重度の遮蔽
            
    except Exception:
        return 0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)