/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // Create permission check functions
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION can_access_location(
          user_id VARCHAR(12),
          target_province_id VARCHAR(12),
          target_regency_id VARCHAR(12),
          target_district_id VARCHAR(12),
          target_village_id VARCHAR(12)
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
          user_level VARCHAR(20);
          user_province_id VARCHAR(12);
          user_regency_id VARCHAR(12);
          user_district_id VARCHAR(12);
          user_village_id VARCHAR(12);
          can_inherit BOOLEAN;
      BEGIN
          SELECT u.user_level, u.assigned_province_id, u.assigned_regency_id,
                 u.assigned_district_id, u.assigned_village_id, u.can_inherit_data
          INTO user_level, user_province_id, user_regency_id, user_district_id, user_village_id, can_inherit
          FROM users u WHERE u.id = user_id;

          IF (user_level = 'province' AND target_province_id = user_province_id) OR
             (user_level = 'regency' AND target_regency_id = user_regency_id) OR
             (user_level = 'district' AND target_district_id = user_district_id) OR
             (user_level = 'village' AND target_village_id = user_village_id) THEN
              RETURN TRUE;
          END IF;

          IF can_inherit THEN
              IF (user_level = 'province' AND target_province_id = user_province_id) OR
                 (user_level = 'regency' AND target_regency_id = user_regency_id) OR
                 (user_level = 'district' AND target_district_id = user_district_id) THEN
                  RETURN TRUE;
              END IF;
          END IF;

          RETURN FALSE;
      END;
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION has_permission(
          user_id VARCHAR(12),
          permission_name VARCHAR(100)
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
          permission_count INT := 0;
      BEGIN
          SELECT COUNT(*) INTO permission_count
          FROM user_roles ur
          JOIN role_permissions rp ON ur.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = user_id
          AND ur.is_active = TRUE
          AND rp.is_active = TRUE
          AND p.is_active = TRUE
          AND p.name = permission_name
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND (rp.expires_at IS NULL OR rp.expires_at > NOW());

          RETURN permission_count > 0;
      END;
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION can_access_resource(
          user_id VARCHAR(12),
          resource_type VARCHAR(50),
          action VARCHAR(50),
          resource_id VARCHAR(12)
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
          user_level VARCHAR(20);
          user_village_id VARCHAR(12);
          user_regency_id VARCHAR(12);
          resource_village_id VARCHAR(12);
          resource_regency_id VARCHAR(12);
          has_permission BOOLEAN := FALSE;
      BEGIN
          SELECT u.user_level, u.assigned_village_id, u.assigned_regency_id
          INTO user_level, user_village_id, user_regency_id
          FROM users u WHERE u.id = user_id;

          IF user_level = 'village' THEN
              IF resource_village_id = user_village_id THEN
                  has_permission := TRUE;
              END IF;
          ELSIF user_level = 'regency' THEN
              IF resource_regency_id = user_regency_id THEN
                  has_permission := TRUE;
              END IF;
          ELSIF user_level = 'province' THEN
              has_permission := TRUE;
          END IF;

          RETURN has_permission;
      END;
      $$;
    `);

    // Create utility functions
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_user_permissions(user_id VARCHAR(12))
      RETURNS JSON
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
          permissions JSON;
      BEGIN
          SELECT json_agg(
              json_build_object(
                  'id', p.id,
                  'name', p.name,
                  'display_name', p.display_name,
                  'resource', p.resource,
                  'action', p.action,
                  'scope', p.scope,
                  'is_critical', p.is_critical
              )
          ) INTO permissions
          FROM user_roles ur
          JOIN role_permissions rp ON ur.role_id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE ur.user_id = user_id
          AND ur.is_active = TRUE
          AND rp.is_active = TRUE
          AND p.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          AND (rp.expires_at IS NULL OR rp.expires_at > NOW());

          RETURN COALESCE(permissions, '[]'::json);
      END;
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION get_user_roles(user_id VARCHAR(12))
      RETURNS JSON
      LANGUAGE plpgsql
      STABLE
      AS $$
      DECLARE
          roles JSON;
      BEGIN
          SELECT json_agg(
              json_build_object(
                  'id', r.id,
                  'name', r.name,
                  'display_name', r.display_name,
                  'description', r.description,
                  'category', rc.display_name,
                  'is_system_role', r.is_system_role,
                  'expires_at', ur.expires_at
              )
          ) INTO roles
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          LEFT JOIN role_categories rc ON r.category_id = rc.id
          WHERE ur.user_id = user_id
          AND ur.is_active = TRUE
          AND r.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

          RETURN COALESCE(roles, '[]'::json);
      END;
      $$;
    `);
  },

  async down(queryInterface, _Sequelize) {
    // Drop all functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS can_access_location(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR);
      DROP FUNCTION IF EXISTS has_permission(VARCHAR, VARCHAR);
      DROP FUNCTION IF EXISTS can_access_resource(VARCHAR, VARCHAR, VARCHAR, VARCHAR);
      DROP FUNCTION IF EXISTS get_user_permissions(VARCHAR);
      DROP FUNCTION IF EXISTS get_user_roles(VARCHAR);
    `);
  },
};
