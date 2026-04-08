"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

// Charger SwaggerUI côté client uniquement (pas de SSR)
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false })

export default function SwaggerPage() {
    const [spec, setSpec] = useState<object | null>(null)

    useEffect(() => {
        // Suppress known third-party warning from swagger-ui-react (ModelCollapse)
        const originalError = console.error
        console.error = (...args: unknown[]) => {
            if (typeof args[0] === "string" && args[0].includes("UNSAFE_componentWillReceiveProps")) return
            originalError(...args)
        }
        return () => { console.error = originalError }
    }, [])

    useEffect(() => {
        // En production derrière le proxy, l'API est accessible via /xkorienta/backend
        const base = process.env.NEXT_PUBLIC_API_URL || ""
        fetch(`${base}/api/swagger`)
            .then((res) => res.json())
            .then(setSpec)
    }, [])

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto p-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Xkorienta API — Documentation</h1>
                    <p className="text-gray-500 mt-1">
                        Documentation interactive de l'API. Retrouvez également le{" "}
                        <a
                            href="/api/swagger"
                            target="_blank"
                            className="text-blue-600 underline"
                        >
                            spec JSON brut
                        </a>
                        .
                    </p>
                </div>

                {spec ? (
                    <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={2} />
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-400">
                        Chargement de la documentation...
                    </div>
                )}
            </div>
        </div>
    )
}
