/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // Users table indexes
    await queryInterface.addIndex('users', ['email'], { name: 'idx_users_email' });
    await queryInterface.addIndex('users', ['user_level'], { name: 'idx_users_user_level' });
    await queryInterface.addIndex('users', ['assigned_province_id'], { name: 'idx_users_assigned_province' });
    await queryInterface.addIndex('users', ['assigned_regency_id'], { name: 'idx_users_assigned_regency' });
    await queryInterface.addIndex('users', ['assigned_district_id'], { name: 'idx_users_assigned_district' });
    await queryInterface.addIndex('users', ['assigned_village_id'], { name: 'idx_users_assigned_village' });
    await queryInterface.addIndex('users', ['is_active'], { name: 'idx_users_is_active' });

    // Roles table indexes
    await queryInterface.addIndex('roles', ['name'], { name: 'idx_roles_name' });
    await queryInterface.addIndex('roles', ['category_id'], { name: 'idx_roles_category' });
    await queryInterface.addIndex('roles', ['is_system_role'], { name: 'idx_roles_is_system' });
    await queryInterface.addIndex('roles', ['is_active'], { name: 'idx_roles_is_active' });

    // Permissions table indexes
    await queryInterface.addIndex('permissions', ['resource'], { name: 'idx_permissions_resource' });
    await queryInterface.addIndex('permissions', ['action'], { name: 'idx_permissions_action' });
    await queryInterface.addIndex('permissions', ['scope'], { name: 'idx_permissions_scope' });
    await queryInterface.addIndex('permissions', ['is_critical'], { name: 'idx_permissions_is_critical' });

    // Role permissions table indexes
    await queryInterface.addIndex('role_permissions', ['role_id'], { name: 'idx_role_permissions_role' });
    await queryInterface.addIndex('role_permissions', ['permission_id'], { name: 'idx_role_permissions_permission' });
    await queryInterface.addIndex('role_permissions', ['is_active'], { name: 'idx_role_permissions_active' });

    // User roles table indexes
    await queryInterface.addIndex('user_roles', ['user_id'], { name: 'idx_user_roles_user' });
    await queryInterface.addIndex('user_roles', ['role_id'], { name: 'idx_user_roles_role' });
    await queryInterface.addIndex('user_roles', ['is_active'], { name: 'idx_user_roles_active' });

    // Sessions table indexes
    await queryInterface.addIndex('user_sessions', ['user_id'], { name: 'idx_sessions_user' });
    await queryInterface.addIndex('user_sessions', ['session_token'], { name: 'idx_sessions_token' });
    await queryInterface.addIndex('user_sessions', ['refresh_token'], { name: 'idx_sessions_refresh' });
    await queryInterface.addIndex('user_sessions', ['is_active'], { name: 'idx_sessions_active' });
    await queryInterface.addIndex('user_sessions', ['expires_at'], { name: 'idx_sessions_expires' });

    // Audit logs table indexes
    await queryInterface.addIndex('audit_logs', ['user_id'], { name: 'idx_audit_logs_user' });
    await queryInterface.addIndex('audit_logs', ['action'], { name: 'idx_audit_logs_action' });
    await queryInterface.addIndex('audit_logs', ['resource_type'], { name: 'idx_audit_logs_resource' });
    await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'idx_audit_logs_created' });

    // Geographic tables indexes
    await queryInterface.addIndex('regencies', ['province_id'], { name: 'idx_regencies_province' });
    await queryInterface.addIndex('districts', ['regency_id'], { name: 'idx_districts_regency' });
    await queryInterface.addIndex('villages', ['district_id'], { name: 'idx_villages_district' });
  },

  async down(queryInterface, _Sequelize) {
    // Drop indexes in reverse order
    await queryInterface.removeIndex('villages', 'idx_villages_district');
    await queryInterface.removeIndex('districts', 'idx_districts_regency');
    await queryInterface.removeIndex('regencies', 'idx_regencies_province');

    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_created');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_resource');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_action');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_user');

    await queryInterface.removeIndex('user_sessions', 'idx_sessions_expires');
    await queryInterface.removeIndex('user_sessions', 'idx_sessions_active');
    await queryInterface.removeIndex('user_sessions', 'idx_sessions_refresh');
    await queryInterface.removeIndex('user_sessions', 'idx_sessions_token');
    await queryInterface.removeIndex('user_sessions', 'idx_sessions_user');

    await queryInterface.removeIndex('user_roles', 'idx_user_roles_active');
    await queryInterface.removeIndex('user_roles', 'idx_user_roles_role');
    await queryInterface.removeIndex('user_roles', 'idx_user_roles_user');

    await queryInterface.removeIndex('role_permissions', 'idx_role_permissions_active');
    await queryInterface.removeIndex('role_permissions', 'idx_role_permissions_permission');
    await queryInterface.removeIndex('role_permissions', 'idx_role_permissions_role');

    await queryInterface.removeIndex('permissions', 'idx_permissions_is_critical');
    await queryInterface.removeIndex('permissions', 'idx_permissions_scope');
    await queryInterface.removeIndex('permissions', 'idx_permissions_action');
    await queryInterface.removeIndex('permissions', 'idx_permissions_resource');

    await queryInterface.removeIndex('roles', 'idx_roles_is_active');
    await queryInterface.removeIndex('roles', 'idx_roles_is_system');
    await queryInterface.removeIndex('roles', 'idx_roles_category');
    await queryInterface.removeIndex('roles', 'idx_roles_name');

    await queryInterface.removeIndex('users', 'idx_users_is_active');
    await queryInterface.removeIndex('users', 'idx_users_assigned_village');
    await queryInterface.removeIndex('users', 'idx_users_assigned_district');
    await queryInterface.removeIndex('users', 'idx_users_assigned_regency');
    await queryInterface.removeIndex('users', 'idx_users_assigned_province');
    await queryInterface.removeIndex('users', 'idx_users_user_level');
    await queryInterface.removeIndex('users', 'idx_users_email');
  },
};
