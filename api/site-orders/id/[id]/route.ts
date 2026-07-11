import { NextRequest, NextResponse } from "next/server";
import { getSiteOrdersCollection, initializeSiteOrdersCollection } from "@/plugin/site-orders/models/SiteOrder";
import { resolveUser } from "@/lib/session";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/** GET /api/site-orders/id/:id — fetch by MongoDB _id, admin only */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id || !mongoose.isValidObjectId(id)) {
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

        await initializeSiteOrdersCollection();
        const collection = await getSiteOrdersCollection();

        const order = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error("Site Order by ID GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site order" }, { status: 500 });
    }
}
