import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reflix — A Midnight Screening, Every Night",
  description:
    "Reflix is a curated streaming home for cinema. Watch hand-picked films in a projection-booth atmosphere.",
  keywords: ["Reflix", "streaming", "cinema", "films", "movies", "watch"],
  authors: [{ name: "Reflix" }],
  openGraph: {
    title: "Reflix",
    description: "A curated streaming home for cinema.",
    siteName: "Reflix",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reflix",
    description: "A curated streaming home for cinema.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrumentSerif.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
