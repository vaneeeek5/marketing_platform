import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
    title: "Маркетинговая аналитика | Платформа",
    description: "Аналитическая платформа для маркетинговых кампаний Яндекс.Директ",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ru" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <div className="flex min-h-screen">
                        <Sidebar />
                        <main className="flex-1 lg:ml-64">
                            {/* Header */}
                            <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
                                <ThemeToggle />
                            </header>
                            {/* Content */}
                            <div className="p-6">{children}</div>
                        </main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
