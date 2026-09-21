import type { Metadata } from "next";
import { Amiri, Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

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
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${amiri.variable}`}>
      <body className="font-ertaki">{children}</body>
    </html>
  );
}
