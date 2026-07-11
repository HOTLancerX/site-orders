"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { xFetch } from "@/lib/express";
import Gallery from "@/components/Gallery";

interface SiteConfig {
    _id?: string;
    name: string;
    logo: string;
    mangaDbUrl: string;
    status: "active" | "inactive";
}

const EMPTY_SITE: SiteConfig = { name: "", logo: "", mangaDbUrl: "", status: "active" };

export default function SiteOrdersSettingsPage() {
    const [sites, setSites]       = useState<SiteConfig[]>([EMPTY_SITE]);
    const [saving, setSaving]     = useState(false);
    const [message, setMessage]   = useState("");
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        fetch("/api/settings", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : {}))
            .then((data) => {
                if (data.site_orders_sites) {
                    try {
                        setSites(JSON.parse(data.site_orders_sites));
                    } catch { /* ignore */ }
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const updateSite = (idx: number, patch: Partial<SiteConfig>) => {
        setSites((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    };

    const addSite = () => setSites((prev) => [...prev, { ...EMPTY_SITE }]);

    const removeSite = (idx: number) => {
        setSites((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        try {
            const res = await xFetch("/settings", {
                method: "PUT",
                body: JSON.stringify({ site_orders_sites: JSON.stringify(sites) }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(`Error: ${data.error ?? "Failed to save"}`);
            } else {
                setMessage("Site Orders settings saved!");
                setTimeout(() => setMessage(""), 3000);
            }
        } catch {
            setMessage("Network error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 text-gray-400">
                <Icon icon="svg-spinners:ring-resize" width={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Site Orders Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Add your website logos and Manga DB URLs. Orders from these sites will appear in the Site Orders section.
                </p>
            </div>

            {message && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                    message.startsWith("Error")
                        ? "bg-red-400/10 text-red-400 border-red-400/25"
                        : "bg-emerald-400/10 text-emerald-400 border-emerald-400/25"
                }`}>
                    {message}
                </div>
            )}

            <div className="space-y-4">
                {sites.map((site, idx) => (
                    <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-800">
                                Site {idx + 1}
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateSite(idx, {
                                            status: site.status === "active" ? "inactive" : "active",
                                        })
                                    }
                                    className={`w-9 h-5 rounded-full transition-colors relative ${
                                        site.status === "active" ? "bg-emerald-500" : "bg-gray-200"
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                            site.status === "active"
                                                ? "translate-x-4"
                                                : "translate-x-0.5"
                                        }`}
                                    />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeSite(idx)}
                                    disabled={sites.length <= 1}
                                    className="text-gray-400 hover:text-red-500 disabled:opacity-20 transition"
                                >
                                    <Icon icon="mdi:delete-outline" width={18} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Site Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Site Name
                                </label>
                                <input
                                    type="text"
                                    value={site.name}
                                    onChange={(e) => updateSite(idx, { name: e.target.value })}
                                    placeholder="e.g. My Manga Store"
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>

                            {/* Manga DB URL */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                    Manga DB URL
                                </label>
                                <input
                                    type="url"
                                    value={site.mangaDbUrl}
                                    onChange={(e) => updateSite(idx, { mangaDbUrl: e.target.value })}
                                    placeholder="https://example.com/api/orders"
                                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        {/* Site Logo */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                Site Logo
                            </label>
                            <Gallery
                                value={site.logo}
                                onChange={(v) =>
                                    updateSite(idx, {
                                        logo: Array.isArray(v) ? v[0] ?? "" : v,
                                    })
                                }
                                placeholder="Select site logo"
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={addSite}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-xl transition"
                >
                    <Icon icon="solar:add-circle-bold" width={16} />
                    Add Site
                </button>

                <div className="flex-1" />

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold rounded-xl transition disabled:opacity-55 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <>
                            <Icon icon="svg-spinners:ring-resize" width={16} /> Saving…
                        </>
                    ) : (
                        <>
                            <Icon icon="solar:check-circle-bold" width={16} /> Save Settings
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
