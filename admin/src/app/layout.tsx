import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ارتق — لوحة المشرف",
  description: "لوحة إدارة برنامج ارتق لمتابعة حفظ القرآن",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
