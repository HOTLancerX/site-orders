import { addHook, type PluginMeta } from "@/hook";
import { registerLazyComponent } from "@/hook/pluginHooks";
import SiteOrdersSettingsPage from "./settings/SiteOrdersSettingsPage";

export const PLUGINS: PluginMeta = {
    nx: "com.system.site-orders",
    name: "site-orders",
    version: "1.0.0",
    description: "Multi-site order management — fetch and manage orders from external Manga DB sites.",
    author: "System",
    path: "https://github.com/HOTLancerX/site-orders.git",
    icon: "carbon:shopping-bag",
    color: "from-violet-500 to-purple-600",
};

export function register() {
    registerLazyComponent("site-orders.AdminOrdersPage",      () => import("./orders/page"),          PLUGINS.nx);
    registerLazyComponent("site-orders.AdminOrderDetailPage", () => import("./orders/details"),       PLUGINS.nx);
    registerLazyComponent("site-orders.PendingOrdersPage",    () => import("./orders/pending/page"),  PLUGINS.nx);
    registerLazyComponent("site-orders.ProcessingOrdersPage", () => import("./orders/processing/page"), PLUGINS.nx);
    registerLazyComponent("site-orders.ShippedOrdersPage",    () => import("./orders/shipped/page"),  PLUGINS.nx);
    registerLazyComponent("site-orders.DeliveredOrdersPage",  () => import("./orders/delivered/page"), PLUGINS.nx);
    registerLazyComponent("site-orders.CancelledOrdersPage",  () => import("./orders/cancelled/page"), PLUGINS.nx);

    // ─── Admin nav ──────────────────────────────────────────────────────────
    addHook("admin.nav", [
        {
            key: "site-orders",
            label: "Site Orders",
            icon: "carbon:shopping-bag",
            slug: "site-orders",
            parent: "",
            position: 15,
        },
        {
            key: "site-orders-pending",
            label: "Pending",
            icon: "mdi:clock-outline",
            slug: "site-orders/pending",
            parent: "site-orders",
            position: 2,
        },
        {
            key: "site-orders-processing",
            label: "Processing",
            icon: "mdi:cog-outline",
            slug: "site-orders/processing",
            parent: "site-orders",
            position: 3,
        },
        {
            key: "site-orders-shipped",
            label: "Shipped",
            icon: "mdi:truck-delivery-outline",
            slug: "site-orders/shipped",
            parent: "site-orders",
            position: 4,
        },
        {
            key: "site-orders-delivered",
            label: "Delivered",
            icon: "mdi:check-circle-outline",
            slug: "site-orders/delivered",
            parent: "site-orders",
            position: 5,
        },
        {
            key: "site-orders-cancelled",
            label: "Cancelled",
            icon: "mdi:close-circle-outline",
            slug: "site-orders/cancelled",
            parent: "site-orders",
            position: 6,
        },
        {
            key: "site-orders-settings",
            label: "Site Orders Settings",
            icon: "solar:settings-bold",
            slug: "site-orders/settings",
            parent: "site-orders",
            position: 99,
        },
    ], PLUGINS.nx);

    // ─── Admin pages ────────────────────────────────────────────────────────
    addHook("admin.pages", [
        {
            key: "site-orders",
            label: "All Site Orders",
            type: "site-orders",
            style: "left",
            position: 10,
            lazyPath: "site-orders.AdminOrdersPage",
        },
        {
            key: "site-orders/",
            label: "Site Order Detail",
            type: "site-orders",
            style: "left",
            position: 11,
            lazyPath: "site-orders.AdminOrderDetailPage",
        },
        {
            key: "site-orders/pending",
            label: "Pending Site Orders",
            type: "site-orders",
            style: "left",
            position: 12,
            lazyPath: "site-orders.PendingOrdersPage",
        },
        {
            key: "site-orders/processing",
            label: "Processing Site Orders",
            type: "site-orders",
            style: "left",
            position: 13,
            lazyPath: "site-orders.ProcessingOrdersPage",
        },
        {
            key: "site-orders/shipped",
            label: "Shipped Site Orders",
            type: "site-orders",
            style: "left",
            position: 14,
            lazyPath: "site-orders.ShippedOrdersPage",
        },
        {
            key: "site-orders/delivered",
            label: "Delivered Site Orders",
            type: "site-orders",
            style: "left",
            position: 15,
            lazyPath: "site-orders.DeliveredOrdersPage",
        },
        {
            key: "site-orders/cancelled",
            label: "Cancelled Site Orders",
            type: "site-orders",
            style: "left",
            position: 16,
            lazyPath: "site-orders.CancelledOrdersPage",
        },
        {
            key: "site-orders/settings",
            label: "Site Orders Settings",
            type: "site-orders-settings",
            style: "left",
            position: 20,
            path: SiteOrdersSettingsPage,
        },
    ], PLUGINS.nx);

    // ─── Settings form fields ───────────────────────────────────────────────
    // These are universal fields rendered by FormSettings if needed.
    // The actual site config is managed by the custom SiteOrdersSettingsPage.
}
