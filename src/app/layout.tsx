import type { Metadata } from "next";
import "./globals.css";
import "react-image-crop/dist/ReactCrop.css";

export const metadata: Metadata = {
  title: "Image Crop Preview",
  description: "Upload and preview images with crop functionality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

