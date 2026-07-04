import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { getTheme } from "@/lib/theme";
import "./globals.css";

/* Lufga (spec FocusFlow): tylko Light + Regular — hierarchia przez skalę,
   wersaliki i kolor, nie przez pogrubienie. Wagi 500-700 mapowane do Regular. */
const lufga = localFont({
  variable: "--font-lufga",
  src: [
    { path: "./fonts/Lufga-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Lufga-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Lufga-Regular.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Lufga-Regular.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Lufga-Regular.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

/* Plus Jakarta Sans to variable font — bez listy wag next/font bierze jeden
   plik z pełną osią wght zamiast 5 statycznych instancji per subset. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
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
      className={`${lufga.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
