import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PLATEAU 3D都市モデル ビューア',
  description: 'PLATEAU 3D都市モデルをThree.jsで可視化するサンプル',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-900">
        {children}
      </body>
    </html>
  );
}