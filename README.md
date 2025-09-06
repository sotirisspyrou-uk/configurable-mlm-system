# Configurable MLM System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

A highly configurable, enterprise-grade Multi-Level Marketing (MLM) platform designed to be rapidly deployed across different industries. Built with modern TypeScript, Next.js 15, and Supabase for maximum scalability and maintainability.

## 🚀 Key Features

- **Industry-Agnostic Configuration** - Pre-built configurations for Financial Services, SaaS, E-commerce
- **Advanced Commission Engine** - Multi-level calculations with unlimited hierarchy depth
- **Sophisticated Partner Management** - Materialized path hierarchy for efficient network queries
- **Enterprise-Grade Fraud Detection** - Real-time pattern detection and automated responses
- **Real-Time Analytics Dashboard** - Partner performance metrics and network visualization

## 🏗️ Architecture

```
Frontend (Next.js 15) → API Routes → Business Logic Engines → Supabase Database
```

### Core Engines
- `CommissionCalculationEngine` - Multi-level MLM calculations
- `PartnerHierarchyManager` - Network management with materialized paths
- `ConfigurationManager` - Industry presets and validation
- `FraudDetectionEngine` - Pattern analysis and risk scoring

## 🛠️ Quick Start

1. **Clone and Install**
   ```bash
   git clone [your-repo-url]
   cd configurable-mlm-system
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Add your Supabase credentials
   ```

3. **Database Setup**
   ```bash
   npx supabase init
   npx supabase db reset
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## 📊 Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Frontend** | Next.js 15 + React 18 | Modern server-side rendering |
| **Backend** | Supabase + PostgreSQL | Serverless backend with real-time capabilities |
| **Language** | TypeScript | Type safety and developer experience |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Database** | PostgreSQL with RLS | Secure multi-tenant data isolation |

## 🎯 Portfolio Showcase

This project demonstrates:
- **Complex Business Logic**: MLM commission calculations and fraud detection
- **Enterprise Architecture**: Configuration-driven, scalable design patterns
- **TypeScript Mastery**: Comprehensive interfaces and type safety
- **Full-Stack Skills**: Frontend, backend, and database integration
- **Security Implementation**: Row-level security and compliance features

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Reusable React components
├── lib/
│   ├── engines/           # Business logic engines
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── supabase/              # Database migrations and functions
└── __tests__/             # Test suites
```

## 🧪 Testing

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run with coverage report
```

## 🚀 Deployment

Optimized for Vercel deployment:
1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main

## 📞 Contact

**Sotiris Spyrou**  
VerityAI  
Email: sotiris@verityai.co

---

**Built with ❤️ for portfolio showcase and job applications**
