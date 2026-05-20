// CRITICAL: Extend Express Request to include custom properties for multi-tenant pattern
// Allows middleware to attach tenantId to request object
declare namespace Express {
  export interface Request {
    tenantId?: string;
  }
}
