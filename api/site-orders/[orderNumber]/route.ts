import { NextRequest, NextResponse } from "next/server";
import { findExternalOrderByNumber, updateExternalOrder } from "@/plugin/site-orders/models/SiteOrder";
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

        const order = await findExternalOrderByNumber(orderNumber);
        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({ order });
    } catch (error) {
        console.error("Site Order GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site order" }, { status: 500 });
    }
}

/** PUT /api/site-orders/:orderNumber — update status/payment in the external DB */
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

        const body = await req.json();
        const { status, paymentStatus, note } = body;

        // Find the order first to get its site index
        const existing = await findExternalOrderByNumber(orderNumber);
        if (!existing) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const now = new Date();
        const $set: Record<string, any> = { updatedAt: now };
        if (status)        $set.status        = status;
        if (paymentStatus) $set.paymentStatus = paymentStatus;

        const timelineEntry = {
            status:        status ?? existing.status,
            note:          note || `Status updated to ${status ?? existing.status}`,
            createdBy:     caller.userId,
            createdByName: "Admin",
            createdAt:     now,
        };

        // Determine where to update — local or external
        const isLocal = !existing.siteUrl || existing.siteUrl === "";

        if (isLocal) {
            // Update in local site_orders collection
            const { initializeSiteOrdersCollection, getSiteOrdersCollection } = await import("@/plugin/site-orders/models/SiteOrder");
            await initializeSiteOrdersCollection();
            const col = await getSiteOrdersCollection();
            await col.updateOne(
                { orderNumber },
                { $set, $push: { timeline: timelineEntry } } as any
            );
        } else {
            // Update in external DB
            const siteIndex = (existing as any)._siteIndex ?? 0;
            const pushUpdate = { $set: $set, $push: { timeline: timelineEntry } };
            await updateExternalOrder(orderNumber, pushUpdate, siteIndex);
        }

        // Re-fetch the updated order
        const updated = await findExternalOrderByNumber(orderNumber);
        return NextResponse.json({ order: updated });
    } catch (error) {
        console.error("Site Order PUT error:", error);
        return NextResponse.json({ error: "Failed to update site order" }, { status: 500 });
    }
}
