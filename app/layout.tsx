import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = localFont({
  src: [
    { path: "../public/fonts/GeistVF.woff2", style: "normal" },
  ],
  variable: "--font-geist-sans",
  fallback: ["system-ui", "sans-serif"],
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../public/fonts/GeistMonoVF.woff2", style: "normal" },
  ],
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "monospace"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verso — Zarządzanie turniejami",
  description: "Nowoczesna platforma do tworzenia i zarządzania turniejami sportowymi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>
            <TooltipProvider>
              {children}
              <Toaster
                position="bottom-right"
                theme="dark"
                toastOptions={{
                  style: {
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                  },
                }}
              />
            </TooltipProvider>
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
