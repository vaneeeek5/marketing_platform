import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { ClientLayout } from "@/components/ClientLayout";

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
                    <ClientLayout>{children}</ClientLayout>
                    <Toaster position="top-right" closeButton />
                </ThemeProvider>
            </body>
        </html>
    );
}
