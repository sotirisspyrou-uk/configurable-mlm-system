'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Configurable MLM System
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Enterprise-grade Multi-Level Marketing platform designed for rapid deployment 
            across Financial Services, SaaS, E-commerce, and Professional Services industries.
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/dashboard" 
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              View Dashboard
            </Link>
            <Link 
              href="/docs" 
              className="bg-gray-200 text-gray-800 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Documentation
            </Link>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">⚙️ Configurable Engines</h3>
            <p className="text-gray-600">
              Industry-specific presets for Financial Services, SaaS, E-commerce with 
              real-time configuration updates and validation.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">💰 Commission Calculator</h3>
            <p className="text-gray-600">
              Multi-level commission processing with unlimited hierarchy depth, 
              configurable tiers, bonuses, and residual income support.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">🛡️ Fraud Detection</h3>
            <p className="text-gray-600">
              Advanced pattern recognition for velocity analysis, geographic anomalies, 
              and network manipulation with automated response actions.
            </p>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Technical Architecture</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-3">Frontend Stack</h4>
              <ul className="space-y-2 text-gray-600">
                <li>• Next.js 15 with App Router</li>
                <li>• React 18 with TypeScript</li>
                <li>• Tailwind CSS for styling</li>
                <li>• Real-time updates via Supabase</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Backend Engines</h4>
              <ul className="space-y-2 text-gray-600">
                <li>• Commission Calculation Engine</li>
                <li>• Partner Hierarchy Manager</li>
                <li>• Configuration Management</li>
                <li>• Fraud Detection Engine</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
