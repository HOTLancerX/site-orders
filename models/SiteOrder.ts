import { ObjectId, Collection } from "mongodb";
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
    siteId: string;           // reference to the site config _id (string)
    siteName: string;         // snapshot of site name at order time
    siteUrl: string;          // snapshot of Manga DB URL

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
    notes?: string;

    createdAt: Date;
    updatedAt: Date;
}

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
