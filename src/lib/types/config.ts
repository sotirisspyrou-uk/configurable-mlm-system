// Configuration Schema for Configurable MLM System
// File Path: /lib/types/config.ts
// Version: 2025-01-05 15:40:00

export interface MLMSystemConfig {
  business: {
    name: string
    industry: 'financial' | 'saas' | 'ecommerce' | 'professional' | 'healthcare' | 'other'
    description: string
    currency: 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD'
    timezone: string
    locale: string
    logo?: string
    primaryColor: string
    secondaryColor: string
  }

  partner: {
    maxHierarchyLevels: number
    requireSponsor: boolean
    autoActivation: boolean
    activationRequirements: ActivationRequirement[]
    statusRules: PartnerStatusRule[]
    performanceMetrics: PerformanceMetric[]
  }

  commission: {
    structure: 'percentage' | 'fixed' | 'hybrid'
    tiers: CommissionTier[]
    bonuses: BonusRule[]
    caps: CommissionCap[]
    payoutSchedule: PayoutSchedule
    minimumPayout: number
    holdingPeriod: number
    residualEnabled: boolean
    residualPeriod: number
  }

  products: ProductConfig[]

  compliance: {
    requiredDocuments: DocumentRequirement[]
    kycRequired: boolean
    amlChecks: boolean
    fraudThresholds: FraudThreshold[]
    reportingRequirements: ReportingRequirement[]
    auditTrail: boolean
  }

  integrations: {
    paymentProcessor: PaymentProcessorConfig
    emailProvider: EmailProviderConfig
    smsProvider?: SMSProviderConfig
    crmSystem?: CRMIntegrationConfig
    bankingAPI?: BankingAPIConfig
  }

  notifications: {
    partnerWelcome: NotificationTemplate
    commissionPaid: NotificationTemplate
    achievementUnlocked: NotificationTemplate
    complianceAlert: NotificationTemplate
    fraudAlert: NotificationTemplate
  }
}

export interface ActivationRequirement {
  type: 'purchase' | 'training' | 'certification' | 'deposit' | 'document_upload'
  description: string
  required: boolean
  minimumValue?: number
  timeframe?: number
}

export interface CommissionTier {
  level: number
  name: string
  qualificationCriteria: QualificationCriteria
  commissionRate: number
  commissionType: 'percentage' | 'fixed'
  minimumVolume?: number
  maximumEarnings?: number
}

export interface QualificationCriteria {
  personalVolume?: number
  teamVolume?: number
  activeDownline?: number
  timeInBusiness?: number
  certificationRequired?: string[]
}

export interface PayoutSchedule {
  frequency: 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly'
  dayOfWeek?: number
  dayOfMonth?: number
  monthOfQuarter?: number
  processingDays: number
  cutoffDay: number
}

export interface FraudThreshold {
  metric: 'referral_velocity' | 'geographic_concentration' | 'payment_patterns' | 'account_similarities'
  threshold: number
  timeWindow: number
  action: 'flag' | 'investigate' | 'suspend' | 'block'
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// Industry preset configurations
export const INDUSTRY_PRESETS: Record<string, Partial<MLMSystemConfig>> = {
  financial: {
    business: { industry: 'financial', currency: 'GBP' },
    commission: {
      structure: 'percentage',
      minimumPayout: 50,
      holdingPeriod: 90,
      payoutSchedule: { frequency: 'monthly', dayOfMonth: 15, processingDays: 5, cutoffDay: 1 }
    },
    compliance: { kycRequired: true, amlChecks: true, auditTrail: true }
  },
  saas: {
    business: { industry: 'saas', currency: 'USD' },
    commission: {
      structure: 'hybrid',
      minimumPayout: 25,
      holdingPeriod: 30,
      residualEnabled: true,
      residualPeriod: 12
    },
    partner: { maxHierarchyLevels: 5, autoActivation: true }
  }
}

// Add other interfaces as needed...
export interface PartnerStatusRule { }
export interface PerformanceMetric { }
export interface BonusRule { }
export interface CommissionCap { }
export interface ProductConfig { }
export interface DocumentRequirement { }
export interface ReportingRequirement { }
export interface PaymentProcessorConfig { }
export interface EmailProviderConfig { }
export interface SMSProviderConfig { }
export interface CRMIntegrationConfig { }
export interface BankingAPIConfig { }
export interface NotificationTemplate { }
