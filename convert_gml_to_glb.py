import fiona
import pyvista as pv
import geopandas as gpd

# .gmlファイルのパスを指定
# ※ご自身の環境に合わせてパスを修正してください
gml_file_path = r'C:\Users\user\LiveEchoMap\14100_yokohama-shi_city_2024_citygml_1_op\udx\bldg\52397478_bldg_6697_op.gml'

# 出力するGLBファイルのパス
output_glb_path = './building.glb'

try:
    # GeoPandasで.gmlファイルを読み込み
    gdf = gpd.read_file(gml_file_path, driver='GML')
    
    # 建物ジオメトリを格納するPyVistaのメッシュを作成
    combined_mesh = pv.MultiBlock()

    for _, row in gdf.iterrows():
        geometry = row.geometry
        if geometry and geometry.has_z:
            # 頂点座標を抽出
            points = pv.PolyData(geometry.exterior.coords)
            # メッシュに変換して結合
            combined_mesh.append(points)

    if combined_mesh:
        # 結合したメッシュをGLBファイルとして保存
        combined_mesh.save(output_glb_path)
        print(f"変換が完了しました: {output_glb_path}")
    else:
        print("ファイルに有効な3Dジオメトリが含まれていません。")

except Exception as e:
    print(f"変換中にエラーが発生しました: {e}")