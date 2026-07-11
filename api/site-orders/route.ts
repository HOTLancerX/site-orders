import { NextRequest, NextResponse } from "next/server";
import { getSiteOrdersCollection, initializeSiteOrdersCollection } from "@/plugin/site-orders/models/SiteOrder";
import { resolveUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/site-orders
 * Admin-only paginated list of site orders.
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
        const skip          = (page - 1) * limit;

        await initializeSiteOrdersCollection();
        const collection = await getSiteOrdersCollection();

        const query: Record<string, any> = {};

        if (statusFilter)  query.status        = statusFilter;
        if (paymentFilter) query.paymentStatus = paymentFilter;

        if (search) {
            query.$or = [
                { orderNumber:    { $regex: search, $options: "i" } },
                { customerName:   { $regex: search, $options: "i" } },
                { customerEmail:  { $regex: search, $options: "i" } },
                { customerPhone:  { $regex: search, $options: "i" } },
                { siteName:       { $regex: search, $options: "i" } },
            ];
        }

        const [orders, total] = await Promise.all([
            collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            collection.countDocuments(query),
        ]);

        return NextResponse.json({
            orders: orders.map((o) => ({ ...o, _id: o._id?.toString() })),
            total, page, limit,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("Site Orders GET error:", error);
        return NextResponse.json({ error: "Failed to fetch site orders" }, { status: 500 });
    }
}

/**
 * POST /api/site-orders
 * Create a new site order (admin only).
 */
export async function POST(req: NextRequest) {
    try {
        const caller = await resolveUser(req);
        if (!caller) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isAdmin = caller.userType === "admin" || caller.userType === "superadmin";
        if (!isAdmin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const {
            siteId, siteName, siteUrl,
            customerName, customerEmail, customerPhone,
            items, shippingAddress, shippingCost, total,
            status, paymentStatus, paymentMethod, notes,
        } = body;

        if (!customerName || !items?.length) {
            return NextResponse.json({ error: "Customer name and items are required" }, { status: 400 });
        }

        const { generateSiteOrderNumber } = await import("@/plugin/site-orders/models/SiteOrder");
        await initializeSiteOrdersCollection();
        const collection = await getSiteOrdersCollection();

        const now = new Date();
        const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

        const order = {
            orderNumber: generateSiteOrderNumber(),
            siteId:      siteId   ?? "",
            siteName:    siteName ?? "",
            siteUrl:     siteUrl  ?? "",
            customerName:  customerName  ?? "",
            customerEmail: customerEmail ?? "",
            customerPhone: customerPhone ?? "",
            items: items.map((item: any) => ({
                productTitle:   item.productTitle ?? "",
                productImage:   item.productImage ?? "",
                variantOptions: item.variantOptions ?? {},
                sku:            item.sku ?? "",
                price:          Number(item.price)    || 0,
                quantity:       Number(item.quantity) || 1,
                subtotal:       (Number(item.price) || 0) * (Number(item.quantity) || 1),
            })),
            shippingAddress: {
                name:    shippingAddress?.name    ?? customerName  ?? "",
                phone:   shippingAddress?.phone   ?? customerPhone ?? "",
                email:   shippingAddress?.email   ?? customerEmail ?? "",
                address: shippingAddress?.address ?? "",
                state:   shippingAddress?.state   ?? "",
                city:    shippingAddress?.city    ?? "",
                zipCode: shippingAddress?.zipCode ?? "",
            },
            shippingCost: Number(shippingCost) || 0,
            subtotal,
            total: Number(total) || subtotal + (Number(shippingCost) || 0),
            status:        status        ?? "pending",
            paymentStatus: paymentStatus ?? "pending",
            paymentMethod: paymentMethod ?? "",
            timeline: [{
                status:        status ?? "pending",
                note:          "Order created",
                createdBy:     caller.userId,
                createdByName: "Admin",
                createdAt:     now,
            }],
            notes:          notes ?? "",
            createdAt:      now,
            updatedAt:      now,
        };

        const result = await collection.insertOne(order as any);
        const created = await collection.findOne({ _id: result.insertedId });

        return NextResponse.json({ order: { ...created, _id: created?._id?.toString() } }, { status: 201 });
    } catch (error) {
        console.error("Site Orders POST error:", error);
        return NextResponse.json({ error: "Failed to create site order" }, { status: 500 });
    }
}
