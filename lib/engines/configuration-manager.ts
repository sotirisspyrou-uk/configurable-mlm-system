// Configuration Management System
// File Path: /lib/engines/configuration-manager.ts
// Version: 2025-01-05 16:00:00

import { MLMSystemConfig, INDUSTRY_PRESETS, CONFIG_VALIDATION_RULES, DEFAULT_CONFIG } from '../types/config'

export interface ConfigurationSource {
  type: 'file' | 'database' | 'environment' | 'api'
  location: string
  priority: number
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  value: any
  rule: string
}

export interface ValidationWarning {
  field: string
  message: string
  value: any
  suggestion?: string
}

export interface ConfigurationChange {
  field: string
  oldValue: any
  newValue: any
  timestamp: Date
  userId: string
  reason?: string
}

export interface ConfigurationVersion {
  id: string
  version: number
  config: MLMSystemConfig
  changes: ConfigurationChange[]
  appliedAt: Date
  appliedBy: string
  description?: string
  isActive: boolean
}

export class ConfigurationManager {
  private currentConfig: MLMSystemConfig
  private configHistory: ConfigurationVersion[] = []
  private configSources: ConfigurationSource[] = []

  constructor(initialConfig?: MLMSystemConfig) {
    this.currentConfig = initialConfig || { ...DEFAULT_CONFIG }
  }

  /**
   * Load configuration from multiple sources with priority ordering
   */
  async loadConfiguration(): Promise<MLMSystemConfig> {
    let mergedConfig = { ...DEFAULT_CONFIG }

    // Sort sources by priority (lower number = higher priority)
    const sortedSources = this.configSources.sort((a, b) => a.priority - b.priority)

    for (const source of sortedSources) {
      try {
        const sourceConfig = await this.loadFromSource(source)
        mergedConfig = this.mergeConfigurations(mergedConfig, sourceConfig)
      } catch (error) {
        console.warn(`Failed to load configuration from ${source.type}:${source.location}`, error)
      }
    }

    // Validate the merged configuration
    const validation = this.validateConfiguration(mergedConfig)
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    this.currentConfig = mergedConfig
    return this.currentConfig
  }

  /**
   * Apply industry preset configuration
   */
  applyIndustryPreset(industry: keyof typeof INDUSTRY_PRESETS): MLMSystemConfig {
    const preset = INDUSTRY_PRESETS[industry]
    if (!preset) {
      throw new Error(`Unknown industry preset: ${industry}`)
    }

    const newConfig = this.mergeConfigurations(this.currentConfig, preset)
    
    // Validate the new configuration
    const validation = this.validateConfiguration(newConfig)
    if (!validation.isValid) {
      throw new Error(`Invalid configuration after applying preset: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    this.currentConfig = newConfig
    return this.currentConfig
  }

  /**
   * Update specific configuration sections
   */
  async updateConfiguration(
    updates: Partial<MLMSystemConfig>,
    userId: string,
    reason?: string
  ): Promise<MLMSystemConfig> {
    const changes: ConfigurationChange[] = []
    
    // Track changes
    this.trackChanges(this.currentConfig, updates, changes, '', userId, reason)
    
    // Apply updates
    const newConfig = this.mergeConfigurations(this.currentConfig, updates)
    
    // Validate updated configuration
    const validation = this.validateConfiguration(newConfig)
    if (!validation.isValid) {
      throw new Error(`Configuration update failed validation: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    // Create version history entry
    const version: ConfigurationVersion = {
      id: this.generateVersionId(),
      version: this.configHistory.length + 1,
      config: { ...newConfig },
      changes,
      appliedAt: new Date(),
      appliedBy: userId,
      description: reason,
      isActive: true
    }

    // Deactivate previous versions
    this.configHistory.forEach(v => v.isActive = false)
    
    // Add to history
    this.configHistory.push(version)
    
    // Update current configuration
    this.currentConfig = newConfig
    
    return this.currentConfig
  }

  /**
   * Validate configuration against rules and business logic
   */
  validateConfiguration(config: MLMSystemConfig): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Run predefined validation rules
    for (const rule of CONFIG_VALIDATION_RULES) {
      const fieldValue = this.getNestedValue(config, rule.field)
      const validationResult = this.validateField(fieldValue, rule)
      
      if (!validationResult.isValid) {
        errors.push({
          field: rule.field,
          message: rule.message,
          value: fieldValue,
          rule: rule.validator
        })
      }
    }

    // Business logic validations
    const businessValidation = this.validateBusinessLogic(config)
    errors.push(...businessValidation.errors)
    warnings.push(...businessValidation.warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get configuration value with path notation
   */
  getConfigValue<T>(path: string): T {
    return this.getNestedValue(this.currentConfig, path)
  }

  /**
   * Set configuration value with path notation
   */
  async setConfigValue(path: string, value: any, userId: string, reason?: string): Promise<void> {
    const updates = this.setNestedValue({}, path, value)
    await this.updateConfiguration(updates, userId, reason)
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): MLMSystemConfig {
    return { ...this.currentConfig }
  }

  /**
   * Rollback to a previous configuration version
   */
  async rollbackToVersion(versionId: string, userId: string): Promise<MLMSystemConfig> {
    const targetVersion = this.configHistory.find(v => v.id === versionId)
    if (!targetVersion) {
      throw new Error(`Configuration version ${versionId} not found`)
    }

    // Create rollback entry
    const rollbackVersion: ConfigurationVersion = {
      id: this.generateVersionId(),
      version: this.configHistory.length + 1,
      config: { ...targetVersion.config },
      changes: [{
        field: 'system',
        oldValue: this.currentConfig,
        newValue: targetVersion.config,
        timestamp: new Date(),
        userId,
        reason: `Rollback to version ${targetVersion.version}`
      }],
      appliedAt: new Date(),
      appliedBy: userId,
      description: `Rollback to version ${targetVersion.version}`,
      isActive: true
    }

    // Deactivate current version
    this.configHistory.forEach(v => v.isActive = false)
    
    // Add rollback to history
    this.configHistory.push(rollbackVersion)
    
    // Update current configuration
    this.currentConfig = { ...targetVersion.config }
    
    return this.currentConfig
  }

  /**
   * Export configuration for backup or migration
   */
  exportConfiguration(includeHistory: boolean = false): string {
    const exportData = {
      current: this.currentConfig,
      exportedAt: new Date().toISOString(),
      version: this.configHistory.length > 0 ? this.configHistory[this.configHistory.length - 1].version : 1
    }

    if (includeHistory) {
      (exportData as any).history = this.configHistory
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import configuration from exported data
   */
  async importConfiguration(
    exportedData: string,
    userId: string,
    overwriteHistory: boolean = false
  ): Promise<MLMSystemConfig> {
    try {
      const data = JSON.parse(exportedData)
      
      if (!data.current) {
        throw new Error('Invalid export data: missing current configuration')
      }

      // Validate imported configuration
      const validation = this.validateConfiguration(data.current)
      if (!validation.isValid) {
        throw new Error(`Imported configuration is invalid: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // Import history if requested and available
      if (overwriteHistory && data.history) {
        this.configHistory = data.history
      }

      // Apply imported configuration
      await this.updateConfiguration(data.current, userId, 'Configuration imported')
      
      return this.currentConfig
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`)
    }
  }

  /**
   * Add configuration source
   */
  addConfigurationSource(source: ConfigurationSource): void {
    // Remove existing source of same type and location
    this.configSources = this.configSources.filter(
      s => !(s.type === source.type && s.location === source.location)
    )
    
    this.configSources.push(source)
  }

  /**
   * Remove configuration source
   */
  removeConfigurationSource(type: ConfigurationSource['type'], location: string): void {
    this.configSources = this.configSources.filter(
      s => !(s.type === type && s.location === location)
    )
  }

  /**
   * Get configuration history
   */
  getConfigurationHistory(): ConfigurationVersion[] {
    return [...this.configHistory]
  }

  /**
   * Compare two configuration versions
   */
  compareConfigurations(config1: MLMSystemConfig, config2: MLMSystemConfig): ConfigurationChange[] {
    const changes: ConfigurationChange[] = []
    this.trackChanges(config1, config2, changes, '', 'system', 'Configuration comparison')
    return changes
  }

  // Private helper methods

  private async loadFromSource(source: ConfigurationSource): Promise<Partial<MLMSystemConfig>> {
    switch (source.type) {
      case 'file':
        return this.loadFromFile(source.location)
      case 'database':
        return this.loadFromDatabase(source.location)
      case 'environment':
        return this.loadFromEnvironment()
      case 'api':
        return this.loadFromAPI(source.location)
      default:
        throw new Error(`Unsupported configuration source type: ${source.type}`)
    }
  }

  private async loadFromFile(filePath: string): Promise<Partial<MLMSystemConfig>> {
    // File loading implementation would go here
    // For demo purposes, return empty object
    return {}
  }

  private async loadFromDatabase(connectionString: string): Promise<Partial<MLMSystemConfig>> {
    // Database loading implementation would go here
    // For demo purposes, return empty object
    return {}
  }

  private loadFromEnvironment(): Partial<MLMSystemConfig> {
    const envConfig: Partial<MLMSystemConfig> = {}
    
    // Map environment variables to configuration
    if (process.env.MLM_BUSINESS_NAME) {
      envConfig.business = {
        ...envConfig.business,
        name: process.env.MLM_BUSINESS_NAME
      } as any
    }
    
    if (process.env.MLM_CURRENCY) {
      envConfig.business = {
        ...envConfig.business,
        currency: process.env.MLM_CURRENCY as any
      } as any
    }
    
    if (process.env.MLM_MIN_PAYOUT) {
      envConfig.commission = {
        ...envConfig.commission,
        minimumPayout: parseFloat(process.env.MLM_MIN_PAYOUT)
      } as any
    }

    return envConfig
  }

  private async loadFromAPI(apiUrl: string): Promise<Partial<MLMSystemConfig>> {
    // API loading implementation would go here
    // For demo purposes, return empty object
    return {}
  }

  private mergeConfigurations(base: MLMSystemConfig, updates: Partial<MLMSystemConfig>): MLMSystemConfig {
    return this.deepMerge(base, updates) as MLMSystemConfig
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }

  private trackChanges(
    oldConfig: any,
    newConfig: any,
    changes: ConfigurationChange[],
    path: string,
    userId: string,
    reason?: string
  ): void {
    for (const key in newConfig) {
      const currentPath = path ? `${path}.${key}` : key
      const oldValue = oldConfig?.[key]
      const newValue = newConfig[key]
      
      if (typeof newValue === 'object' && !Array.isArray(newValue) && newValue !== null) {
        this.trackChanges(oldValue || {}, newValue, changes, currentPath, userId, reason)
      } else if (oldValue !== newValue) {
        changes.push({
          field: currentPath,
          oldValue,
          newValue,
          timestamp: new Date(),
          userId,
          reason
        })
      }
    }
  }

  private validateField(value: any, rule: any): { isValid: boolean } {
    switch (rule.validator) {
      case 'required':
        return { isValid: value !== undefined && value !== null && value !== '' }
      
      case 'range':
        if (typeof value !== 'number') return { isValid: false }
        const { min, max } = rule.params
        return { isValid: value >= min && value <= max }
      
      case 'format':
        if (typeof value !== 'string') return { isValid: false }
        const regex = new RegExp(rule.params.pattern)
        return { isValid: regex.test(value) }
      
      case 'custom':
        return rule.params.validator(value)
      
      default:
        return { isValid: true }
    }
  }

  private validateBusinessLogic(config: MLMSystemConfig): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Validate commission tiers
    const tierLevels = config.commission.tiers.map(t => t.level)
    const uniqueLevels = new Set(tierLevels)
    if (tierLevels.length !== uniqueLevels.size) {
      errors.push({
        field: 'commission.tiers',
        message: 'Duplicate commission tier levels found',
        value: tierLevels,
        rule: 'business_logic'
      })
    }

    // Validate hierarchy depth vs commission levels
    const maxCommissionLevel = Math.max(...tierLevels)
    if (maxCommissionLevel > config.partner.maxHierarchyLevels) {
      warnings.push({
        field: 'commission.tiers',
        message: 'Commission tiers extend beyond maximum hierarchy levels',
        value: maxCommissionLevel,
        suggestion: `Consider reducing max commission level to ${config.partner.maxHierarchyLevels} or increasing max hierarchy levels`
      })
    }

    // Validate payout schedule
    if (config.commission.payoutSchedule.frequency === 'monthly' && 
        config.commission.payoutSchedule.dayOfMonth! > 28) {
      warnings.push({
        field: 'commission.payoutSchedule.dayOfMonth',
        message: 'Monthly payout day may not exist in all months',
        value: config.commission.payoutSchedule.dayOfMonth,
        suggestion: 'Consider using day 28 or earlier for consistent monthly payouts'
      })
    }

    // Validate minimum payout vs commission rates
    const avgCommissionRate = config.commission.tiers.reduce((sum, tier) => sum + tier.commissionRate, 0) / config.commission.tiers.length
    const estimatedTransactionForMinPayout = config.commission.minimumPayout / avgCommissionRate
    if (estimatedTransactionForMinPayout > 10000) {
      warnings.push({
        field: 'commission.minimumPayout',
        message: 'Minimum payout may be too high relative to commission rates',
        value: config.commission.minimumPayout,
        suggestion: `Consider lowering minimum payout or increasing commission rates. Estimated transaction value needed: $${estimatedTransactionForMinPayout.toFixed(2)}`
      })
    }

    return { errors, warnings }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    
    target[lastKey] = value
    return obj
  }

  private generateVersionId(): string {
    return 'version_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }
}

// Configuration utility functions
export const ConfigurationUtils = {
  /**
   * Create a minimal configuration for testing
   */
  createTestConfiguration(overrides?: Partial<MLMSystemConfig>): MLMSystemConfig {
    return {
      ...DEFAULT_CONFIG,
      business: {
        ...DEFAULT_CONFIG.business,
        name: 'Test MLM System',
        industry: 'other'
      },
      commission: {
        ...DEFAULT_CONFIG.commission,
        minimumPayout: 10,
        holdingPeriod: 0
      },
      ...overrides
    }
  },

  /**
   * Sanitize configuration for public API
   */
  sanitizeConfiguration(config: MLMSystemConfig): Partial<MLMSystemConfig> {
    const sanitized = { ...config }
    
    // Remove sensitive data
    delete (sanitized as any).integrations
    
    // Remove internal metadata
    if (sanitized.compliance) {
      sanitized.compliance = {
        ...sanitized.compliance,
        reportingRequirements: []
      }
    }
    
    return sanitized
  },

  /**
   * Generate configuration diff report
   */
  generateDiffReport(oldConfig: MLMSystemConfig, newConfig: MLMSystemConfig): string {
    const manager = new ConfigurationManager()
    const changes = manager.compareConfigurations(oldConfig, newConfig)
    
    let report = 'Configuration Changes:\n'
    report += '='.repeat(50) + '\n\n'
    
    for (const change of changes) {
      report += `Field: ${change.field}\n`
      report += `Old Value: ${JSON.stringify(change.oldValue)}\n`
      report += `New Value: ${JSON.stringify(change.newValue)}\n`
      report += `Timestamp: ${change.timestamp.toISOString()}\n`
      if (change.reason) {
        report += `Reason: ${change.reason}\n`
      }
      report += '\n'
    }
    
    return report
  }
}
