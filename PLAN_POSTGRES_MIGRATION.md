# PostgreSQL Migration Plan

## Current State
- Backend uses MongoDB with Mongoose ODM
- Models: Student, Schedule, Shift, Term, Location, CheckIn, AdminUser
- Frontend performs some calculations/data processing
- Environment variable: MONGO_URI/MONGODB_URI

## Proposed Changes
1. Replace MongoDB with PostgreSQL
2. Migrate from Mongoose to PostgreSQL ORM (recommend: Prisma)
3. Move frontend calculations to backend
4. Update all data access layers

## Files Affected

### Backend Changes
- `packages/express-backend/src/config/db.ts` - Database connection
- `packages/express-backend/src/models/*.ts` - All 7+ model files
- `packages/express-backend/src/routes/*.ts` - API route handlers
- `packages/express-backend/src/utils/*.ts` - Utilities using DB
- `packages/express-backend/src/jobs/*.ts` - Background jobs
- `packages/express-backend/package.json` - Dependencies

### Frontend Changes
- Components that currently do calculations/data processing
- API call adjustments for new response formats
- Removal of client-side processing logic

## Estimated Effort
- Database layer: 4-6 hours
- Model migrations: 8-12 hours  
- Route updates: 6-8 hours
- Utility/job updates: 2-4 hours
- Frontend updates: 4-6 hours
- Testing & debugging: 4-6 hours
- **Total: 28-42 hours**

## Phased Approach Recommendation

### Phase 1: Foundation
- [ ] Set up PostgreSQL locally
- [ ] Install and configure Prisma
- [ ] Create initial database schema
- [ ] Update db.ts to use Prisma

### Phase 2: Model Migration (one by one)
- [ ] Student model
- [ ] Schedule model  
- [ ] Shift model
- [ ] Term model
- [ ] Location model
- [ ] CheckIn model
- [ ] AdminUser model

### Phase 3: API & Logic Migration
- [ ] Update route handlers for each model
- [ ] Migrate frontend calculations to backend
- [ ] Create new endpoints for pre-processed data
- [ ] Update utility functions

### Phase 4: Frontend Updates
- [ ] Simplify components doing calculations
- [ ] Update API service calls
- [ ] Remove client-side processing
- [ ] Test data flows

### Phase 5: Testing & Optimization
- [ ] Run test suite
- [ ] Performance testing
- [ ] Data validation
- [ ] Error handling verification

## Risks & Mitigations
- **Data loss**: Backup MongoDB before migration
- **Breaking changes**: Implement feature flags or parallel run
- **Performance issues**: Add query optimization and indexing
- **Team coordination**: Clear communication and incremental PRs

## Dependencies to Add
- prisma
- @prisma/client  
- pg (PostgreSQL client)
- @types/pg (if using TypeScript)

## Dependencies to Remove
- mongoose
- @types/mongoose (if present)

## Environment Variables
- Replace MONGO_URI/MONGODB_URI with DATABASE_URL
- Add PostgreSQL-specific config if needed

---
*Created: $(date)*
*Scope: Architectural change from MongoDB to PostgreSQL with backend logic enhancement*