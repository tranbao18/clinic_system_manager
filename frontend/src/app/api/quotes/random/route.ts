import { NextResponse } from "next/server";

// TỰ VIẾT
export async function GET() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch("https://zenquotes.io/api/random", {
            cache: "no-store",
            signal: controller.signal,
            headers: {
                "Accept": "application/json",
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            return NextResponse.json({
                text: data[0].q || data[0].quote || data[0].text || "",
                author: data[0].a || data[0].author || "Unknown",
            });
        }

        if (data.content || data.quote) {
            return NextResponse.json({
                text: data.content || data.quote || "",
                author: data.author || data.authorName || "Unknown",
            });
        }

        throw new Error("Invalid API response format");
    } catch (error: any) {
        console.error("Error fetching quote from zenquotes.io:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch quote" },
            { status: 500 }
        );
    }
}
//