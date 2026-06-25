// TỰ VIẾT
"use client";

import Navbar from "@/components/layout/Navbar";
import Header from "@/components/layout/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex">
            <Navbar />

            <div className="flex flex-1 flex-col">
                <Header />

                <main className="flex-1 overflow-y-auto bg-gray-50">
                    {children}
                </main>
            </div>
        </div>
    );
}
