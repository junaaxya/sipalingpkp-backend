/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // Create permission check functions
    await queryInterface.sequelize.query(`
      CREATE FUNCTION can_access_location(
          user_id VARCHAR(12),
          target_province_id VARCHAR(12),
          target_regency_id VARCHAR(12),
          target_district_id VARCHAR(12),
          target_village_id VARCHAR(12)
      ) RETURNS BOOLEAN
      READS SQL DATA
      DETERMINISTIC
      BEGIN
          DECLARE user_level VARCHAR(20);
          DECLARE user_province_id VARCHAR(12);
          DECLARE user_regency_id VARCHAR(12);
          DECLARE user_district_id VARCHAR(12);
          DECLARE user_village_id VARCHAR(12);
          DECLARE can_inherit BOOLEAN;
          
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
      END
    `);

    await queryInterface.sequelize.query(`
      CREATE FUNCTION has_permission(
          user_id VARCHAR(12),
          permission_name VARCHAR(100)
      ) RETURNS BOOLEAN
      READS SQL DATA
      DETERMINISTIC
      BEGIN
          DECLARE permission_count INT DEFAULT 0;
          
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
      END
    `);

    await queryInterface.sequelize.query(`
      CREATE FUNCTION can_access_resource(
          user_id VARCHAR(12),
          resource_type VARCHAR(50),
          action VARCHAR(50),
          resource_id VARCHAR(12)
      ) RETURNS BOOLEAN
      READS SQL DATA
      DETERMINISTIC
      BEGIN
          DECLARE user_level VARCHAR(20);
          DECLARE user_village_id VARCHAR(12);
          DECLARE user_regency_id VARCHAR(12);
          DECLARE resource_village_id VARCHAR(12);
          DECLARE resource_regency_id VARCHAR(12);
          DECLARE has_permission BOOLEAN DEFAULT FALSE;
          
          SELECT u.user_level, u.assigned_village_id, u.assigned_regency_id
          INTO user_level, user_village_id, user_regency_id
          FROM users u WHERE u.id = user_id;
          
          CASE user_level
              WHEN 'village' THEN
                  IF resource_village_id = user_village_id THEN
                      SET has_permission = TRUE;
                  END IF;
                  
              WHEN 'regency' THEN
                  IF resource_regency_id = user_regency_id THEN
                      SET has_permission = TRUE;
                  END IF;
                  
              WHEN 'province' THEN
                  SET has_permission = TRUE;
          END CASE;
          
          RETURN has_permission;
      END
    `);

    // Create utility functions
    await queryInterface.sequelize.query(`
      CREATE FUNCTION get_user_permissions(user_id VARCHAR(12)) 
      RETURNS JSON
      READS SQL DATA
      DETERMINISTIC
      BEGIN
          DECLARE permissions JSON;
          
          SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
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
          
          RETURN COALESCE(permissions, JSON_ARRAY());
      END
    `);

    await queryInterface.sequelize.query(`
      CREATE FUNCTION get_user_roles(user_id VARCHAR(12)) 
      RETURNS JSON
      READS SQL DATA
      DETERMINISTIC
      BEGIN
          DECLARE roles JSON;
          
          SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
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
          
          RETURN COALESCE(roles, JSON_ARRAY());
      END
    `);
  },

  async down(queryInterface, _Sequelize) {
    // Drop all functions
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS can_access_location;
      DROP FUNCTION IF EXISTS has_permission;
      DROP FUNCTION IF EXISTS can_access_resource;
      DROP FUNCTION IF EXISTS get_user_permissions;
      DROP FUNCTION IF EXISTS get_user_roles;
    `);
  },
};
