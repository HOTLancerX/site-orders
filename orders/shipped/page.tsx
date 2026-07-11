"use client";
import OrdersTable from "../OrdersTable";
export default function ShippedOrdersPage() {
    return <OrdersTable defaultStatus="shipped" title="Shipped Site Orders" showStatusFilter={false} />;
}
