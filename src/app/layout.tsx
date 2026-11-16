import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://thefandex.vercel.app"),
  title: "Fandex: every season, every team, one scale",
  description:
    "Every NFL, NBA, MLB and NHL season since 1903, scored on one scale. Rank all 124 franchises and 49 cities over any era, and see how good your own teams have been since you were born.",
  openGraph: {
    title: "Fandex",
    description: "Every NFL, NBA, MLB and NHL season on one scale. Pick your teams and your years.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#131312" },
  ],
};

// Runs before first paint so the saved or system theme never flashes.
const themeScript = `try{var t=localStorage.getItem("fandex:theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
