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

# ログの設定（デプロイ環境対応）
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.StreamHandler(sys.stderr)
    ]
)

# FastAPIアプリケーション
app = FastAPI()


origins = [
    "http://localhost",
    "http://localhost:3000",
    "https://liveechomap.onrender.com",
    "https://liveechomap.onrender.com/"
]

# CORS設定（より寛容な設定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 全てのオリジンを許可（本番では制限を推奨）
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
        "models/bldg_Building.glb",
        "./models/bldg_Building.glb",
        # "../frontend/public/models/sinjuku/bldg_Building.glb", 
        # "./frontend/public/models/sinjuku/bldg_Building.glb",
        # "bldg_Building.glb",
        "./bldg_Building.glb"
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
                logging.info(f"✅ Model loaded successfully: {model_info['vertices']} vertices, {model_info['faces']} faces from {file_path}")
                break
                
        except Exception as e:
            logging.error(f"Failed to load {file_path}: {e}")
            continue
    
    if building_mesh is None:
        logging.error("❌ CRITICAL: No valid model could be loaded from any path!")
        logging.error("Searching in all possible directories...")
        try:
            current_dir = os.getcwd()
            logging.info(f"📂 Current directory: {current_dir}")
            
            # すべての可能なディレクトリを再帰的に検索してGLBを自動読み込み
            found_glb_paths = []
            
            def find_and_try_load_glb(directory, max_depth=3, current_depth=0):
                if current_depth > max_depth:
                    return
                try:
                    files = os.listdir(directory)
                    logging.info(f"📁 Checking directory: {directory}")
                    logging.info(f"   Files: {files}")
                    
                    for file in files:
                        file_path = os.path.join(directory, file)
                        if file.endswith(".glb"):
                            logging.info(f"✅ Found GLB: {file_path}")
                            found_glb_paths.append(file_path)
                            
                            # 見つけたGLBファイルで読み込み試行
                            if try_load_glb_file(file_path):
                                return True
                                
                        elif os.path.isdir(file_path) and not file.startswith('.'):
                            if find_and_try_load_glb(file_path, max_depth, current_depth + 1):
                                return True
                except Exception as e:
                    logging.warning(f"Cannot access {directory}: {e}")
                return False
            
            # GLBファイルを探して自動読み込み
            if find_and_try_load_glb("."):
                logging.info("🎉 Building model loaded successfully from auto-discovery!")
            elif find_and_try_load_glb(".."):
                logging.info("🎉 Building model loaded successfully from parent directory!")
            else:
                logging.error(f"❌ No loadable GLB found. Discovered paths: {found_glb_paths}")
                
        except Exception as e:
            logging.error(f"Error during comprehensive search: {e}")
        
        if building_mesh is None:
            model_info["loaded"] = False

def try_load_glb_file(file_path):
    """GLBファイルの読み込みを試行する共通関数"""
    global building_mesh, model_info
    try:
        logging.info(f"🔄 Attempting to load: {file_path}")
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
            
            # モデルの健全性チェック
            is_watertight = building_mesh.is_watertight
            volume = building_mesh.volume if is_watertight else "N/A"
            bounds = building_mesh.bounds
            center = bounds.mean(axis=0)
            size = bounds[1] - bounds[0]
            
            model_info.update({
                "vertices": len(building_mesh.vertices),
                "faces": len(building_mesh.faces),
                "bounds": bounds.tolist(),
                "center": center.tolist(),
                "size": size.tolist(),
                "is_watertight": is_watertight,
                "volume": float(volume) if volume != "N/A" else None,
                "loaded": True
            })
            
            print(f"✅ Model loaded: {model_info['vertices']} vertices, {model_info['faces']} faces from {file_path}")
            print(f"🏗️ Model health check:")
            print(f"   📐 Bounds: min=({bounds[0][0]:.1f},{bounds[0][1]:.1f},{bounds[0][2]:.1f}) max=({bounds[1][0]:.1f},{bounds[1][1]:.1f},{bounds[1][2]:.1f})")
            print(f"   📍 Center: ({center[0]:.1f},{center[1]:.1f},{center[2]:.1f})")
            print(f"   📏 Size: ({size[0]:.1f}×{size[1]:.1f}×{size[2]:.1f})")
            print(f"   🔧 Watertight: {is_watertight}, Volume: {volume}")
            
            # レイキャスティング機能のテスト
            try:
                test_ray = building_mesh.ray.intersects_location(
                    ray_origins=[[0, 0, 0]],
                    ray_directions=[[1, 0, 0]]
                )
                print(f"   🎯 Ray casting test: SUCCESS")
            except Exception as e:
                print(f"   ❌ Ray casting test: FAILED - {e}")
                
            logging.info(f"✅ Model loaded: {model_info['vertices']} vertices, {model_info['faces']} faces from {file_path}")
            logging.info(f"🏗️ Model health check:")
            logging.info(f"   📐 Bounds: min=({bounds[0][0]:.1f},{bounds[0][1]:.1f},{bounds[0][2]:.1f}) max=({bounds[1][0]:.1f},{bounds[1][1]:.1f},{bounds[1][2]:.1f})")
            logging.info(f"   📍 Center: ({center[0]:.1f},{center[1]:.1f},{center[2]:.1f})")
            logging.info(f"   📏 Size: ({size[0]:.1f}×{size[1]:.1f}×{size[2]:.1f})")
            logging.info(f"   🔧 Watertight: {is_watertight}, Volume: {volume}")
            
            # 座標系の妥当性チェック
            if abs(center[0]) > 10000 or abs(center[1]) > 1000 or abs(center[2]) > 10000:
                logging.warning(f"⚠️ Model coordinates seem unusual - check coordinate system")
            
            return True
    except Exception as e:
        logging.warning(f"Failed to load {file_path}: {e}")
    return False

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
        logging.error("❌ Building model not loaded! Using fallback calculation without obstruction.")
        # フォールバック：建物なしで計算を継続
        building_mesh_fallback = None
    else:
        building_mesh_fallback = building_mesh

    source_pos = np.array(request.source_pos, dtype=np.float64)
    initial_db = request.initial_db
    grid_size = request.grid_size
    calc_range = request.calc_range
    
    # 座標系と計算範囲の詳細ログ
    print(f"🎵 Sound calculation started:")
    print(f"   🎯 Source position: ({source_pos[0]:.1f},{source_pos[1]:.1f},{source_pos[2]:.1f})")
    print(f"   🔊 Initial dB: {initial_db}, Grid: {grid_size}m, Range: {calc_range}m")
    logging.info(f"🎵 Sound calculation started:")
    logging.info(f"   🎯 Source position: ({source_pos[0]:.1f},{source_pos[1]:.1f},{source_pos[2]:.1f})")
    logging.info(f"   🔊 Initial dB: {initial_db}, Grid: {grid_size}m, Range: {calc_range}m")
    
    # 建物との位置関係チェック
    if building_mesh_fallback is not None:
        model_center = np.array(model_info.get("center", [0, 0, 0]))
        model_bounds = np.array(model_info.get("bounds", [[0, 0, 0], [0, 0, 0]]))
        distance_to_center = np.linalg.norm(source_pos - model_center)
        
        # 音源が建物範囲内にあるかチェック
        in_bounds = all(model_bounds[0] <= source_pos) and all(source_pos <= model_bounds[1])
        
        print(f"   🏢 Model center: ({model_center[0]:.1f},{model_center[1]:.1f},{model_center[2]:.1f})")
        print(f"   📏 Distance to model center: {distance_to_center:.1f}m")
        print(f"   🎯 Source in bounds: {in_bounds}")
        
        # 計算グリッドと建物の重複チェック
        calc_bounds = [
            source_pos - calc_range,
            source_pos + calc_range
        ]
        grid_overlaps_model = not (
            np.all(calc_bounds[1] < model_bounds[0]) or 
            np.all(calc_bounds[0] > model_bounds[1])
        )
        
        print(f"   🗂️ Calc grid bounds: min=({calc_bounds[0][0]:.1f},{calc_bounds[0][1]:.1f},{calc_bounds[0][2]:.1f}) max=({calc_bounds[1][0]:.1f},{calc_bounds[1][1]:.1f},{calc_bounds[1][2]:.1f})")
        print(f"   🔗 Grid overlaps model: {grid_overlaps_model}")
        
        if not grid_overlaps_model:
            print("⚠️ WARNING: Calculation grid does not overlap with building model!")
            
        logging.info(f"   🏢 Model center: ({model_center[0]:.1f},{model_center[1]:.1f},{model_center[2]:.1f})")
        logging.info(f"   📏 Distance to model center: {distance_to_center:.1f}m")
        logging.info(f"   🎯 Source in bounds: {in_bounds}")
        logging.info(f"   🗂️ Calc grid bounds: min=({calc_bounds[0][0]:.1f},{calc_bounds[0][1]:.1f},{calc_bounds[0][2]:.1f}) max=({calc_bounds[1][0]:.1f},{calc_bounds[1][1]:.1f},{calc_bounds[1][2]:.1f})")
        logging.info(f"   🔗 Grid overlaps model: {grid_overlaps_model}")
        
        if not grid_overlaps_model:
            logging.warning("⚠️ Calculation grid does not overlap with building model - no obstruction will be detected!")
    
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
                building_mesh_fallback.vertices.tolist() if building_mesh_fallback is not None else [],
                building_mesh_fallback.faces.tolist() if building_mesh_fallback is not None else []
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
    # メッシュを再構築（建物モデルがある場合のみ）
    mesh = None
    if mesh_vertices and mesh_faces:
        vertices = np.array(mesh_vertices)
        faces = np.array(mesh_faces)
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
    
    source_pos = np.array(source_pos)
    results = []
    
    for x, y, z, distance in points:
        target_pos = np.array([x, y, z])
        
        # 建物モデルの有無で計算方法を分岐
        if mesh is not None:
            # 建物遮蔽ありの計算
            final_db = calculate_fast_sound_attenuation(source_pos, target_pos, initial_db, mesh)
        else:
            # 建物遮蔽なしの計算（距離減衰のみ）
            final_db = calculate_distance_only_attenuation(source_pos, target_pos, initial_db)
        
        results.append({
            "x": x,
            "y": y,
            "z": z,
            "db": final_db,
            "distance": distance
        })
    
    return results

def calculate_distance_only_attenuation(source_pos, target_pos, initial_db):
    """建物モデルなしの場合の距離減衰のみの計算"""
    distance = np.linalg.norm(target_pos - source_pos)
    if distance < 0.1:
        return initial_db
    
    # 基本的な距離減衰のみ
    distance_loss = 20 * np.log10(distance)
    air_absorption = distance * 0.001
    
    final_db = initial_db - distance_loss - air_absorption
    return max(final_db, 0)

def calculate_fast_sound_attenuation(source_pos, target_pos, initial_db, mesh):
    """高速な音の減衰計算（デバッグ強化版）"""
    distance = np.linalg.norm(target_pos - source_pos)
    if distance < 0.1:
        return initial_db
    
    # 距離による減衰
    distance_loss = 20 * np.log10(distance)
    
    # 建物による遮蔽（高速版）
    obstruction_loss = calculate_fast_obstruction(source_pos, target_pos, mesh)
    
    # デバッグ用ログ（一部の計算でのみ出力）
    if np.random.random() < 0.01:  # 1%の確率でログ出力
        logging.info(f"🔍 Sound calc: src=({source_pos[0]:.1f},{source_pos[1]:.1f},{source_pos[2]:.1f}) -> tgt=({target_pos[0]:.1f},{target_pos[1]:.1f},{target_pos[2]:.1f})")
        logging.info(f"🔍 distance={distance:.1f}m, distance_loss={distance_loss:.1f}dB, obstruction_loss={obstruction_loss:.1f}dB")
    
    # 空気吸収（簡略版）
    air_absorption = distance * 0.001
    
    final_db = initial_db - distance_loss - obstruction_loss - air_absorption
    return max(final_db, 0)

def calculate_fast_obstruction(source_pos, target_pos, mesh):
    """高速な遮蔽計算（デバッグ強化版）"""
    try:
        direction = target_pos - source_pos
        distance = np.linalg.norm(direction)
        
        if distance < 1e-6:
            return 0
        
        ray_direction = direction / distance
        
        # レイキャスティング
        try:
            locations, _, _ = mesh.ray.intersects_location(
                ray_origins=[source_pos],
                ray_directions=[ray_direction]
            )
        except Exception as ray_error:
            if np.random.random() < 0.01:
                print(f"❌ Ray casting failed: {ray_error}")
            return 0
        
        # 有効な交点をカウント
        valid_intersections = 0
        intersection_distances = []
        for loc in locations:
            intersection_distance = np.linalg.norm(loc - source_pos)
            if 0.1 < intersection_distance < distance - 0.1:
                valid_intersections += 1
                intersection_distances.append(intersection_distance)
        
        # デバッグ用ログ（一部の計算でのみ出力）
        if np.random.random() < 0.05:  # 5%の確率でログ出力
            print(f"🏢 Ray debug: total_hits={len(locations)}, valid_intersections={valid_intersections}")
            print(f"🏢 All intersection distances: {[np.linalg.norm(loc - source_pos) for loc in locations]}")
            print(f"🏢 Target distance: {distance:.1f}m")
            logging.info(f"🏢 Ray: src=({source_pos[0]:.1f},{source_pos[1]:.1f},{source_pos[2]:.1f}) dir=({ray_direction[0]:.2f},{ray_direction[1]:.2f},{ray_direction[2]:.2f})")
            logging.info(f"🏢 Intersections: {valid_intersections}, distances={intersection_distances[:3]}, total_hits={len(locations)}")
        
        # 遮蔽による損失（簡略版）
        if valid_intersections == 0:
            return 0
        elif valid_intersections <= 2:
            return 15  # 軽度の遮蔽
        elif valid_intersections <= 4:
            return 25  # 中程度の遮蔽
        else:
            return 35  # 重度の遮蔽
            
    except Exception as e:
        # エラーログを出力
        if np.random.random() < 0.001:
            logging.warning(f"⚠️ Obstruction calc error: {e}")
        return 0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)