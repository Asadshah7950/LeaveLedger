'use strict';

/**
 * Enterprise Hierarchical Role-Based Access Control (RBAC).
 * Supports role inheritance (SYSTEM_ADMIN > HR_ADMIN > MANAGER > EMPLOYEE)
 * and fine-grained resource permission checks.
 */

const ROLES = Object.freeze({
  EMPLOYEE: 'EMPLOYEE',
  MANAGER: 'MANAGER',
  HR_ADMIN: 'HR_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
});

// Role hierarchy levels (higher inherits lower permissions)
const ROLE_HIERARCHY = {
  [ROLES.EMPLOYEE]: 10,
  [ROLES.MANAGER]: 20,
  [ROLES.HR_ADMIN]: 30,
  [ROLES.SYSTEM_ADMIN]: 40,
};

const PERMISSIONS = Object.freeze({
  REQUEST_LEAVE: 'REQUEST_LEAVE',
  VIEW_OWN_BALANCE: 'VIEW_OWN_BALANCE',
  APPROVE_TEAM_LEAVE: 'APPROVE_TEAM_LEAVE',
  OVERRIDE_POLICY: 'OVERRIDE_POLICY',
  MANAGE_ACCRUALS: 'MANAGE_ACCRUALS',
  AUDIT_LOG_READ: 'AUDIT_LOG_READ',
});

const ROLE_PERMISSIONS = {
  [ROLES.EMPLOYEE]: new Set([PERMISSIONS.REQUEST_LEAVE, PERMISSIONS.VIEW_OWN_BALANCE]),
  [ROLES.MANAGER]: new Set([PERMISSIONS.APPROVE_TEAM_LEAVE]),
  [ROLES.HR_ADMIN]: new Set([PERMISSIONS.OVERRIDE_POLICY, PERMISSIONS.MANAGE_ACCRUALS]),
  [ROLES.SYSTEM_ADMIN]: new Set([PERMISSIONS.AUDIT_LOG_READ]),
};

class RbacEngine {
  static hasRole(userRole, requiredRole) {
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
  }

  static hasPermission(userRole, permission) {
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      if (userLevel >= ROLE_HIERARCHY[role] && perms.has(permission)) {
        return true;
      }
    }
    return false;
  }
}

module.exports = { RbacEngine, ROLES, PERMISSIONS };
