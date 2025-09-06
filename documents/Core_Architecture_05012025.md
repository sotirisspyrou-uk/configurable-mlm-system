# Configurable MLM System - Core Architecture
*Version: 2025-01-05 15:45:00*
*File Path: //documents/Core_Architecture_05012025.md*
*Authored by: Sotiris Spyrou, CEO, VerityAI*

## System Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Configuration     │    │   Business Logic    │    │   Data Layer        │
│   Management        │◄──►│   Engine            │◄──►│                     │
│                     │    │                     │    │ • Partner Hierarchy │
│ • Industry Presets  │    │ • Commission Calc   │    │ • Commission Data   │
│ • Custom Rules      │    │ • Fraud Detection   │    │ • Transaction Logs  │
│ • Validation        │    │ • Compliance Check  │    │ • Compliance Events │
│ • Schema Management │    │ • Notification Send │    │ • Configuration     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
            │                         │                         │
            │                         │                         │
            ▼                         ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Frontend Layer    │    │   API Gateway       │    │   External APIs     │
│                     │    │                     │    │                     │
│ • Admin Dashboard   │    │ • Authentication    │    │ • Payment Processor │
│ • Partner Portal    │    │ • Rate Limiting     │    │ • Email Service     │
│ • Analytics UI      │    │ • Request Routing   │    │ • SMS Provider      │
│ • Configuration UI  │    │ • Response Caching │    │ • Banking APIs      │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Core Design Principles

### 1. Configuration-Driven Architecture
- **Zero Hardcoding**: All business rules stored in configuration
- **Runtime Reconfiguration**: Changes applied without code deployment
- **Industry Adaptation**: Preset configurations for different sectors
- **Custom Rule Engine**: Flexible rule definition and validation

### 2. Separation of Concerns
```
/src
├── /config           # Configuration management
├── /core            # Business logic engines
├── /data            # Data access and models
├── /api             # API routes and controllers
├── /components      # Reusable UI components
├── /pages           # Next.js pages and layouts
├── /utils           # Utility functions
└── /types           # TypeScript definitions
```

### 3. Modular Business Logic
```typescript
// Core Engine Interface
interface MLMEngine {
  calculateCommissions(transaction: Transaction): CommissionDistribution
  validatePartner(partner: Partner): ValidationResult
  detectFraud(activity: Activity): FraudAssessment
  processCompliance(event: Event): ComplianceResult
}

// Configurable Implementation
class ConfigurableMLMEngine implements MLMEngine {
  constructor(private config: MLMSystemConfig) {}
  
  calculateCommissions(transaction: Transaction): CommissionDistribution {
    return this.commissionCalculator.calculate(transaction, this.config.commission)
  }
}
```

## Key Components

### Configuration Management System
```typescript
class ConfigurationManager {
  // Load configuration from various sources
  async loadConfig(source: 'file' | 'database' | 'api'): Promise<MLMSystemConfig>
  
  // Validate configuration against schema
  validateConfig(config: MLMSystemConfig): ValidationResult
  
  // Apply configuration changes at runtime
  applyConfig(config: MLMSystemConfig): Promise<void>
  
  // Industry preset management
  getIndustryPreset(industry: string): Partial<MLMSystemConfig>
  
  // Custom rule compilation
  compileRules(rules: CustomRule[]): CompiledRuleSet
}
```

### Commission Calculation Engine
```typescript
class CommissionCalculator {
  // Multi-level commission distribution
  calculateMLMCommissions(
    transaction: Transaction,
    hierarchy: PartnerHierarchy,
    config: CommissionConfig
  ): CommissionDistribution
  
  // Bonus calculation
  calculateBonuses(
    partner: Partner,
    performance: PerformanceMetrics,
    bonusRules: BonusRule[]
  ): BonusCalculation[]
  
  // Residual income processing
  calculateResiduals(
    subscriptions: Subscription[],
    config: ResidualConfig
  ): ResidualCommission[]
}
```

### Fraud Detection System
```typescript
class FraudDetectionEngine {
  // Pattern analysis
  analyzePatterns(activities: Activity[]): PatternAnalysis
  
  // Risk scoring
  calculateRiskScore(partner: Partner, context: ActivityContext): RiskScore
  
  // Anomaly detection
  detectAnomalies(transactions: Transaction[]): Anomaly[]
  
  // Configurable threshold checking
  checkThresholds(
    metrics: FraudMetrics,
    thresholds: FraudThreshold[]
  ): ThresholdViolation[]
}
```

### Compliance Management
```typescript
class ComplianceManager {
  // Document verification
  verifyDocuments(partner: Partner, requirements: DocumentRequirement[]): VerificationResult
  
  // KYC/AML processing
  processKYC(partner: Partner): KYCResult
  processAML(transactions: Transaction[]): AMLResult
  
  // Regulatory reporting
  generateReports(period: DateRange, requirements: ReportingRequirement[]): Report[]
  
  // Audit trail management
  logEvent(event: ComplianceEvent): void
  getAuditTrail(partner: Partner, period: DateRange): AuditTrail
}
```

## Data Model Architecture

### Flexible Schema Design
```sql
-- Configuration storage
CREATE TABLE system_configurations (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  config_data JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Partner hierarchy with materialized path
CREATE TABLE partners (
  id UUID PRIMARY KEY,
  config_id UUID REFERENCES system_configurations(id),
  partner_code VARCHAR(50) UNIQUE NOT NULL,
  sponsor_path TEXT, -- Materialized path for efficient queries
  level_in_hierarchy INTEGER,
  status VARCHAR(50),
  metadata JSONB, -- Flexible partner data
  created_at TIMESTAMP DEFAULT NOW()
);

-- Flexible commission tracking
CREATE TABLE commissions (
  id UUID PRIMARY KEY,
  partner_id UUID REFERENCES partners(id),
  transaction_id UUID,
  commission_type VARCHAR(100),
  amount DECIMAL(15,4),
  currency VARCHAR(3),
  calculation_data JSONB, -- Commission breakdown
  status VARCHAR(50),
  processed_at TIMESTAMP
);

-- Configurable compliance events
CREATE TABLE compliance_events (
  id UUID PRIMARY KEY,
  partner_id UUID REFERENCES partners(id),
  event_type VARCHAR(100),
  severity VARCHAR(50),
  data JSONB, -- Flexible event data
  status VARCHAR(50),
  resolved_at TIMESTAMP
);
```

### Configuration Versioning
```typescript
interface ConfigurationVersion {
  id: string
  configId: string
  version: number
  changes: ConfigurationChange[]
  appliedAt: Date
  appliedBy: string
  rollbackData?: MLMSystemConfig
}

class ConfigurationVersionManager {
  // Track configuration changes
  createVersion(config: MLMSystemConfig): ConfigurationVersion
  
  // Rollback to previous version
  rollback(configId: string, targetVersion: number): Promise<void>
  
  // Compare configurations
  compareVersions(v1: number, v2: number): ConfigurationDiff
}
```

## Deployment Architecture

### Environment Configuration
```typescript
// Development Environment
export const DEV_CONFIG = {
  database: 'local_postgres',
  paymentProcessor: 'stripe_test',
  emailProvider: 'console_output',
  fraudDetection: 'mock_service'
}

// Portfolio Demo Environment  
export const DEMO_CONFIG = {
  database: 'supabase_demo',
  paymentProcessor: 'mock_payments',
  emailProvider: 'mock_email',
  fraudDetection: 'rule_based'
}

// Production Environment
export const PROD_CONFIG = {
  database: 'supabase_production',
  paymentProcessor: 'stripe_live',
  emailProvider: 'sendgrid',
  fraudDetection: 'ml_service'
}
```

### Scalability Considerations
```typescript
// Horizontal scaling patterns
interface ScalingStrategy {
  commissionCalculation: 'queue_based' | 'real_time' | 'batch_processing'
  dataPartitioning: 'by_partner' | 'by_time' | 'by_geography'
  caching: 'redis' | 'memcached' | 'in_memory'
  loadBalancing: 'round_robin' | 'least_connections' | 'geographic'
}

// Performance optimization
class PerformanceOptimizer {
  // Query optimization
  optimizeHierarchyQueries(maxDepth: number): QueryStrategy
  
  // Commission calculation optimization
  optimizeCommissionBatch(batchSize: number): BatchStrategy
  
  // Cache strategy
  configureCaching(strategy: CachingStrategy): CacheConfig
}
```

## Security Architecture

### Multi-Tenant Security
```typescript
interface SecurityConfig {
  authentication: {
    provider: 'supabase' | 'auth0' | 'cognito'
    mfaRequired: boolean
    sessionTimeout: number
  }
  authorization: {
    rbac: boolean
    dataIsolation: 'row_level' | 'schema_level' | 'database_level'
    auditLogging: boolean
  }
  encryption: {
    dataAtRest: boolean
    dataInTransit: boolean
    keyManagement: 'aws_kms' | 'vault' | 'local'
  }
}
```

### Row Level Security Implementation
```sql
-- Partner data isolation
CREATE POLICY "Partners see own hierarchy" ON partners
  FOR ALL USING (
    sponsor_path LIKE '%' || auth.uid()::text || '%' OR 
    id = auth.uid()
  );

-- Commission data isolation  
CREATE POLICY "Commission access by ownership" ON commissions
  FOR ALL USING (
    partner_id IN (
      SELECT id FROM partners WHERE sponsor_path LIKE '%' || auth.uid()::text || '%'
    )
  );
```

This architecture ensures the system can be rapidly configured for any industry while maintaining security, performance, and scalability requirements for a professional portfolio demonstration.
