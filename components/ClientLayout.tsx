"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionProvider } from "next-auth/react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Check if we are on an auth page (login, etc)
    const isAuthPage = pathname?.startsWith("/login");

    return (
        <SessionProvider>
            {!isAuthPage ? (
                <div className="flex min-h-screen">
                    <Sidebar />
                    <main className="flex-1 lg:ml-64">
                        {/* Header */}
                        <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
                            <ThemeToggle />
                        </header>
                        <div className="p-6">{children}</div>
                    </main>
                </div>
            ) : (
                <div className="min-h-screen flex flex-col">
                    <div className="absolute right-4 top-4">
                        <ThemeToggle />
                    </div>
                    {children}
                </div>
            )}
        </SessionProvider>
    );
}
