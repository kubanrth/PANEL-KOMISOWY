import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { getTheme } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kickback — Panel Komisowy",
  description:
    "Sprzedaj swoje rzeczy w modelu konsygnacji. Weryfikujemy, sprzedajemy, wypłacamy. Wszystko w jednym panelu.",
  metadataBase: new URL("https://panel.kickback.pl"),
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await getTheme();
  return (
    <html
      lang="pl"
      data-theme={theme}
      style={{ colorScheme: theme }}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
