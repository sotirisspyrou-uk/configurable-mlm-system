-- Initial schema for Configurable MLM System
-- Created: 2025-01-05

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Partners table with materialized path for efficient hierarchy queries
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    partner_code VARCHAR(50) UNIQUE NOT NULL,
    sponsor_id UUID REFERENCES partners(id),
    sponsor_path TEXT, -- Materialized path: "/parent_id/grandparent_id/"
    level_in_hierarchy INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
    personal_volume DECIMAL(15,4) DEFAULT 0,
    team_volume DECIMAL(15,4) DEFAULT 0,
    monthly_volume DECIMAL(15,4) DEFAULT 0,
    direct_referrals INTEGER DEFAULT 0,
    total_downline INTEGER DEFAULT 0,
    active_downline INTEGER DEFAULT 0,
    compliance_score DECIMAL(3,2) DEFAULT 1.0 CHECK (compliance_score >= 0 AND compliance_score <= 1),
    risk_score DECIMAL(3,2) DEFAULT 0.0 CHECK (risk_score >= 0 AND risk_score <= 1),
    join_date TIMESTAMP DEFAULT NOW(),
    last_activity_date TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Commissions table for tracking all commission payments
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID REFERENCES partners(id) NOT NULL,
    transaction_id VARCHAR(100),
    commission_type VARCHAR(50) NOT NULL, -- 'direct', 'level_2', 'bonus', 'residual'
    level INTEGER NOT NULL,
    tier_name VARCHAR(100),
    base_amount DECIMAL(15,4) NOT NULL,
    commission_rate DECIMAL(6,4) NOT NULL,
    commission_amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    payment_date TIMESTAMP,
    calculation_data JSONB, -- Store detailed calculation breakdown
    created_at TIMESTAMP DEFAULT NOW()
);

-- System configurations with versioning
CREATE TABLE system_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    config_data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fraud alerts and monitoring
CREATE TABLE fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID REFERENCES partners(id) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    risk_score DECIMAL(3,2) NOT NULL,
    description TEXT,
    evidence JSONB,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table for tracking all financial activities
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID REFERENCES partners(id) NOT NULL,
    customer_email VARCHAR(255),
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    product_id VARCHAR(100),
    transaction_type VARCHAR(50) NOT NULL, -- 'sale', 'referral', 'deposit'
    status VARCHAR(20) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_partners_sponsor_path ON partners USING GIN (sponsor_path);
CREATE INDEX idx_partners_sponsor_id ON partners(sponsor_id);
CREATE INDEX idx_partners_level ON partners(level_in_hierarchy);
CREATE INDEX idx_partners_status ON partners(status);
CREATE INDEX idx_commissions_partner_id ON commissions(partner_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_created ON commissions(created_at);
CREATE INDEX idx_fraud_alerts_partner ON fraud_alerts(partner_id);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity, status);
CREATE INDEX idx_transactions_partner ON transactions(partner_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners table
CREATE POLICY "Partners can view own data" ON partners FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Partners can update own data" ON partners FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for commissions
CREATE POLICY "Partners can view own commissions" ON commissions FOR SELECT 
USING (EXISTS (SELECT 1 FROM partners WHERE partners.id = commissions.partner_id AND partners.user_id = auth.uid()));

-- Functions for hierarchy management
CREATE OR REPLACE FUNCTION update_partner_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sponsor path when sponsor changes
    IF NEW.sponsor_id IS NOT NULL THEN
        SELECT COALESCE(sponsor_path, '') || '/' || NEW.sponsor_id::text || '/'
        INTO NEW.sponsor_path
        FROM partners 
        WHERE id = NEW.sponsor_id;
        
        -- Update level based on sponsor
        SELECT level_in_hierarchy + 1
        INTO NEW.level_in_hierarchy
        FROM partners 
        WHERE id = NEW.sponsor_id;
    ELSE
        NEW.sponsor_path = '';
        NEW.level_in_hierarchy = 1;
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic hierarchy management
CREATE TRIGGER trigger_update_partner_hierarchy
    BEFORE INSERT OR UPDATE ON partners
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_hierarchy();

-- Function to get partner hierarchy
CREATE OR REPLACE FUNCTION get_partner_hierarchy(partner_uuid UUID, max_depth INTEGER DEFAULT 5)
RETURNS TABLE (
    id UUID,
    partner_code VARCHAR(50),
    level_in_hierarchy INTEGER,
    personal_volume DECIMAL(15,4),
    team_volume DECIMAL(15,4),
    direct_referrals INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE hierarchy AS (
        -- Base case: the partner itself
        SELECT p.id, p.partner_code, p.level_in_hierarchy, p.personal_volume, p.team_volume, p.direct_referrals, 0 as depth
        FROM partners p
        WHERE p.id = partner_uuid
        
        UNION ALL
        
        -- Recursive case: direct downline
        SELECT p.id, p.partner_code, p.level_in_hierarchy, p.personal_volume, p.team_volume, p.direct_referrals, h.depth + 1
        FROM partners p
        INNER JOIN hierarchy h ON p.sponsor_id = h.id
        WHERE h.depth < max_depth
    )
    SELECT h.id, h.partner_code, h.level_in_hierarchy, h.personal_volume, h.team_volume, h.direct_referrals
    FROM hierarchy h
    ORDER BY h.level_in_hierarchy, h.partner_code;
END;
$$ LANGUAGE plpgsql;

-- Insert default system configuration
INSERT INTO system_configurations (name, industry, config_data, is_active, version) VALUES (
    'Default Configuration',
    'demo',
    '{
        "business": {
            "name": "Demo MLM System",
            "industry": "other",
            "currency": "USD",
            "timezone": "UTC",
            "primaryColor": "#3B82F6"
        },
        "commission": {
            "structure": "percentage",
            "minimumPayout": 50,
            "holdingPeriod": 30,
            "tiers": [
                {
                    "level": 1,
                    "name": "Direct Referral",
                    "commissionRate": 0.10,
                    "commissionType": "percentage"
                }
            ]
        },
        "partner": {
            "maxHierarchyLevels": 7,
            "autoActivation": false
        },
        "compliance": {
            "auditTrail": true,
            "fraudThresholds": []
        }
    }',
    true,
    1
);
