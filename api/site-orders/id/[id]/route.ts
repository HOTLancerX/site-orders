import { NextRequest, NextResponse } from "next/server";
import { findExternalOrderById } from "@/plugin/site-orders/models/SiteOrder";
import { resolveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/site-orders/id/:id — fetch by MongoDB _id from any external site */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
        }

        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const order = await findExternalOrderById(id);
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({ order });
    } catch (error) {
        console.error("Site Order by ID GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site order" }, { status: 500 });
    }
}
