'use client'

import { useState, useEffect } from 'react'

interface DashboardMetrics {
  totalPartners: number
  activeCommissions: number
  fraudAlerts: number
  monthlyVolume: number
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPartners: 0,
    activeCommissions: 0,
    fraudAlerts: 0,
    monthlyVolume: 0
  })

  useEffect(() => {
    // Mock data for demo
    setMetrics({
      totalPartners: 1247,
      activeCommissions: 89,
      fraudAlerts: 3,
      monthlyVolume: 234567.89
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">MLM System Dashboard</h1>
          <p className="text-gray-600">Monitor your partner network and commission performance</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Partners"
            value={metrics.totalPartners.toLocaleString()}
            icon="👥"
            color="blue"
          />
          <MetricCard
            title="Active Commissions"
            value={metrics.activeCommissions.toLocaleString()}
            icon="💰"
            color="green"
          />
          <MetricCard
            title="Fraud Alerts"
            value={metrics.fraudAlerts.toLocaleString()}
            icon="🚨"
            color="red"
          />
          <MetricCard
            title="Monthly Volume"
            value={`$${metrics.monthlyVolume.toLocaleString()}`}
            icon="📈"
            color="purple"
          />
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="Configuration Management"
            description="Manage industry-specific settings and commission structures"
            href="/dashboard/configuration"
          />
          <FeatureCard
            title="Partner Network"
            description="View and manage your partner hierarchy and performance"
            href="/dashboard/partners"
          />
          <FeatureCard
            title="Commission Analytics"
            description="Track commission payments and performance metrics"
            href="/dashboard/commissions"
          />
          <FeatureCard
            title="Fraud Detection"
            description="Monitor suspicious activities and manage alerts"
            href="/dashboard/fraud"
          />
          <FeatureCard
            title="Business Analytics"
            description="Advanced analytics and reporting dashboard"
            href="/dashboard/analytics"
          />
          <FeatureCard
            title="System Health"
            description="Monitor system performance and configuration status"
            href="/dashboard/health"
          />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon, color }: {
  title: string
  value: string
  icon: string
  color: 'blue' | 'green' | 'red' | 'purple'
}) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    purple: 'border-purple-200 bg-purple-50'
  }

  return (
    <div className={`p-6 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  )
}

function FeatureCard({ title, description, href }: {
  title: string
  description: string
  href: string
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <a
        href={href}
        className="text-blue-600 font-medium hover:text-blue-700 transition-colors"
      >
        View Details →
      </a>
    </div>
  )
}
