// Partner Hierarchy Management System
// File Path: /lib/engines/hierarchy-manager.ts
// Version: 2025-01-05 15:55:00

import { MLMSystemConfig } from '../types/config'

export interface Partner {
  id: string
  userId: string
  partnerCode: string
  sponsorId?: string
  sponsorPath: string // Materialized path for efficient queries
  level: number
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'terminated'
  joinDate: Date
  activationDate?: Date
  personalVolume: number
  teamVolume: number
  monthlyVolume: number
  quarterlyVolume: number
  annualVolume: number
  directReferrals: number
  totalDownline: number
  activeDownline: number
  lastActivityDate?: Date
  complianceScore: number
  riskScore: number
  metadata: Record<string, any>
  created_at: Date
  updated_at: Date
}

export interface HierarchyStats {
  totalPartners: number
  activePartners: number
  levels: number
  averageDownlineSize: number
  topPerformers: Partner[]
  volumeDistribution: VolumeDistribution[]
}

export interface VolumeDistribution {
  level: number
  partnerCount: number
  totalVolume: number
  averageVolume: number
}

export interface HierarchyValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class PartnerHierarchyManager {
  constructor(private config: MLMSystemConfig) {}

  /**
   * Add a new partner to the hierarchy
   */
  async addPartner(partnerData: Partial<Partner>, sponsorId?: string): Promise<Partner> {
    // Validate sponsor if provided
    if (sponsorId) {
      const sponsor = await this.getPartner(sponsorId)
      if (!sponsor) {
        throw new Error('Invalid sponsor ID')
      }
      if (sponsor.status !== 'active') {
        throw new Error('Sponsor must be active to sponsor new partners')
      }
    }

    // Generate unique partner code
    const partnerCode = await this.generatePartnerCode()
    
    // Calculate level and path
    const level = sponsorId ? await this.getPartnerLevel(sponsorId) + 1 : 1
    const sponsorPath = sponsorId ? await this.buildSponsorPath(sponsorId) : ''

    // Validate hierarchy constraints
    if (level > this.config.partner.maxHierarchyLevels) {
      throw new Error(`Maximum hierarchy level (${this.config.partner.maxHierarchyLevels}) exceeded`)
    }

    const newPartner: Partner = {
      id: this.generateId(),
      userId: partnerData.userId!,
      partnerCode,
      sponsorId,
      sponsorPath,
      level,
      status: this.config.partner.autoActivation ? 'active' : 'pending',
      joinDate: new Date(),
      activationDate: this.config.partner.autoActivation ? new Date() : undefined,
      personalVolume: 0,
      teamVolume: 0,
      monthlyVolume: 0,
      quarterlyVolume: 0,
      annualVolume: 0,
      directReferrals: 0,
      totalDownline: 0,
      activeDownline: 0,
      complianceScore: 1.0,
      riskScore: 0.0,
      metadata: partnerData.metadata || {},
      created_at: new Date(),
      updated_at: new Date(),
      ...partnerData
    }

    // Update sponsor's downline counts
    if (sponsorId) {
      await this.updateSponsorDownlineCounts(sponsorId, 1)
    }

    return newPartner
  }

  /**
   * Get partner hierarchy starting from a specific partner
   */
  async getPartnerHierarchy(
    partnerId: string,
    maxDepth: number = 10,
    includeInactive: boolean = false
  ): Promise<PartnerHierarchyNode[]> {
    const partner = await this.getPartner(partnerId)
    if (!partner) {
      throw new Error('Partner not found')
    }

    const hierarchy: PartnerHierarchyNode[] = []
    const visited = new Set<string>()

    await this.buildHierarchyRecursive(
      partner,
      hierarchy,
      visited,
      0,
      maxDepth,
      includeInactive
    )

    return hierarchy
  }

  /**
   * Get upline hierarchy (sponsors) for a partner
   */
  async getUplineHierarchy(partnerId: string): Promise<Partner[]> {
    const partner = await this.getPartner(partnerId)
    if (!partner || !partner.sponsorPath) {
      return []
    }

    // Parse sponsor path to get all upline partner IDs
    const sponsorIds = partner.sponsorPath.split('/').filter(id => id.length > 0)
    const upline: Partner[] = []

    for (const sponsorId of sponsorIds) {
      const sponsor = await this.getPartner(sponsorId)
      if (sponsor) {
        upline.push(sponsor)
      }
    }

    return upline.reverse() // Top-level sponsor first
  }

  /**
   * Get downline hierarchy for a partner
   */
  async getDownlineHierarchy(
    partnerId: string,
    maxLevels: number = 5,
    activeOnly: boolean = true
  ): Promise<Partner[]> {
    const downline: Partner[] = []
    const partner = await this.getPartner(partnerId)
    
    if (!partner) {
      return downline
    }

    // Query all partners whose sponsor path contains this partner's ID
    const allPartners = await this.getAllPartners() // This would be a database query
    
    for (const p of allPartners) {
      if (p.sponsorPath.includes(partnerId) && p.id !== partnerId) {
        // Calculate level difference
        const levelDiff = p.level - partner.level
        
        if (levelDiff <= maxLevels && (!activeOnly || p.status === 'active')) {
          downline.push(p)
        }
      }
    }

    // Sort by level then by join date
    return downline.sort((a, b) => {
      if (a.level !== b.level) {
        return a.level - b.level
      }
      return a.joinDate.getTime() - b.joinDate.getTime()
    })
  }

  /**
   * Update partner performance metrics
   */
  async updatePartnerMetrics(partnerId: string, metrics: Partial<Partner>): Promise<Partner> {
    const partner = await this.getPartner(partnerId)
    if (!partner) {
      throw new Error('Partner not found')
    }

    const updatedPartner = {
      ...partner,
      ...metrics,
      updated_at: new Date()
    }

    // If team volume changed, update upline team volumes
    if (metrics.teamVolume !== undefined && metrics.teamVolume !== partner.teamVolume) {
      const volumeDelta = metrics.teamVolume - partner.teamVolume
      await this.propagateVolumeUpdate(partner.sponsorId, volumeDelta)
    }

    return updatedPartner
  }

  /**
   * Calculate hierarchy statistics
   */
  async calculateHierarchyStats(rootPartnerId?: string): Promise<HierarchyStats> {
    const allPartners = rootPartnerId 
      ? await this.getDownlineHierarchy(rootPartnerId, 99, false)
      : await this.getAllPartners()

    const activePartners = allPartners.filter(p => p.status === 'active')
    const levels = Math.max(...allPartners.map(p => p.level))
    
    // Calculate volume distribution by level
    const volumeDistribution: VolumeDistribution[] = []
    for (let level = 1; level <= levels; level++) {
      const levelPartners = allPartners.filter(p => p.level === level)
      const totalVolume = levelPartners.reduce((sum, p) => sum + p.personalVolume, 0)
      
      volumeDistribution.push({
        level,
        partnerCount: levelPartners.length,
        totalVolume,
        averageVolume: levelPartners.length > 0 ? totalVolume / levelPartners.length : 0
      })
    }

    // Get top performers
    const topPerformers = activePartners
      .sort((a, b) => b.personalVolume - a.personalVolume)
      .slice(0, 10)

    return {
      totalPartners: allPartners.length,
      activePartners: activePartners.length,
      levels,
      averageDownlineSize: allPartners.length > 0 
        ? allPartners.reduce((sum, p) => sum + p.totalDownline, 0) / allPartners.length 
        : 0,
      topPerformers,
      volumeDistribution
    }
  }

  /**
   * Validate hierarchy integrity
   */
  async validateHierarchy(): Promise<HierarchyValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const allPartners = await this.getAllPartners()

    for (const partner of allPartners) {
      // Check sponsor relationship validity
      if (partner.sponsorId) {
        const sponsor = await this.getPartner(partner.sponsorId)
        if (!sponsor) {
          errors.push(`Partner ${partner.partnerCode} has invalid sponsor ID: ${partner.sponsorId}`)
        } else if (sponsor.level >= partner.level) {
          errors.push(`Partner ${partner.partnerCode} level (${partner.level}) should be greater than sponsor level (${sponsor.level})`)
        }
      }

      // Check sponsor path consistency
      if (partner.sponsorPath) {
        const pathLevels = partner.sponsorPath.split('/').filter(id => id.length > 0).length
        if (pathLevels !== partner.level - 1) {
          warnings.push(`Partner ${partner.partnerCode} sponsor path length (${pathLevels}) doesn't match level (${partner.level})`)
        }
      }

      // Check hierarchy depth limits
      if (partner.level > this.config.partner.maxHierarchyLevels) {
        errors.push(`Partner ${partner.partnerCode} exceeds maximum hierarchy level (${this.config.partner.maxHierarchyLevels})`)
      }

      // Check for circular references
      if (await this.hasCircularReference(partner)) {
        errors.push(`Partner ${partner.partnerCode} has circular reference in hierarchy`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Move partner to new sponsor (hierarchy reorganization)
   */
  async movePartner(partnerId: string, newSponsorId: string): Promise<void> {
    const partner = await this.getPartner(partnerId)
    const newSponsor = await this.getPartner(newSponsorId)

    if (!partner) {
      throw new Error('Partner not found')
    }
    if (!newSponsor) {
      throw new Error('New sponsor not found')
    }

    // Prevent moving to own downline (would create circular reference)
    const downline = await this.getDownlineHierarchy(partnerId)
    if (downline.some(p => p.id === newSponsorId)) {
      throw new Error('Cannot move partner to their own downline')
    }

    const oldSponsorId = partner.sponsorId
    const newLevel = newSponsor.level + 1

    // Check hierarchy depth limit
    if (newLevel > this.config.partner.maxHierarchyLevels) {
      throw new Error('Move would exceed maximum hierarchy level')
    }

    // Update partner's sponsor and path
    const newSponsorPath = await this.buildSponsorPath(newSponsorId)
    
    await this.updatePartner(partnerId, {
      sponsorId: newSponsorId,
      sponsorPath: newSponsorPath,
      level: newLevel
    })

    // Update downline counts
    if (oldSponsorId) {
      await this.updateSponsorDownlineCounts(oldSponsorId, -1)
    }
    await this.updateSponsorDownlineCounts(newSponsorId, 1)

    // Recursively update all downline levels and paths
    await this.updateDownlineLevelsAndPaths(partnerId, newLevel, newSponsorPath + `/${partnerId}`)
  }

  /**
   * Deactivate partner and handle downline
   */
  async deactivatePartner(
    partnerId: string,
    reason: string,
    redistributeDownline: boolean = true
  ): Promise<void> {
    const partner = await this.getPartner(partnerId)
    if (!partner) {
      throw new Error('Partner not found')
    }

    // Update partner status
    await this.updatePartner(partnerId, {
      status: 'inactive',
      metadata: {
        ...partner.metadata,
        deactivationReason: reason,
        deactivationDate: new Date().toISOString()
      }
    })

    if (redistributeDownline) {
      // Move direct downline to partner's sponsor
      const directDownline = await this.getDirectDownline(partnerId)
      
      for (const downlinePartner of directDownline) {
        if (partner.sponsorId) {
          await this.movePartner(downlinePartner.id, partner.sponsorId)
        } else {
          // If no sponsor, these become top-level partners
          await this.updatePartner(downlinePartner.id, {
            sponsorId: undefined,
            sponsorPath: '',
            level: 1
          })
        }
      }
    }

    // Update sponsor's downline count
    if (partner.sponsorId) {
      await this.updateSponsorDownlineCounts(partner.sponsorId, -1)
    }
  }

  // Private helper methods

  private async buildHierarchyRecursive(
    partner: Partner,
    hierarchy: PartnerHierarchyNode[],
    visited: Set<string>,
    currentDepth: number,
    maxDepth: number,
    includeInactive: boolean
  ): Promise<void> {
    if (currentDepth >= maxDepth || visited.has(partner.id)) {
      return
    }

    if (!includeInactive && partner.status !== 'active') {
      return
    }

    visited.add(partner.id)

    const node: PartnerHierarchyNode = {
      id: partner.id,
      sponsorId: partner.sponsorId,
      level: partner.level,
      personalVolume: partner.personalVolume,
      teamVolume: partner.teamVolume,
      monthlyVolume: partner.monthlyVolume,
      activeDownline: partner.activeDownline,
      joinDate: partner.joinDate,
      status: partner.status,
      children: []
    }

    hierarchy.push(node)

    // Get direct downline
    const directDownline = await this.getDirectDownline(partner.id)
    
    for (const child of directDownline) {
      await this.buildHierarchyRecursive(
        child,
        node.children!,
        visited,
        currentDepth + 1,
        maxDepth,
        includeInactive
      )
    }
  }

  private async buildSponsorPath(sponsorId: string): Promise<string> {
    const sponsor = await this.getPartner(sponsorId)
    if (!sponsor) {
      return ''
    }
    
    return sponsor.sponsorPath ? `${sponsor.sponsorPath}/${sponsorId}` : sponsorId
  }

  private async getPartnerLevel(partnerId: string): Promise<number> {
    const partner = await this.getPartner(partnerId)
    return partner ? partner.level : 0
  }

  private async propagateVolumeUpdate(sponsorId: string | undefined, volumeDelta: number): Promise<void> {
    if (!sponsorId) return

    const sponsor = await this.getPartner(sponsorId)
    if (!sponsor) return

    // Update sponsor's team volume
    await this.updatePartner(sponsorId, {
      teamVolume: sponsor.teamVolume + volumeDelta
    })

    // Recursively update upline
    await this.propagateVolumeUpdate(sponsor.sponsorId, volumeDelta)
  }

  private async updateSponsorDownlineCounts(sponsorId: string, delta: number): Promise<void> {
    const sponsor = await this.getPartner(sponsorId)
    if (!sponsor) return

    await this.updatePartner(sponsorId, {
      directReferrals: Math.max(0, sponsor.directReferrals + delta),
      totalDownline: Math.max(0, sponsor.totalDownline + delta)
    })

    // Recursively update upline total downline counts
    if (sponsor.sponsorId) {
      await this.updateUplineTotalDownline(sponsor.sponsorId, delta)
    }
  }

  private async updateUplineTotalDownline(sponsorId: string, delta: number): Promise<void> {
    const sponsor = await this.getPartner(sponsorId)
    if (!sponsor) return

    await this.updatePartner(sponsorId, {
      totalDownline: Math.max(0, sponsor.totalDownline + delta)
    })

    if (sponsor.sponsorId) {
      await this.updateUplineTotalDownline(sponsor.sponsorId, delta)
    }
  }

  private async updateDownlineLevelsAndPaths(
    partnerId: string,
    newLevel: number,
    newPath: string
  ): Promise<void> {
    const directDownline = await this.getDirectDownline(partnerId)
    
    for (const child of directDownline) {
      const childNewLevel = newLevel + 1
      const childNewPath = `${newPath}/${child.id}`
      
      await this.updatePartner(child.id, {
        level: childNewLevel,
        sponsorPath: childNewPath
      })

      // Recursively update their downline
      await this.updateDownlineLevelsAndPaths(child.id, childNewLevel, childNewPath)
    }
  }

  private async hasCircularReference(partner: Partner): Promise<boolean> {
    const visited = new Set<string>()
    let current = partner
    
    while (current.sponsorId && !visited.has(current.id)) {
      visited.add(current.id)
      const sponsor = await this.getPartner(current.sponsorId)
      if (!sponsor) break
      
      if (sponsor.id === partner.id) {
        return true // Circular reference found
      }
      
      current = sponsor
    }
    
    return false
  }

  private generateId(): string {
    return 'partner_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  private async generatePartnerCode(): Promise<string> {
    const prefix = this.config.business.name.substr(0, 3).toUpperCase()
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substr(2, 3).toUpperCase()
    
    return `${prefix}${timestamp}${random}`
  }

  // These methods would typically interact with your database
  private async getPartner(partnerId: string): Promise<Partner | null> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async getAllPartners(): Promise<Partner[]> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async getDirectDownline(partnerId: string): Promise<Partner[]> {
    // Database query implementation
    throw new Error('Method should be implemented with actual database calls')
  }

  private async updatePartner(partnerId: string, updates: Partial<Partner>): Promise<Partner> {
    // Database update implementation
    throw new Error('Method should be implemented with actual database calls')
  }
}

export interface PartnerHierarchyNode {
  id: string
  sponsorId?: string
  level: number
  personalVolume: number
  teamVolume: number
  monthlyVolume: number
  activeDownline: number
  joinDate: Date
  status: string
  children?: PartnerHierarchyNode[]
}
