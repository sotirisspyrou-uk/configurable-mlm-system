// Fraud Detection Engine
// File Path: /lib/engines/fraud-detection.ts
// Version: 2025-01-05 16:05:00

import { MLMSystemConfig, FraudThreshold } from '../types/config'

export interface FraudAlert {
  id: string
  partnerId: string
  alertType: FraudAlertType
  severity: 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
  description: string
  evidence: FraudEvidence[]
  status: 'open' | 'investigating' | 'resolved' | 'false_positive'
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  actions: FraudAction[]
  metadata: Record<string, any>
}

export type FraudAlertType = 
  | 'referral_velocity'
  | 'geographic_concentration' 
  | 'payment_patterns'
  | 'account_similarities'
  | 'commission_anomaly'
  | 'network_manipulation'
  | 'identity_verification'
  | 'behavioral_analysis'

export interface FraudEvidence {
  type: string
  description: string
  value: any
  weight: number
  timestamp: Date
}

export interface FraudAction {
  action: 'flag' | 'investigate' | 'suspend' | 'block' | 'require_verification'
  timestamp: Date
  reason: string
  automated: boolean
  executedBy?: string
}

export interface RiskMetrics {
  referralVelocity: number
  geographicSpread: number
  paymentPatternScore: number
  networkSimilarity: number
  behavioralScore: number
  identityConfidence: number
  overallRiskScore: number
}

export interface ActivityPattern {
  partnerId: string
  patternType: string
  frequency: number
  timeWindow: string
  lastOccurrence: Date
  significance: number
}

export class FraudDetectionEngine {
  private alerts: Map<string, FraudAlert> = new Map()
  private riskProfiles: Map<string, RiskMetrics> = new Map()
  private patterns: Map<string, ActivityPattern[]> = new Map()

  constructor(private config: MLMSystemConfig) {}

  /**
   * Analyze a partner for fraud indicators
   */
  async analyzePartner(partnerId: string): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = []
    
    // Get partner data and activity history
    const partner = await this.getPartnerData(partnerId)
    const activities = await this.getPartnerActivities(partnerId)
    const referrals = await this.getPartnerReferrals(partnerId)
    
    if (!partner) {
      throw new Error('Partner not found')
    }

    // Calculate risk metrics
    const riskMetrics = await this.calculateRiskMetrics(partner, activities, referrals)
    this.riskProfiles.set(partnerId, riskMetrics)

    // Run fraud detection algorithms
    const velocityAlerts = this.detectReferralVelocityAnomalies(partner, referrals)
    const geographicAlerts = this.detectGeographicAnomalies(partner, referrals)
    const paymentAlerts = this.detectPaymentAnomalies(partner, activities)
    const similarityAlerts = await this.detectAccountSimilarities(partner)
    const networkAlerts = this.detectNetworkManipulation(partner, referrals)
    const behavioralAlerts = this.detectBehavioralAnomalies(partner, activities)

    alerts.push(
      ...velocityAlerts,
      ...geographicAlerts,
      ...paymentAlerts,
      ...similarityAlerts,
      ...networkAlerts,
      ...behavioralAlerts
    )

    // Process alerts through thresholds
    const filteredAlerts = this.applyFraudThresholds(alerts)

    // Store and execute actions
    for (const alert of filteredAlerts) {
      this.alerts.set(alert.id, alert)
      await this.executeAutomatedActions(alert)
    }

    return filteredAlerts
  }

  /**
   * Detect unusual referral velocity patterns
   */
  private detectReferralVelocityAnomalies(partner: any, referrals: any[]): FraudAlert[] {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    // Check referrals in last 24 hours
    const recentReferrals = referrals.filter(r => 
      (now.getTime() - new Date(r.createdAt).getTime()) < 24 * 60 * 60 * 1000
    )
    
    const dailyVelocity = recentReferrals.length
    const normalVelocity = this.calculateNormalReferralVelocity(partner)
    
    if (dailyVelocity > normalVelocity * 5) { // 5x normal velocity
      const evidence: FraudEvidence[] = [
        {
          type: 'velocity_metric',
          description: `${dailyVelocity} referrals in 24 hours vs normal ${normalVelocity}`,
          value: { current: dailyVelocity, normal: normalVelocity },
          weight: 0.8,
          timestamp: now
        }
      ]

      // Check if referrals are from similar sources
      const ipAddresses = new Set(recentReferrals.map(r => r.metadata?.ipAddress).filter(Boolean))
      if (ipAddresses.size < dailyVelocity * 0.3) { // Less than 30% unique IPs
        evidence.push({
          type: 'ip_concentration',
          description: `Only ${ipAddresses.size} unique IP addresses for ${dailyVelocity} referrals`,
          value: { uniqueIPs: ipAddresses.size, totalReferrals: dailyVelocity },
          weight: 0.9,
          timestamp: now
        })
      }

      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'referral_velocity',
        severity: dailyVelocity > normalVelocity * 10 ? 'critical' : 'high',
        riskScore: Math.min(dailyVelocity / normalVelocity / 10, 1.0),
        description: `Unusually high referral velocity: ${dailyVelocity} referrals in 24 hours`,
        evidence,
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          velocityRatio: dailyVelocity / normalVelocity,
          timeWindow: '24h'
        }
      })
    }

    return alerts
  }

  /**
   * Detect geographic concentration anomalies
   */
  private detectGeographicAnomalies(partner: any, referrals: any[]): FraudAlert[] {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    // Group referrals by location
    const locationCounts = new Map<string, number>()
    
    for (const referral of referrals) {
      const location = referral.metadata?.country || 'unknown'
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1)
    }

    const totalReferrals = referrals.length
    const uniqueLocations = locationCounts.size
    
    // Check for excessive geographic concentration
    const maxConcentration = Math.max(...locationCounts.values())
    const concentrationRatio = maxConcentration / totalReferrals
    
    if (concentrationRatio > 0.8 && totalReferrals > 10) { // 80% from one location
      const topLocation = Array.from(locationCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]
      
      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'geographic_concentration',
        severity: concentrationRatio > 0.95 ? 'high' : 'medium',
        riskScore: concentrationRatio,
        description: `High geographic concentration: ${Math.round(concentrationRatio * 100)}% of referrals from ${topLocation[0]}`,
        evidence: [{
          type: 'geographic_distribution',
          description: `${topLocation[1]} out of ${totalReferrals} referrals from ${topLocation[0]}`,
          value: { location: topLocation[0], count: topLocation[1], total: totalReferrals },
          weight: 0.7,
          timestamp: now
        }],
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          concentrationRatio,
          topLocation: topLocation[0],
          uniqueLocations
        }
      })
    }

    return alerts
  }

  /**
   * Detect payment and banking anomalies
   */
  private detectPaymentAnomalies(partner: any, activities: any[]): FraudAlert[] {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    const payments = activities.filter(a => a.type === 'payment' || a.type === 'commission_payment')
    
    if (payments.length === 0) return alerts

    // Check for rapid payment method changes
    const paymentMethods = payments.map(p => p.metadata?.paymentMethod || 'unknown')
    const uniqueMethods = new Set(paymentMethods)
    
    if (uniqueMethods.size > 3 && payments.length > 5) {
      const recentChanges = this.countRecentPaymentMethodChanges(payments, 30) // 30 days
      
      if (recentChanges > 2) {
        alerts.push({
          id: this.generateAlertId(),
          partnerId: partner.id,
          alertType: 'payment_patterns',
          severity: 'medium',
          riskScore: Math.min(recentChanges / 5, 1.0),
          description: `Frequent payment method changes: ${recentChanges} changes in 30 days`,
          evidence: [{
            type: 'payment_method_changes',
            description: `${recentChanges} payment method changes in recent 30 days`,
            value: { changes: recentChanges, uniqueMethods: uniqueMethods.size },
            weight: 0.6,
            timestamp: now
          }],
          status: 'open',
          createdAt: now,
          actions: [],
          metadata: {
            paymentMethodCount: uniqueMethods.size,
            recentChanges
          }
        })
      }
    }

    // Check for unusual transaction timing patterns
    const transactionTimes = payments.map(p => new Date(p.createdAt).getHours())
    const nightTimeTransactions = transactionTimes.filter(h => h < 6 || h > 22).length
    const nightTimeRatio = nightTimeTransactions / payments.length
    
    if (nightTimeRatio > 0.7 && payments.length > 10) {
      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'payment_patterns',
        severity: 'low',
        riskScore: nightTimeRatio,
        description: `Unusual transaction timing: ${Math.round(nightTimeRatio * 100)}% during night hours`,
        evidence: [{
          type: 'transaction_timing',
          description: `${nightTimeTransactions} out of ${payments.length} transactions during night hours`,
          value: { nightTime: nightTimeTransactions, total: payments.length },
          weight: 0.3,
          timestamp: now
        }],
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          nightTimeRatio,
          totalTransactions: payments.length
        }
      })
    }

    return alerts
  }

  /**
   * Detect similarities between accounts that might indicate fraud
   */
  private async detectAccountSimilarities(partner: any): Promise<FraudAlert[]> {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    // Get all partners for comparison
    const allPartners = await this.getAllPartners()
    const similarities: any[] = []
    
    for (const otherPartner of allPartners) {
      if (otherPartner.id === partner.id) continue
      
      const similarity = this.calculatePartnerSimilarity(partner, otherPartner)
      if (similarity.score > 0.8) { // High similarity threshold
        similarities.push({
          partnerId: otherPartner.id,
          partnerCode: otherPartner.partnerCode,
          similarityScore: similarity.score,
          matchingFields: similarity.matchingFields
        })
      }
    }
    
    if (similarities.length > 0) {
      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'account_similarities',
        severity: similarities.length > 2 ? 'high' : 'medium',
        riskScore: Math.min(similarities.length / 5, 1.0),
        description: `High similarity with ${similarities.length} other accounts`,
        evidence: [{
          type: 'account_similarity',
          description: `Similar to ${similarities.length} other accounts`,
          value: similarities,
          weight: 0.8,
          timestamp: now
        }],
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          similarAccounts: similarities
        }
      })
    }

    return alerts
  }

  /**
   * Detect network manipulation attempts
   */
  private detectNetworkManipulation(partner: any, referrals: any[]): FraudAlert[] {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    // Check for circular referral patterns
    const referralChain = this.analyzeReferralChain(partner, referrals)
    
    if (referralChain.hasCircularPattern) {
      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'network_manipulation',
        severity: 'high',
        riskScore: 0.9,
        description: 'Circular referral pattern detected',
        evidence: [{
          type: 'circular_referrals',
          description: 'Partners referring each other in circular pattern',
          value: referralChain.circularNodes,
          weight: 0.9,
          timestamp: now
        }],
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          circularPattern: referralChain.circularNodes
        }
      })
    }

    // Check for referral farming (many referrals with minimal activity)
    const lowActivityReferrals = referrals.filter(r => 
      !r.accountFunded || r.depositAmount < 100
    ).length
    
    const farmingRatio = lowActivityReferrals / referrals.length
    
    if (farmingRatio > 0.8 && referrals.length > 20) {
      alerts.push({
        id: this.generateAlertId(),
        partnerId: partner.id,
        alertType: 'network_manipulation',
        severity: 'medium',
        riskScore: farmingRatio,
        description: `Potential referral farming: ${Math.round(farmingRatio * 100)}% low-activity referrals`,
        evidence: [{
          type: 'referral_farming',
          description: `${lowActivityReferrals} out of ${referrals.length} referrals with minimal activity`,
          value: { lowActivity: lowActivityReferrals, total: referrals.length },
          weight: 0.7,
          timestamp: now
        }],
        status: 'open',
        createdAt: now,
        actions: [],
        metadata: {
          farmingRatio,
          totalReferrals: referrals.length
        }
      })
    }

    return alerts
  }

  /**
   * Detect behavioral anomalies
   */
  private detectBehavioralAnomalies(partner: any, activities: any[]): FraudAlert[] {
    const alerts: FraudAlert[] = []
    const now = new Date()
    
    // Analyze login patterns
    const logins = activities.filter(a => a.type === 'login')
    if (logins.length > 0) {
      const loginTimes = logins.map(l => new Date(l.createdAt).getHours())
      const uniqueHours = new Set(loginTimes).size
      
      // Check for bot-like regular intervals
      if (uniqueHours < 3 && logins.length > 20) {
        alerts.push({
          id: this.generateAlertId(),
          partnerId: partner.id,
          alertType: 'behavioral_analysis',
          severity: 'medium',
          riskScore: 1 - (uniqueHours / 24),
          description: `Highly regular login pattern: only ${uniqueHours} different hours`,
          evidence: [{
            type: 'login_pattern',
            description: `${logins.length} logins during only ${uniqueHours} different hours`,
            value: { totalLogins: logins.length, uniqueHours },
            weight: 0.6,
            timestamp: now
          }],
          status: 'open',
          createdAt: now,
          actions: [],
          metadata: {
            loginPattern: { uniqueHours, totalLogins: logins.length }
          }
        })
      }
    }

    return alerts
  }

  /**
   * Apply fraud thresholds from configuration
   */
  private applyFraudThresholds(alerts: FraudAlert[]): FraudAlert[] {
    return alerts.filter(alert => {
      const threshold = this.config.compliance.fraudThresholds.find(
        t => t.metric === alert.alertType
      )
      
      if (!threshold) return true // No threshold configured, include alert
      
      return alert.riskScore >= threshold.threshold
    })
  }

  /**
   * Execute automated actions based on alert severity
   */
  private async executeAutomatedActions(alert: FraudAlert): Promise<void> {
    const threshold = this.config.compliance.fraudThresholds.find(
      t => t.metric === alert.alertType
    )
    
    if (!threshold) return
    
    const action: FraudAction = {
      action: threshold.action as any,
      timestamp: new Date(),
      reason: `Automated action for ${alert.alertType} with risk score ${alert.riskScore}`,
      automated: true
    }
    
    alert.actions.push(action)
    
    // Execute the action (implementation would depend on your system)
    switch (action.action) {
      case 'flag':
        // Just flag for manual review
        break
      case 'investigate':
        // Trigger investigation workflow
        break
      case 'suspend':
        // Suspend partner account
        await this.suspendPartner(alert.partnerId, action.reason)
        break
      case 'block':
        // Block all activities
        await this.blockPartner(alert.partnerId, action.reason)
        break
    }
  }

  // Helper methods

  private calculateRiskMetrics(partner: any, activities: any[], referrals: any[]): RiskMetrics {
    return {
      referralVelocity: this.calculateReferralVelocityScore(referrals),
      geographicSpread: this.calculateGeographicScore(referrals),
      paymentPatternScore: this.calculatePaymentScore(activities),
      networkSimilarity: 0.5, // Placeholder
      behavioralScore: this.calculateBehavioralScore(activities),
      identityConfidence: partner.complianceScore || 0.5,
      overallRiskScore: 0.5 // Would be calculated from above metrics
    }
  }

  private calculateNormalReferralVelocity(partner: any): number {
    // Simple heuristic: 1 referral per week for active partners
    const weeksActive = Math.max(1, (Date.now() - new Date(partner.joinDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    return Math.max(1, partner.totalReferrals / weeksActive / 7) // Daily average
  }

  private countRecentPaymentMethodChanges(payments: any[], days: number): number {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recentPayments = payments.filter(p => new Date(p.createdAt) > cutoff)
    
    let changes = 0
    let lastMethod = null
    
    for (const payment of recentPayments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())) {
      const method = payment.metadata?.paymentMethod
      if (lastMethod && method !== lastMethod) {
        changes++
      }
      lastMethod = method
    }
    
    return changes
  }

  private calculatePartnerSimilarity(partner1: any, partner2: any): { score: number, matchingFields: string[] } {
    const matchingFields: string[] = []
    let matches = 0
    let total = 0
    
    // Check various fields for similarity
    const fieldsToCheck = [
      'email', 'phone', 'address', 'bankAccount', 'ipAddress', 'userAgent'
    ]
    
    for (const field of fieldsToCheck) {
      total++
      const value1 = partner1.metadata?.[field] || partner1[field]
      const value2 = partner2.metadata?.[field] || partner2[field]
      
      if (value1 && value2 && value1 === value2) {
        matches++
        matchingFields.push(field)
      }
    }
    
    return {
      score: total > 0 ? matches / total : 0,
      matchingFields
    }
  }

  private analyzeReferralChain(partner: any, referrals: any[]): { hasCircularPattern: boolean, circularNodes: string[] } {
    // Simplified circular detection
    const referralMap = new Map<string, string>()
    
    for (const referral of referrals) {
      if (referral.referrerPartnerId) {
        referralMap.set(referral.customerEmail, referral.referrerPartnerId)
      }
    }
    
    // Check if any referrals lead back to the original partner
    for (const [customer, referrer] of referralMap.entries()) {
      if (referrer === partner.id) {
        // This is a potential circular pattern
        return {
          hasCircularPattern: true,
          circularNodes: [partner.id, customer]
        }
      }
    }
    
    return {
      hasCircularPattern: false,
      circularNodes: []
    }
  }

  private calculateReferralVelocityScore(referrals: any[]): number {
    if (referrals.length === 0) return 0
    
    const now = new Date()
    const recentReferrals = referrals.filter(r => 
      (now.getTime() - new Date(r.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000 // 30 days
    )
    
    return Math.min(recentReferrals.length / 30, 1.0) // Normalize to 0-1
  }

  private calculateGeographicScore(referrals: any[]): number {
    if (referrals.length === 0) return 0
    
    const countries = new Set(referrals.map(r => r.metadata?.country).filter(Boolean))
    return Math.min(countries.size / 10, 1.0) // More countries = lower risk
  }

  private calculatePaymentScore(activities: any[]): number {
    const payments = activities.filter(a => a.type === 'payment')
    if (payments.length === 0) return 0.5
    
    const methods = new Set(payments.map(p => p.metadata?.paymentMethod).filter(Boolean))
    return Math.min(methods.size / 5, 1.0) // More payment methods = higher risk
  }

  private calculateBehavioralScore(activities: any[]): number {
    // Simplified behavioral scoring
    const logins = activities.filter(a => a.type === 'login')
    if (logins.length === 0) return 0.5
    
    const hours = new Set(logins.map(l => new Date(l.createdAt).getHours()))
    return 1 - (hours.size / 24) // Less variation = higher risk
  }

  private generateAlertId(): string {
    return 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // Placeholder methods for external integrations
  private async getPartnerData(partnerId: string): Promise<any> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async getPartnerActivities(partnerId: string): Promise<any[]> {
    // Database query implementation  
    throw new Error('Method should be implemented with actual database calls')
  }

  private async getPartnerReferrals(partnerId: string): Promise<any[]> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async getAllPartners(): Promise<any[]> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async suspendPartner(partnerId: string, reason: string): Promise<void> {
    // Partner suspension implementation
    console.log(`Suspending partner ${partnerId}: ${reason}`)
  }

  private async blockPartner(partnerId: string, reason: string): Promise<void> {
    // Partner blocking implementation
    console.log(`Blocking partner ${partnerId}: ${reason}`)
  }
}
