'use strict';

const { RbacEngine, ROLES, PERMISSIONS } = require('../../src/common/utils/rbac.util');

describe('RbacEngine (Unit)', () => {
  it('allows EMPLOYEE basic self-service permissions', () => {
    expect(RbacEngine.hasPermission(ROLES.EMPLOYEE, PERMISSIONS.REQUEST_LEAVE)).toBe(true);
    expect(RbacEngine.hasPermission(ROLES.EMPLOYEE, PERMISSIONS.VIEW_OWN_BALANCE)).toBe(true);
  });

  it('denies EMPLOYEE elevated manager or admin permissions', () => {
    expect(RbacEngine.hasPermission(ROLES.EMPLOYEE, PERMISSIONS.APPROVE_TEAM_LEAVE)).toBe(false);
    expect(RbacEngine.hasPermission(ROLES.EMPLOYEE, PERMISSIONS.OVERRIDE_POLICY)).toBe(false);
  });

  it('MANAGER inherits all EMPLOYEE permissions plus approval', () => {
    expect(RbacEngine.hasPermission(ROLES.MANAGER, PERMISSIONS.REQUEST_LEAVE)).toBe(true);
    expect(RbacEngine.hasPermission(ROLES.MANAGER, PERMISSIONS.APPROVE_TEAM_LEAVE)).toBe(true);
  });

  it('HR_ADMIN inherits MANAGER and EMPLOYEE permissions', () => {
    expect(RbacEngine.hasPermission(ROLES.HR_ADMIN, PERMISSIONS.APPROVE_TEAM_LEAVE)).toBe(true);
    expect(RbacEngine.hasPermission(ROLES.HR_ADMIN, PERMISSIONS.MANAGE_ACCRUALS)).toBe(true);
  });

  it('SYSTEM_ADMIN has all lower permissions plus audit logs', () => {
    expect(RbacEngine.hasPermission(ROLES.SYSTEM_ADMIN, PERMISSIONS.AUDIT_LOG_READ)).toBe(true);
    expect(RbacEngine.hasPermission(ROLES.SYSTEM_ADMIN, PERMISSIONS.REQUEST_LEAVE)).toBe(true);
  });

  it('verifies role hierarchy levels accurately', () => {
    expect(RbacEngine.hasRole(ROLES.SYSTEM_ADMIN, ROLES.EMPLOYEE)).toBe(true);
    expect(RbacEngine.hasRole(ROLES.EMPLOYEE, ROLES.MANAGER)).toBe(false);
  });
});
