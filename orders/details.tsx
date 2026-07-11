"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";

interface OrderItem {
    productTitle: string;
    productImage?: string;
    variantOptions?: Record<string, string>;
    sku?: string;
    price: number;
    quantity: number;
    subtotal: number;
}

interface ShippingAddress {
    name: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    city: string;
    zipCode?: string;
}

interface TimelineEntry {
    status: string;
    note: string;
    createdBy: string;
    createdByName: string;
    createdAt: string;
}

interface SiteOrder {
    _id: string;
    orderNumber: string;
    siteName: string;
    siteUrl: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    status: string;
    paymentStatus: string;
    items: OrderItem[];
    shippingAddress: ShippingAddress;
    shippingCost: number;
    subtotal: number;
    total: number;
    notes?: string;
    timeline: TimelineEntry[];
    createdAt: string;
    updatedAt: string;
}

const ORDER_STATUSES  = ["pending", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];

const STATUS_BADGE: Record<string, string> = {
    pending:    "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300",
    processing: "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
    shipped:    "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300",
    delivered:  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    cancelled:  "bg-red-100 text-red-700 ring-1 ring-red-300",
    paid:       "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    failed:     "bg-red-100 text-red-700 ring-1 ring-red-300",
    refunded:   "bg-gray-100 text-gray-600 ring-1 ring-gray-300",
};

const TIMELINE_ICONS: Record<string, string> = {
    pending:    "mdi:clock-outline",
    processing: "mdi:cog-outline",
    shipped:    "mdi:truck-delivery-outline",
    delivered:  "mdi:check-circle-outline",
    cancelled:  "mdi:close-circle-outline",
    paid:       "mdi:credit-card-check-outline",
    failed:     "mdi:credit-card-remove-outline",
    refunded:   "mdi:cash-refund",
};

function fmt(n: number) {
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <Icon icon={icon} width={18} className="text-gray-500 shrink-0" />
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${map[value] ?? "bg-gray-100 text-gray-600"}`}>
            {value}
        </span>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="text-gray-500 shrink-0">{label}</dt>
            <dd className="text-gray-800 text-right break-all">{value}</dd>
        </div>
    );
}

export default function AdminSiteOrderDetailPage() {
    const params = useParams<{ slug?: string[] }>();
    const id = Array.isArray(params?.slug)
        ? params.slug[params.slug.length - 1]
        : (params as any)?.id ?? "";

    const [order,      setOrder]      = useState<SiteOrder | null>(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState("");
    const [newStatus,  setNewStatus]  = useState("");
    const [newPayment, setNewPayment] = useState("");
    const [note,       setNote]       = useState("");
    const [saving,     setSaving]     = useState(false);
    const [saveMsg,    setSaveMsg]    = useState("");

    const fetchOrder = async () => {
        if (!id) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/site-orders/id/${id}`, { credentials: "include" });
            if (res.status === 404) { setError("Order not found."); return; }
            if (!res.ok)            { setError("Failed to load order."); return; }
            const data = await res.json();
            const o: SiteOrder = data.order;
            setOrder(o);
            setNewStatus(o.status);
            setNewPayment(o.paymentStatus);
        } catch {
            setError("Network error — could not load order.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrder(); }, [id]);

    const handleSave = async () => {
        if (!order) return;
        setSaving(true);
        setSaveMsg("");
        try {
            const body: Record<string, any> = { note: note.trim() || undefined };
            if (newStatus  !== order.status)        body.status        = newStatus;
            if (newPayment !== order.paymentStatus) body.paymentStatus = newPayment;

            const res = await fetch(`/api/site-orders/${order.orderNumber}`, {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) { setSaveMsg(`Error: ${data.error ?? "Failed to save"}`); return; }

            const updated: SiteOrder = data.order;
            setOrder(updated);
            setNewStatus(updated.status);
            setNewPayment(updated.paymentStatus);
            setNote("");
            setSaveMsg("Saved successfully.");
            setTimeout(() => setSaveMsg(""), 3000);
        } catch {
            setSaveMsg("Network error — could not save.");
        } finally {
            setSaving(false);
        }
    };

    const handleQuickAction = async (targetStatus: "delivered" | "cancelled") => {
        if (!order) return;
        const label = targetStatus === "delivered" ? "delivered" : "cancelled";
        if (!confirm(`Mark this order as ${label}?`)) return;
        setSaving(true);
        setSaveMsg("");
        try {
            const res = await fetch(`/api/site-orders/${order.orderNumber}`, {
                method:      "PUT",
                credentials: "include",
                headers:     { "Content-Type": "application/json" },
                body:        JSON.stringify({
                    status: targetStatus,
                    note:   targetStatus === "delivered"
                        ? "Order marked as delivered."
                        : "Order cancelled.",
                }),
            });
            const data = await res.json();
            if (!res.ok) { setSaveMsg(`Error: ${data.error ?? "Failed to save"}`); return; }

            const updated: SiteOrder = data.order;
            setOrder(updated);
            setNewStatus(updated.status);
            setNewPayment(updated.paymentStatus);
            setSaveMsg(`Order marked as ${label}.`);
            setTimeout(() => setSaveMsg(""), 3000);
        } catch {
            setSaveMsg("Network error — could not save.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={36} />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-32 text-gray-400">
                <Icon icon="solar:receipt-remove-outline" width={52} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg font-semibold text-gray-600">{error || "Order not found."}</p>
                <Link href="/admin/site-orders"
                    className="mt-4 inline-flex items-center gap-1.5 text-violet-500 hover:underline text-sm">
                    <Icon icon="solar:arrow-left-bold" width={14} />
                    Back to Site Orders
                </Link>
            </div>
        );
    }

    const isDirty = newStatus !== order.status || newPayment !== order.paymentStatus || note.trim() !== "";

    return (
        <div className="space-y-6 max-w-6xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link href="/admin/site-orders"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
                        <Icon icon="solar:arrow-left-bold" width={16} />
                        Site Orders
                    </Link>
                    <span className="text-gray-300">/</span>
                    <h1 className="text-xl font-bold text-gray-900 font-mono">{order.orderNumber}</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                        {order.siteName || "Unknown Site"}
                    </span>
                    <Badge value={order.status}        map={STATUS_BADGE} />
                    <Badge value={order.paymentStatus} map={STATUS_BADGE} />
                    <span className="text-xs text-gray-400">{fmtDate(order.createdAt)}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title={`Items (${order.items.length})`} icon="mdi:package-variant-closed">
                        <div className="divide-y divide-gray-50">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                                    {item.productImage ? (
                                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                            <Image src={item.productImage} alt={item.productTitle}
                                                fill className="object-cover" sizes="56px" />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                            <Icon icon="mdi:image-off" width={20} className="text-gray-300" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.productTitle}</p>
                                        {item.variantOptions && Object.keys(item.variantOptions).length > 0 && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {Object.entries(item.variantOptions).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                                            </p>
                                        )}
                                        {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">×{item.quantity} @ {fmt(item.price)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-gray-900">{fmt(item.subtotal)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span className="font-medium">{fmt(order.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Shipping</span>
                                <span className="font-medium">{fmt(order.shippingCost)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                                <span>Total</span>
                                <span>{fmt(order.total)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Shipping Address" icon="mdi:map-marker-outline">
                        <div className="text-sm text-gray-700 space-y-1">
                            <p className="font-semibold text-gray-900">{order.shippingAddress.name}</p>
                            {order.shippingAddress.phone && (
                                <p className="flex items-center gap-1.5 text-gray-500">
                                    <Icon icon="mdi:phone-outline" width={14} />
                                    {order.shippingAddress.phone}
                                </p>
                            )}
                            {order.shippingAddress.email && (
                                <p className="flex items-center gap-1.5 text-gray-500">
                                    <Icon icon="mdi:email-outline" width={14} />
                                    {order.shippingAddress.email}
                                </p>
                            )}
                            {order.shippingAddress.address && <p>{order.shippingAddress.address}</p>}
                            {(order.shippingAddress.city || order.shippingAddress.state) && (
                                <p>{[order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")}</p>
                            )}
                            {order.shippingAddress.zipCode && <p>{order.shippingAddress.zipCode}</p>}
                        </div>
                    </Card>

                    <Card title="Timeline" icon="mdi:timeline-clock-outline">
                        {order.timeline.length === 0 ? (
                            <p className="text-sm text-gray-400">No timeline entries.</p>
                        ) : (
                            <ol className="relative border-l border-gray-200 space-y-6 ml-3">
                                {[...order.timeline].reverse().map((entry, i) => (
                                    <li key={i} className="ml-5">
                                        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 ring-4 ring-white">
                                            <Icon icon={TIMELINE_ICONS[entry.status] ?? "mdi:circle-outline"} width={14} className="text-gray-500" />
                                        </span>
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800 capitalize">{entry.status}</p>
                                                <p className="text-sm text-gray-600 mt-0.5">{entry.note}</p>
                                                <p className="text-xs text-gray-400 mt-1">by {entry.createdByName}</p>
                                            </div>
                                            <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDate(entry.createdAt)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card title="Update Order" icon="mdi:pencil-outline">
                        <div className="space-y-4">
                            {saveMsg && (
                                <div className={`text-sm font-medium px-3 py-2 rounded-lg border ${saveMsg.startsWith("Error") ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}>
                                    {saveMsg}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Order Status</label>
                                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Status</label>
                                <select value={newPayment} onChange={(e) => setNewPayment(e.target.value)}
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                                    {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Note <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add a note to the timeline…"
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                            </div>
                            <button type="button" onClick={handleSave} disabled={saving || !isDirty}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving
                                    ? <><Icon icon="svg-spinners:ring-resize" width={16} /> Saving…</>
                                    : <><Icon icon="solar:check-circle-bold" width={16} /> Save Changes</>
                                }
                            </button>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => handleQuickAction("delivered")}
                                    disabled={saving || order.status === "delivered" || order.status === "cancelled"}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Icon icon="mdi:check-circle-outline" width={15} />
                                    Delivered
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickAction("cancelled")}
                                    disabled={saving || order.status === "delivered" || order.status === "cancelled"}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Icon icon="mdi:close-circle-outline" width={15} />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </Card>

                    <Card title="Summary" icon="mdi:receipt-text-outline">
                        <dl className="space-y-2 text-sm">
                            <Row label="Order #"  value={<span className="font-mono text-xs">{order.orderNumber}</span>} />
                            <Row label="Site"    value={<span className="text-violet-600">{order.siteName || "—"}</span>} />
                            <Row label="Placed"  value={fmtDate(order.createdAt)} />
                            <Row label="Updated" value={fmtDate(order.updatedAt)} />
                            <Row label="Customer" value={order.customerEmail || order.customerName || "—"} />
                            <Row label="Shipping" value={<span className="capitalize">{fmt(order.shippingCost)}</span>} />
                        </dl>
                    </Card>

                    {order.siteUrl && (
                        <Card title="Site Info" icon="mdi:web-outline">
                            <div className="space-y-2 text-sm">
                                <Row label="Site" value={<span className="font-medium text-violet-600">{order.siteName}</span>} />
                                <Row label="URL" value={
                                    <a href={order.siteUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-violet-500 hover:underline text-xs break-all">
                                        {order.siteUrl}
                                    </a>
                                } />
                            </div>
                        </Card>
                    )}

                    {order.notes && (
                        <Card title="Order Notes" icon="mdi:note-text-outline">
                            <p className="text-sm text-gray-700 whitespace-pre-line">{order.notes}</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
