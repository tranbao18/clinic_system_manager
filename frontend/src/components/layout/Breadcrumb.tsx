// TỰ VIẾT
import Link from "next/link"
import { SlashIcon } from "lucide-react"
import { usePathname } from "next/navigation"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const breadcrumbNameMap: Record<string, string> = {
    "/": "Home",
    "/patients": "Patients",
    "/doctors": "Doctors",
    "/nurse": "Nurse",
    "/room": "Room",
    "/concern": "Concern",
}

export function BreadcrumbWithCustomSeparator() {

    const pathname = usePathname()

    const pathSegments = pathname.split("/").filter(Boolean)

    const crumbs = pathSegments.map((segment, index) => {
        const href = "/" + pathSegments.slice(0, index + 1).join("/")
        return {
            href,
            label: breadcrumbNameMap[href] || segment, // fallback: segment nếu chưa map
        }
    })

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/">Dashboard</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((crumb, i) => (
                    <div key={crumb.href} className="flex items-center">
                        <BreadcrumbSeparator>
                            <SlashIcon />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem>
                            {i === crumbs.length - 1 ? (
                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link href={crumb.href}>{crumb.label}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </div>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
