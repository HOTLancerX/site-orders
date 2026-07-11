import { NextRequest, NextResponse } from "next/server";
import { getSiteOrdersCollection, initializeSiteOrdersCollection } from "@/plugin/site-orders/models/SiteOrder";
import { resolveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/site-orders/:orderNumber */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;
        if (!orderNumber) {
            return NextResponse.json({ error: "Order number required" }, { status: 400 });
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

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({ order: { ...order, _id: order._id?.toString() } });
    } catch (error) {
        console.error("Site Order GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site order" }, { status: 500 });
    }
}

/** PUT /api/site-orders/:orderNumber — admin only */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ orderNumber: string }> }
) {
    try {
        const { orderNumber } = await params;

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

        const order = await collection.findOne({ orderNumber });
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const body = await req.json();
        const { status, paymentStatus, note } = body;

        const now = new Date();
        const $set: Record<string, any> = { updatedAt: now };
        if (status)        $set.status        = status;
        if (paymentStatus) $set.paymentStatus = paymentStatus;

        const timelineEntry = {
            status:        status ?? order.status,
            note:          note || `Status updated to ${status ?? order.status}`,
            createdBy:     caller.userId,
            createdByName: "Admin",
            createdAt:     now,
        };

        await collection.updateOne(
            { orderNumber },
            { $set, $push: { timeline: timelineEntry } } as any
        );

        const updated = await collection.findOne({ orderNumber });
        return NextResponse.json({ order: { ...updated, _id: updated?._id?.toString() } });
    } catch (error) {
        console.error("Site Order PUT error:", error);
        return NextResponse.json({ error: "Failed to update site order" }, { status: 500 });
    }
}
