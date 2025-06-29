import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/features/conversation/session-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { SidebarProvider } from "@/components/features/sidebar/sidebar-context";
import { KnowledgeMapProvider } from "@/components/features/knowledge-map/knowledge-map-context";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Carson v2",
  description: "Next generation of Carson",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <SidebarProvider>
            <KnowledgeMapProvider>
              <SessionProvider>
                <ErrorBoundary>
                  <AppLayout>{children}</AppLayout>
                </ErrorBoundary>
              </SessionProvider>
            </KnowledgeMapProvider>
          </SidebarProvider>
          <Toaster 
            position="top-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
