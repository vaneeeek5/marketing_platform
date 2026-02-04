"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useSession, signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    TrendingUp,
    Menu,
    X,
    Wallet,
    LogOut,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

const iconMap = {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Wallet,
};

export function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();

    // Filter nav items based on role
    const filteredNavItems = NAV_ITEMS.filter(item => {
        if (item.href === "/settings") {
            return session?.user?.role === "admin";
        }
        return true;
    });

    return (
        <>
            {/* Mobile menu button */}
            <Button
                variant="ghost"
                size="icon"
                className="fixed top-4 left-4 z-50 lg:hidden"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
                    "bg-gradient-to-b from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900",
                    "border-r border-slate-700/50 flex flex-col justify-between",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div>
                    {/* Logo */}
                    <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700/50">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                            <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">БЫТЬ</h1>
                            <p className="text-xs text-slate-400">Маркетинговая платформа</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex flex-col gap-2 px-4 py-6">
                        {filteredNavItems.map((item) => {
                            // @ts-ignore
                            const Icon = iconMap[item.icon as keyof typeof iconMap] || FileText;
                            const isActive = pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                                        isActive
                                            ? "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white shadow-lg shadow-blue-500/10"
                                            : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                                    )}
                                >
                                    <Icon
                                        className={cn(
                                            "h-5 w-5",
                                            isActive ? "text-blue-400" : "text-slate-500"
                                        )}
                                    />
                                    {item.label}
                                    {isActive && (
                                        <div className="ml-auto h-2 w-2 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer / User Profile */}
                <div className="border-t border-slate-700/50 p-4">
                    <div className="rounded-xl bg-slate-800/50 p-4 mb-2">
                        <p className="text-sm font-medium text-white truncate">
                            {session?.user?.name || "Пользователь"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            {session?.user?.email || ""}
                        </p>
                        <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                {session?.user?.role === 'admin' ? 'Администратор' : 'Клиент'}
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-700/50"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Выйти
                    </Button>
                </div>
            </aside>
        </>
    );
}
