# 🔊 LiveEchoMap

**リアルタイム音響シミュレーション&視覚化システム**

LiveEchoMapは、3D都市モデルを使用した高精度な音響伝播シミュレーションを提供するWebアプリケーションです。建物による遮蔽効果、風の影響、距離減衰を考慮した現実的な音の伝播計算により、都市環境における音響環境を直感的に可視化できます。

## ✨ 主要機能

### 🏗️ 3D都市モデル表示
- Plateau（国土交通省提供）の高精度3D都市データを使用
- WebGL/Three.jsによる高性能レンダリング
- インタラクティブな3D環境での操作

### 🎵 高精度音響計算
- **距離減衰**: 段階的距離減衰モデル（1-100m, 100m-1km, 1km-5km毎に異なる減衰特性）
- **建物遮蔽**: レイキャスティングによる建物との交点計算に基づく遮蔽効果
- **風の影響**: 風向きと風速を考慮した音の屈折効果
- **空気吸収**: 長距離における空気による音の吸収

### 📊 リアルタイム可視化
- ヒートマップによる音圧レベル分布表示
- 3Dグリッド点による詳細な音響データ可視化
- 動的パラメータ調整（音量に応じたグリッドサイズ・計算範囲の最適化）

### 🌬️ 気象条件対応
- 風向き設定（0-359°、8方位表示）
- 風速設定（0-20m/s）
- 風による音波の屈折効果を物理的にモデル化

## 🏛️ システム構成

```
LiveEchoMap/
├── frontend/          # Next.js + React + Three.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── PlateauViewLike.tsx      # メイン3Dビューコンポーネント
│   │   │   ├── SoundCalculationEngineAPI.tsx  # 音響計算API連携
│   │   │   ├── SoundControlPanel.tsx    # コントロールパネル
│   │   │   └── HeatmapVisualization.tsx # ヒートマップ可視化
│   └── package.json
└── backend/           # Python FastAPI
    └── main.py        # 音響計算API（Trimesh + NumPy）
```

## 🚀 技術スタック

### フロントエンド
- **Next.js 14** - React フレームワーク
- **React 18** - UIライブラリ
- **Three.js** - 3Dグラフィックス
- **@react-three/fiber** - React Three.js統合
- **@react-three/drei** - Three.js用ユーティリティ
- **Leaflet** - 地図表示（ヒートマップ用）
- **TypeScript** - 型安全性

### バックエンド
- **FastAPI** - 高性能APIフレームワーク
- **NumPy** - 数値計算
- **Trimesh** - 3Dメッシュ処理・レイキャスティング
- **Python 3.8+**

## 🔬 音響計算アルゴリズム

### 1. 基本距離減衰
```python
# 段階的距離減衰モデル
if distance <= 100:
    distance_loss = 20 * (distance - 1) / 99      # 1-100m: 0-20dB
elif distance <= 1000:
    distance_loss = 20 + 20 * (distance - 100) / 900  # 100m-1km: 20-40dB
elif distance <= 5000:
    distance_loss = 40 + 20 * (distance - 1000) / 4000  # 1km-5km: 40-60dB
else:
    distance_loss = 60 + 10 * log10(distance / 5000)  # 5km以上: 対数減衰
```

### 2. 風の影響
```python
# 風による音波の屈折効果
wind_alignment = dot(sound_direction, wind_direction)
wind_effect = -wind_alignment * min(wind_speed * 2, 10) * distance_factor

# 風下: 音が地面に曲がり減衰少（負の値で増幅）
# 風上: 音が上空に曲がり減衰増（正の値で減衰）
```

### 3. 建物遮蔽
```python
# レイキャスティングによる遮蔽判定
intersections = mesh.ray.intersects_location(ray_origins, ray_directions)

# 交点数による遮蔽レベル分類
if intersections <= 2:  return 10dB  # 軽度遮蔽
elif intersections <= 4: return 18dB  # 中程度遮蔽  
else:                   return 25dB  # 重度遮蔽
```

### 4. 最終音量計算
```
最終dB = 初期dB - 距離減衰 - 建物遮蔽 - 空気吸収 + 風効果
```

## 🛠️ セットアップ

### 必要環境
- Node.js 18+ 
- Python 3.8+
- 3D都市モデルファイル（GLB形式）

### インストール

#### フロントエンド
```bash
cd frontend
npm install
npm run dev
```

#### バックエンド
```bash
cd backend
pip install fastapi uvicorn numpy trimesh
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3Dモデル配置
```
backend/models/bldg_Building.glb  # Plateau 3D都市モデル
```

## 🎮 使用方法

1. **音源配置**: 3D空間内をクリックして音源を配置
2. **パラメータ設定**: 
   - 音の強度（30-100dB）
   - 風向き（0-359°）
   - 風速（0-20m/s）
3. **計算実行**: 「音響計算を実行」ボタンでシミュレーション開始
4. **結果確認**: ヒートマップと3Dグリッドで音響分布を確認

## 📈 性能特性

### 計算パラメータの動的調整
- **100dB以上**: 計算範囲2km、グリッド50m
- **90-100dB**: 計算範囲1.5km、グリッド40m  
- **80-90dB**: 計算範囲1km、グリッド30m
- **70-80dB**: 計算範囲800m、グリッド25m
- **70dB未満**: 計算範囲500m、グリッド20m

### 処理性能
- 多核CPU並列処理対応
- リアルタイム進捗表示
- 大規模都市モデル（数万ポリゴン）対応

## 🌐 デプロイ

### 本番環境
- **フロントエンド**: Vercel / Netlify
- **バックエンド**: Render / Heroku
- **API URL**: 環境変数 `NEXT_PUBLIC_API_URL` で設定

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

プルリクエスト・Issue報告を歓迎します！

## 📚 参考資料

- [Plateau 3D都市モデル](https://www.mlit.go.jp/plateau/)
- [Three.js Documentation](https://threejs.org/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [音響学基礎理論](https://ja.wikipedia.org/wiki/音響学)