import dynamic from 'next/dynamic';

// PlateauViewLikeコンポーネントを動的にインポート
// SSR（Server-Side Rendering）を無効にしてクライアントサイドでのみ実行
// Three.jsはブラウザの環境でのみ動作するため、この設定が必要です
const PlateauViewLike = dynamic(
  () => import('../components/PlateauViewLike'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="bg-white rounded-lg p-8 shadow-lg text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-800 mb-2">PLATEAU 3Dビューア</div>
          <div className="text-sm text-gray-600">初期化中...</div>
        </div>
      </div>
    )
  }
);

export default function Home() {
  return (
    <PlateauViewLike modelUrl="/models/sinjuku" />
  );
}