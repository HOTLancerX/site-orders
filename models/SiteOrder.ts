import { ObjectId, Collection, MongoClient, Db } from "mongodb";
import { getCollection } from "@/lib/mongodb";

export interface SiteOrderItem {
    productTitle: string;
    productImage?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    subtotal: number;
}

export interface SiteOrderShippingAddress {
    name: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    city: string;
    zipCode?: string;
}

export interface SiteOrderTimeline {
    status: string;
    note: string;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
}

export interface SiteOrder {
    _id?: ObjectId;
    orderNumber: string;
    siteId: string;
    siteName: string;
    siteUrl: string;
    siteLogo: string;

    customerName: string;
    customerEmail: string;
    customerPhone: string;

    items: SiteOrderItem[];
    shippingAddress: SiteOrderShippingAddress;

    subtotal: number;
    shippingCost: number;
    total: number;

    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    paymentStatus: "pending" | "paid" | "failed" | "refunded";
    paymentMethod?: string;

    timeline: SiteOrderTimeline[];
    metadata?: { ipAddress?: string; userAgent?: string; device?: string; browser?: string; os?: string };
    notes?: string;

    createdAt: Date;
    updatedAt: Date;
}

/** Normalised order shape returned by fetchExternalOrders — matches SiteOrder but _id is always string. */
export type NormalisedOrder = Omit<SiteOrder, "_id"> & { _id: string };

export const COLLECTION_NAME = "site_orders";

export async function getSiteOrdersCollection(): Promise<Collection<SiteOrder>> {
    return getCollection<SiteOrder>(COLLECTION_NAME);
}

let indexesCreated = false;
export async function initializeSiteOrdersCollection() {
    if (indexesCreated) return;
    try {
        const collection = await getSiteOrdersCollection();
        let existingIndexes;
        try {
            existingIndexes = await collection.indexes();
        } catch (error: any) {
            if (error.code === 26 || error.codeName === "NamespaceNotFound") {
                indexesCreated = true;
                return;
            }
            throw error;
        }
        const indexNames = existingIndexes.map((idx) => idx.name);
        if (!indexNames.includes("orderNumber_1")) {
            await collection.createIndex({ orderNumber: 1 }, { unique: true });
            await collection.createIndex({ siteId: 1 });
            await collection.createIndex({ status: 1 });
            await collection.createIndex({ createdAt: -1 });
        }
        indexesCreated = true;
    } catch (error) {
        console.error("Error creating site_orders indexes:", error);
    }
}

export function generateSiteOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SORD-${timestamp}-${random}`;
}

// ─── External MongoDB helpers ─────────────────────────────────────────────────

interface SiteConfig {
    _id?: string;
    name: string;
    logo: string;
    mangaDbUrl: string;
    status: "active" | "inactive";
}

/**
 * Read site configs from the local settings collection.
 * Settings are stored as JSON string under the key "site_orders_sites".
 */
export async function getSiteConfigs(): Promise<SiteConfig[]> {
    try {
        const settingsCol = await getCollection<{ title: string; content: string }>("settings");
        const doc = await settingsCol.findOne({ title: "site_orders_sites" });
        if (!doc?.content) return [];
        return JSON.parse(doc.content);
    } catch {
        return [];
    }
}

/**
 * Connection pool cache — keyed by MongoDB URI.
 * We reuse connections across requests to avoid exhausting connection limits.
 */
const _connectionPool = new Map<string, Promise<MongoClient>>();

function getClient(uri: string): Promise<MongoClient> {
    if (_connectionPool.has(uri)) return _connectionPool.get(uri)!;
    const client = new MongoClient(uri, {
        maxPoolSize: 5,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
    });
    const promise = client.connect();
    _connectionPool.set(uri, promise);
    return promise;
}

/**
 * Fetch orders from a single external MongoDB database.
 * Assumes the external DB uses the same `orders` collection shape as the
 * product plugin's Order model.
 */
async function fetchFromExternalSite(
    site: SiteConfig
): Promise<NormalisedOrder[]> {
    try {
        const client = await getClient(site.mangaDbUrl);
        // Parse DB name from the connection URI
        const urlObj = new URL(site.mangaDbUrl);
        const dbName = urlObj.pathname.replace(/^\//, "").split("?")[0] || "cms";
        const db: Db = client.db(dbName);
        const ordersCol = db.collection("orders");

        const docs = await ordersCol
            .find({})
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray();

        return docs.map((doc) => {
            const addr = (doc as any).shippingAddress ?? {};
            const items = ((doc as any).items ?? []).map((item: any) => ({
                productTitle:   item.productTitle   ?? item.product_title ?? "",
                productImage:   item.productImage   ?? item.product_image ?? "",
                variantOptions: item.variantOptions  ?? {},
                sku:            item.sku             ?? "",
                price:          Number(item.price)   || 0,
                quantity:       Number(item.quantity) || 1,
                subtotal:       Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
            }));

            const subtotal = items.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);

            return {
                _id:           doc._id?.toString() ?? "",
                orderNumber:   (doc as any).orderNumber ?? `EXT-${doc._id?.toString()?.slice(-8)}`,
                siteId:        site._id ?? site.name,
                siteName:      site.name,
                siteUrl:       site.mangaDbUrl,
                siteLogo:      site.logo ?? "",
                customerName:  (doc as any).shippingAddress?.name  ?? (doc as any).userEmail ?? "",
                customerEmail: (doc as any).userEmail ?? addr.email ?? "",
                customerPhone: addr.phone ?? "",
                items,
                shippingAddress: {
                    name:    addr.name    ?? "",
                    phone:   addr.phone   ?? "",
                    email:   addr.email   ?? "",
                    address: addr.address ?? "",
                    state:   addr.state   ?? "",
                    city:    addr.city    ?? "",
                    zipCode: addr.zipCode ?? "",
                },
                shippingCost: Number((doc as any).shippingCost) || 0,
                subtotal,
                total:         Number((doc as any).total) || subtotal,
                status:        (doc as any).status        ?? "pending",
                paymentStatus: (doc as any).paymentStatus ?? "pending",
                paymentMethod: (doc as any).paymentMethod ?? "",
                timeline:      ((doc as any).timeline ?? []).map((t: any) => ({
                    status:        t.status        ?? "",
                    note:          t.note          ?? "",
                    createdBy:     t.createdBy     ?? "",
                    createdByName: t.createdByName ?? "",
                    createdAt:     t.createdAt     ?? new Date(),
                })),
                metadata: (doc as any).metadata ?? undefined,
                notes:     (doc as any).notes ?? "",
                createdAt: (doc as any).createdAt ?? new Date(),
                updatedAt: (doc as any).updatedAt ?? new Date(),
            } as NormalisedOrder;
        });
    } catch (error) {
        console.error(`Failed to fetch orders from site "${site.name}":`, error);
        return [];
    }
}

/**
 * Fetch orders from ALL active external sites in parallel.
 * Returns a merged, sorted array.
 */
export async function fetchAllExternalOrders(): Promise<NormalisedOrder[]> {
    const sites = await getSiteConfigs();
    const activeSites = sites.filter((s) => s.status === "active" && s.mangaDbUrl);
    if (activeSites.length === 0) return [];

    const results = await Promise.all(activeSites.map(fetchFromExternalSite));
    const all = results.flat();
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all;
}

/**
 * Find a single order by _id across all external sites.
 * Also checks local site_orders collection.
 */
export async function findExternalOrderById(id: string): Promise<NormalisedOrder | null> {
    // Check local collection first
    try {
        await initializeSiteOrdersCollection();
        const localCol = await getSiteOrdersCollection();
        if (ObjectId.isValid(id)) {
            const local = await localCol.findOne({ _id: new ObjectId(id) });
            if (local) {
                return { ...local, _id: local._id?.toString() ?? "" } as NormalisedOrder;
            }
        }
    } catch { /* ignore */ }

    // Check external sites
    const sites = await getSiteConfigs();
    const activeSites = sites.filter((s) => s.status === "active" && s.mangaDbUrl);

    for (const site of activeSites) {
        try {
            const client = await getClient(site.mangaDbUrl);
            const urlObj = new URL(site.mangaDbUrl);
            const dbName = urlObj.pathname.replace(/^\//, "").split("?")[0] || "cms";
            const db = client.db(dbName);
            const ordersCol = db.collection("orders");

            if (!ObjectId.isValid(id)) continue;
            const doc = await ordersCol.findOne({ _id: new ObjectId(id) });
            if (doc) {
                const addr = (doc as any).shippingAddress ?? {};
                const items = ((doc as any).items ?? []).map((item: any) => ({
                    productTitle:   item.productTitle   ?? item.product_title ?? "",
                    productImage:   item.productImage   ?? item.product_image ?? "",
                    variantOptions: item.variantOptions  ?? {},
                    sku:            item.sku             ?? "",
                    price:          Number(item.price)   || 0,
                    quantity:       Number(item.quantity) || 1,
                    subtotal:       Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
                }));
                const subtotal = items.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);

                return {
                    _id:           doc._id?.toString() ?? "",
                    orderNumber:   (doc as any).orderNumber ?? `EXT-${doc._id?.toString()?.slice(-8)}`,
                    siteId:        site._id ?? site.name,
                    siteName:      site.name,
                    siteUrl:       site.mangaDbUrl,
                    siteLogo:      site.logo ?? "",
                    customerName:  addr.name  ?? (doc as any).userEmail ?? "",
                    customerEmail: (doc as any).userEmail ?? addr.email ?? "",
                    customerPhone: addr.phone ?? "",
                    items,
                    shippingAddress: {
                        name:    addr.name    ?? "",
                        phone:   addr.phone   ?? "",
                        email:   addr.email   ?? "",
                        address: addr.address ?? "",
                        state:   addr.state   ?? "",
                        city:    addr.city    ?? "",
                        zipCode: addr.zipCode ?? "",
                    },
                    shippingCost: Number((doc as any).shippingCost) || 0,
                    subtotal,
                    total:         Number((doc as any).total) || subtotal,
                    status:        (doc as any).status        ?? "pending",
                    paymentStatus: (doc as any).paymentStatus ?? "pending",
                    paymentMethod: (doc as any).paymentMethod ?? "",
                    timeline:      ((doc as any).timeline ?? []).map((t: any) => ({
                        status:        t.status        ?? "",
                        note:          t.note          ?? "",
                        createdBy:     t.createdBy     ?? "",
                        createdByName: t.createdByName ?? "",
                        createdAt:     t.createdAt     ?? new Date(),
                    })),
                    metadata: (doc as any).metadata ?? undefined,
                    notes:     (doc as any).notes ?? "",
                    createdAt: (doc as any).createdAt ?? new Date(),
                    updatedAt: (doc as any).updatedAt ?? new Date(),
                } as NormalisedOrder;
            }
        } catch { /* continue to next site */ }
    }

    return null;
}

/**
 * Find a single order by orderNumber across all external sites.
 */
export async function findExternalOrderByNumber(orderNumber: string): Promise<NormalisedOrder & { _siteIndex?: number } | null> {
    // Check local first
    try {
        await initializeSiteOrdersCollection();
        const localCol = await getSiteOrdersCollection();
        const local = await localCol.findOne({ orderNumber });
        if (local) return { ...local, _id: local._id?.toString() ?? "" } as NormalisedOrder;
    } catch { /* ignore */ }

    const sites = await getSiteConfigs();
    const activeSites = sites.filter((s) => s.status === "active" && s.mangaDbUrl);

    for (let i = 0; i < activeSites.length; i++) {
        const site = activeSites[i];
        try {
            const client = await getClient(site.mangaDbUrl);
            const urlObj = new URL(site.mangaDbUrl);
            const dbName = urlObj.pathname.replace(/^\//, "").split("?")[0] || "cms";
            const db = client.db(dbName);
            const ordersCol = db.collection("orders");

            const doc = await ordersCol.findOne({ orderNumber });
            if (doc) {
                const addr = (doc as any).shippingAddress ?? {};
                const items = ((doc as any).items ?? []).map((item: any) => ({
                    productTitle:   item.productTitle   ?? item.product_title ?? "",
                    productImage:   item.productImage   ?? item.product_image ?? "",
                    variantOptions: item.variantOptions  ?? {},
                    sku:            item.sku             ?? "",
                    price:          Number(item.price)   || 0,
                    quantity:       Number(item.quantity) || 1,
                    subtotal:       Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
                }));
                const subtotal = items.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);

                return {
                    _id:           doc._id?.toString() ?? "",
                    orderNumber:   (doc as any).orderNumber ?? orderNumber,
                    siteId:        site._id ?? site.name,
                    siteName:      site.name,
                    siteUrl:       site.mangaDbUrl,
                    siteLogo:      site.logo ?? "",
                    customerName:  addr.name  ?? (doc as any).userEmail ?? "",
                    customerEmail: (doc as any).userEmail ?? addr.email ?? "",
                    customerPhone: addr.phone ?? "",
                    items,
                    shippingAddress: {
                        name:    addr.name    ?? "",
                        phone:   addr.phone   ?? "",
                        email:   addr.email   ?? "",
                        address: addr.address ?? "",
                        state:   addr.state   ?? "",
                        city:    addr.city    ?? "",
                        zipCode: addr.zipCode ?? "",
                    },
                    shippingCost: Number((doc as any).shippingCost) || 0,
                    subtotal,
                    total:         Number((doc as any).total) || subtotal,
                    status:        (doc as any).status        ?? "pending",
                    paymentStatus: (doc as any).paymentStatus ?? "pending",
                    paymentMethod: (doc as any).paymentMethod ?? "",
                    timeline:      ((doc as any).timeline ?? []).map((t: any) => ({
                        status:        t.status        ?? "",
                        note:          t.note          ?? "",
                        createdBy:     t.createdBy     ?? "",
                        createdByName: t.createdByName ?? "",
                        createdAt:     t.createdAt     ?? new Date(),
                    })),
                    metadata: (doc as any).metadata ?? undefined,
                    notes:     (doc as any).notes ?? "",
                    createdAt: (doc as any).createdAt ?? new Date(),
                    updatedAt: (doc as any).updatedAt ?? new Date(),
                    _siteIndex: i,
                } as NormalisedOrder & { _siteIndex?: number };
            }
        } catch { /* continue */ }
    }

    return null;
}

/**
 * Update a single order in an external DB by orderNumber.
 * `updateObj` is a raw MongoDB update document, e.g. { $set: {...}, $push: {...} }
 */
export async function updateExternalOrder(
    orderNumber: string,
    updateObj: Record<string, any>,
    siteIndex: number
): Promise<NormalisedOrder | null> {
    const sites = await getSiteConfigs();
    const activeSites = sites.filter((s) => s.status === "active" && s.mangaDbUrl);
    const site = activeSites[siteIndex];
    if (!site) return null;

    try {
        const client = await getClient(site.mangaDbUrl);
        const urlObj = new URL(site.mangaDbUrl);
        const dbName = urlObj.pathname.replace(/^\//, "").split("?")[0] || "cms";
        const db = client.db(dbName);
        const ordersCol = db.collection("orders");

        await ordersCol.updateOne({ orderNumber }, updateObj);
        return findExternalOrderByNumber(orderNumber);
    } catch (error) {
        console.error(`Failed to update order ${orderNumber} on site "${site.name}":`, error);
        return null;
    }
}
