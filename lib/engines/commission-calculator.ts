// Commission Calculation Engine
// File Path: /lib/engines/commission-calculator.ts
// Version: 2025-01-05 15:50:00

import { MLMSystemConfig, CommissionTier, BonusRule } from '../types/config'

export interface Transaction {
  id: string
  partnerId: string
  customerEmail: string
  amount: number
  currency: string
  productId: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface CommissionResult {
  partnerId: string
  level: number
  tierName: string
  baseAmount: number
  commissionRate: number
  commissionAmount: number
  commissionType: 'percentage' | 'fixed'
  currency: string
}

export interface BonusResult {
  partnerId: string
  bonusId: string
  bonusName: string
  amount: number
  currency: string
  triggerMetric: string
  triggerValue: number
}

export interface CommissionDistribution {
  transactionId: string
  totalCommissionPaid: number
  commissions: CommissionResult[]
  bonuses: BonusResult[]
  processingTimestamp: Date
}

export class CommissionCalculationEngine {
  constructor(private config: MLMSystemConfig) {}

  /**
   * Calculate multi-level commissions for a transaction
   */
  async calculateCommissions(
    transaction: Transaction,
    partnerHierarchy: PartnerHierarchyNode[]
  ): Promise<CommissionDistribution> {
    const commissions: CommissionResult[] = []
    const bonuses: BonusResult[] = []
    let totalCommissionPaid = 0

    // Validate transaction amount
    if (transaction.amount <= 0) {
      throw new Error('Transaction amount must be positive')
    }

    // Get product configuration
    const product = this.config.products.find(p => p.id === transaction.productId)
    if (!product || !product.commissionEligible) {
      return {
        transactionId: transaction.id,
        totalCommissionPaid: 0,
        commissions: [],
        bonuses: [],
        processingTimestamp: new Date()
      }
    }

    // Calculate commissions for each level in hierarchy
    for (let i = 0; i < Math.min(partnerHierarchy.length, this.config.partner.maxHierarchyLevels); i++) {
      const partner = partnerHierarchy[i]
      const level = i + 1
      
      // Find applicable commission tier
      const tier = this.findApplicableTier(partner, level)
      if (!tier) continue

      // Calculate commission amount
      const commissionResult = this.calculateTierCommission(
        transaction,
        partner,
        tier,
        level,
        product
      )

      if (commissionResult && commissionResult.commissionAmount > 0) {
        commissions.push(commissionResult)
        totalCommissionPaid += commissionResult.commissionAmount

        // Check for bonus eligibility
        const partnerBonuses = await this.calculateBonuses(partner, transaction, tier)
        bonuses.push(...partnerBonuses)
        totalCommissionPaid += partnerBonuses.reduce((sum, bonus) => sum + bonus.amount, 0)
      }
    }

    return {
      transactionId: transaction.id,
      totalCommissionPaid,
      commissions,
      bonuses,
      processingTimestamp: new Date()
    }
  }

  /**
   * Find the applicable commission tier for a partner at a specific level
   */
  private findApplicableTier(partner: PartnerHierarchyNode, level: number): CommissionTier | null {
    // Find tier that matches level and partner qualifies for
    const applicableTiers = this.config.commission.tiers.filter(tier => 
      tier.level === level && this.isPartnerQualified(partner, tier)
    )

    // Return the tier with highest commission rate if multiple qualify
    return applicableTiers.reduce((best, current) => 
      !best || current.commissionRate > best.commissionRate ? current : best
    , null as CommissionTier | null)
  }

  /**
   * Check if partner meets tier qualification criteria
   */
  private isPartnerQualified(partner: PartnerHierarchyNode, tier: CommissionTier): boolean {
    const criteria = tier.qualificationCriteria

    // Check personal volume requirement
    if (criteria.personalVolume && partner.personalVolume < criteria.personalVolume) {
      return false
    }

    // Check team volume requirement
    if (criteria.teamVolume && partner.teamVolume < criteria.teamVolume) {
      return false
    }

    // Check active downline requirement
    if (criteria.activeDownline && partner.activeDownline < criteria.activeDownline) {
      return false
    }

    // Check time in business requirement
    if (criteria.timeInBusiness) {
      const monthsInBusiness = this.calculateMonthsInBusiness(partner.joinDate)
      if (monthsInBusiness < criteria.timeInBusiness) {
        return false
      }
    }

    // Check certification requirements
    if (criteria.certificationRequired && criteria.certificationRequired.length > 0) {
      const hasAllCertifications = criteria.certificationRequired.every(cert =>
        partner.certifications?.includes(cert)
      )
      if (!hasAllCertifications) {
        return false
      }
    }

    return true
  }

  /**
   * Calculate commission for a specific tier
   */
  private calculateTierCommission(
    transaction: Transaction,
    partner: PartnerHierarchyNode,
    tier: CommissionTier,
    level: number,
    product: any
  ): CommissionResult | null {
    let commissionAmount = 0
    
    // Get commission rate (tier-specific or product-specific)
    const commissionRate = product.commissionRates?.[level] || tier.commissionRate

    if (tier.commissionType === 'percentage') {
      commissionAmount = transaction.amount * commissionRate
    } else if (tier.commissionType === 'fixed') {
      commissionAmount = commissionRate
    }

    // Apply minimum volume check
    if (tier.minimumVolume && transaction.amount < tier.minimumVolume) {
      return null
    }

    // Apply maximum earnings cap
    if (tier.maximumEarnings) {
      const currentMonthEarnings = partner.currentMonthEarnings || 0
      const availableEarnings = tier.maximumEarnings - currentMonthEarnings
      commissionAmount = Math.min(commissionAmount, availableEarnings)
    }

    // Apply commission caps from configuration
    for (const cap of this.config.commission.caps || []) {
      if (this.isCapApplicable(cap, partner, level)) {
        commissionAmount = Math.min(commissionAmount, cap.maxAmount)
      }
    }

    return {
      partnerId: partner.id,
      level,
      tierName: tier.name,
      baseAmount: transaction.amount,
      commissionRate,
      commissionAmount: Math.round(commissionAmount * 100) / 100, // Round to 2 decimals
      commissionType: tier.commissionType,
      currency: transaction.currency
    }
  }

  /**
   * Calculate bonuses for a partner based on achievement
   */
  private async calculateBonuses(
    partner: PartnerHierarchyNode,
    transaction: Transaction,
    tier: CommissionTier
  ): Promise<BonusResult[]> {
    const bonuses: BonusResult[] = []

    for (const bonusRule of this.config.commission.bonuses) {
      // Check if partner meets bonus eligibility criteria
      if (!this.isPartnerQualified(partner, { 
        ...tier, 
        qualificationCriteria: bonusRule.eligibilityCriteria 
      })) {
        continue
      }

      // Check if bonus trigger conditions are met
      const triggerMet = await this.isBonusTriggerMet(partner, bonusRule, transaction)
      if (!triggerMet) continue

      // Calculate bonus amount
      let bonusAmount = 0
      if (bonusRule.reward.type === 'fixed_amount') {
        bonusAmount = bonusRule.reward.value
      } else if (bonusRule.reward.type === 'percentage') {
        bonusAmount = transaction.amount * (bonusRule.reward.value / 100)
      }

      if (bonusAmount > 0) {
        bonuses.push({
          partnerId: partner.id,
          bonusId: bonusRule.id,
          bonusName: bonusRule.name,
          amount: Math.round(bonusAmount * 100) / 100,
          currency: bonusRule.reward.currency || transaction.currency,
          triggerMetric: bonusRule.trigger.metric,
          triggerValue: bonusRule.trigger.value as number
        })
      }
    }

    return bonuses
  }

  /**
   * Check if bonus trigger conditions are met
   */
  private async isBonusTriggerMet(
    partner: PartnerHierarchyNode,
    bonusRule: BonusRule,
    transaction: Transaction
  ): Promise<boolean> {
    const trigger = bonusRule.trigger
    let actualValue: number

    // Get actual metric value based on trigger type
    switch (trigger.metric) {
      case 'monthly_volume':
        actualValue = partner.monthlyVolume || 0
        break
      case 'team_size':
        actualValue = partner.activeDownline || 0
        break
      case 'personal_sales':
        actualValue = partner.personalVolume || 0
        break
      case 'consecutive_months':
        actualValue = partner.consecutiveActiveMonths || 0
        break
      default:
        return false
    }

    // Check trigger condition
    switch (trigger.operator) {
      case 'equals':
        return actualValue === trigger.value
      case 'greater_than':
        return actualValue > trigger.value
      case 'less_than':
        return actualValue < trigger.value
      case 'between':
        const range = trigger.value as number[]
        return actualValue >= range[0] && actualValue <= range[1]
      default:
        return false
    }
  }

  /**
   * Check if commission cap is applicable
   */
  private isCapApplicable(cap: any, partner: PartnerHierarchyNode, level: number): boolean {
    // Implementation depends on cap structure in config
    // This is a placeholder for cap logic
    return cap.applicableLevels?.includes(level) || cap.applicableToAll
  }

  /**
   * Calculate months in business
   */
  private calculateMonthsInBusiness(joinDate: Date): number {
    const now = new Date()
    const monthsDiff = (now.getFullYear() - joinDate.getFullYear()) * 12 + 
                       (now.getMonth() - joinDate.getMonth())
    return monthsDiff
  }

  /**
   * Calculate residual commissions for recurring products
   */
  async calculateResidualCommissions(
    subscriptions: Subscription[],
    partnerHierarchy: PartnerHierarchyNode[]
  ): Promise<CommissionDistribution[]> {
    const results: CommissionDistribution[] = []

    if (!this.config.commission.residualEnabled) {
      return results
    }

    for (const subscription of subscriptions) {
      // Only calculate if within residual period
      const monthsActive = this.calculateMonthsInBusiness(subscription.startDate)
      if (monthsActive > this.config.commission.residualPeriod) {
        continue
      }

      // Create transaction object for residual payment
      const residualTransaction: Transaction = {
        id: `residual_${subscription.id}_${new Date().getTime()}`,
        partnerId: subscription.partnerId,
        customerEmail: subscription.customerEmail,
        amount: subscription.monthlyAmount,
        currency: subscription.currency,
        productId: subscription.productId,
        timestamp: new Date(),
        metadata: { type: 'residual', subscriptionId: subscription.id }
      }

      // Calculate commissions with reduced rates for residuals
      const distribution = await this.calculateCommissions(
        residualTransaction,
        partnerHierarchy
      )

      // Apply residual reduction factor (typically 50% of normal rate)
      const residualFactor = 0.5
      distribution.commissions = distribution.commissions.map(comm => ({
        ...comm,
        commissionAmount: comm.commissionAmount * residualFactor
      }))

      distribution.totalCommissionPaid = distribution.commissions.reduce(
        (sum, comm) => sum + comm.commissionAmount, 0
      )

      results.push(distribution)
    }

    return results
  }
}

// Supporting interfaces
export interface PartnerHierarchyNode {
  id: string
  sponsorId?: string
  level: number
  personalVolume: number
  teamVolume: number
  monthlyVolume: number
  activeDownline: number
  joinDate: Date
  status: 'active' | 'inactive' | 'suspended'
  currentMonthEarnings?: number
  consecutiveActiveMonths?: number
  certifications?: string[]
}

export interface Subscription {
  id: string
  partnerId: string
  customerEmail: string
  productId: string
  monthlyAmount: number
  currency: string
  startDate: Date
  status: 'active' | 'cancelled' | 'paused'
}

export interface CommissionCap {
  id: string
  name: string
  maxAmount: number
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  applicableLevels?: number[]
  applicableToAll?: boolean
  conditions?: Record<string, any>
}

// Export utility functions
export const CommissionUtils = {
  /**
   * Validate commission calculation results
   */
  validateCommissionDistribution(distribution: CommissionDistribution): boolean {
    const calculatedTotal = distribution.commissions.reduce(
      (sum, comm) => sum + comm.commissionAmount, 0
    ) + distribution.bonuses.reduce(
      (sum, bonus) => sum + bonus.amount, 0
    )
    
    return Math.abs(calculatedTotal - distribution.totalCommissionPaid) < 0.01
  },

  /**
   * Format commission for display
   */
  formatCommission(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP'
    }).format(amount)
  },

  /**
   * Calculate commission percentage of transaction
   */
  calculateCommissionPercentage(commission: number, transaction: number): number {
    return Math.round((commission / transaction) * 10000) / 100 // 2 decimal places
  }
}
