import type { Metadata } from "next";
import { Press_Start_2P, Silkscreen, VT323 } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Shortcuts } from "@/components/shortcuts";

const press = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-press" });
const vt = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt" });
const silk = Silkscreen({ weight: "400", subsets: ["latin"], variable: "--font-silk" });

export const metadata: Metadata = {
  title: "Quest Log",
  description: "A 1-bit tracker for internships, research, fellowships and every other student opportunity.",
};

export const dynamic = "force-dynamic";

// Apply the saved theme before paint so there's no flash.
const themeInit = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${press.variable} ${vt.variable} ${silk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <div className="shell">
          <Nav />
          <main id="main">{children}</main>
        </div>
        <Shortcuts />
      </body>
    </html>
  );
}
