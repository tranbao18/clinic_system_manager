// TỰ VIẾT
"use client"

import {
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Home, Settings } from "lucide-react"

export function AppSidebar() {
    const items = [
        { title: "Home", url: "/", icon: Home },
        { title: "Settings", url: "/settings", icon: Settings },
    ]

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <h1 className="px-2 font-bold">My App</h1>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <a href={item.url} className="flex items-center gap-2">
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <p className="px-2 text-xs text-muted-foreground">© 2025</p>
            </SidebarFooter>
        </Sidebar>
    )
}
