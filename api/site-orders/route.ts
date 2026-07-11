import { NextRequest, NextResponse } from "next/server";
import { fetchAllExternalOrders, initializeSiteOrdersCollection, getSiteOrdersCollection } from "@/plugin/site-orders/models/SiteOrder";
import { resolveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/site-orders
 *
 * Fetches orders from ALL configured external MongoDB sites in parallel,
 * merges them, then applies search / filter / pagination in-memory.
 *
 * Also includes any locally-created orders from the site_orders collection.
 */
export async function GET(req: NextRequest) {
    try {
        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const statusFilter  = searchParams.get("status")        ?? "";
        const paymentFilter = searchParams.get("paymentStatus") ?? "";
        const search        = searchParams.get("search")        ?? "";
        const page          = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
        const limit         = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

        // Fetch from external sites + local collection
        const externalOrders = await fetchAllExternalOrders();

        // Also include local site_orders
        let localOrders: typeof externalOrders = [];
        try {
            await initializeSiteOrdersCollection();
            const localCol = await getSiteOrdersCollection();
            const docs = await localCol.find({}).sort({ createdAt: -1 }).limit(500).toArray();
            localOrders = docs.map((d) => ({ ...d, _id: d._id?.toString() ?? "" } as any));
        } catch { /* ignore */ }

        // Merge and sort
        const allOrders = [...externalOrders, ...localOrders].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Apply filters
        let filtered = allOrders;

        if (statusFilter) {
            filtered = filtered.filter((o) => o.status === statusFilter);
        }
        if (paymentFilter) {
            filtered = filtered.filter((o) => o.paymentStatus === paymentFilter);
        }
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(
                (o) =>
                    o.orderNumber.toLowerCase().includes(q) ||
                    o.customerName.toLowerCase().includes(q) ||
                    o.customerEmail.toLowerCase().includes(q) ||
                    o.customerPhone.toLowerCase().includes(q) ||
                    o.siteName.toLowerCase().includes(q)
            );
        }

        const total = filtered.length;
        const start = (page - 1) * limit;
        const orders = filtered.slice(start, start + limit);

        return NextResponse.json({
            orders,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Site Orders GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site orders" }, { status: 500 });
    }
}
