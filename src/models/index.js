
const { DataTypes, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');

// Import models
const User = require('./user');
const Role = require('./role');
const Permission = require('./permission');
const RolePermission = require('./rolePermission');
const UserRole = require('./userRole');
const UserSession = require('./userSession');
const AuditLog = require('./auditLog');
const Notification = require('./notification');
const RoleCategory = require('./roleCategory');
const OAuthProvider = require('./oauthProvider');
const UserOAuthAccount = require('./userOAuthAccount');
const Province = require('./province');
const Regency = require('./regency');
const District = require('./district');
const Village = require('./village');
const FormRespondent = require('./formRespondent');
const HouseholdOwner = require('./householdOwner');
const HouseData = require('./houseData');
const WaterAccess = require('./waterAccess');
const SanitationAccess = require('./sanitationAccess');
const WasteManagement = require('./wasteManagement');
const RoadAccess = require('./roadAccess');
const EnergyAccess = require('./energyAccess');
const FormSubmission = require('./formSubmission');
const HousingPhoto = require('./housingPhoto');
// Facility Survey models
const FacilitySurvey = require('./facilitySurvey');
const FacilityVillageInfo = require('./facilityVillageInfo');
const FacilityCommercial = require('./facilityCommercial');
const FacilityPublicServices = require('./facilityPublicServices');
const FacilityEducation = require('./facilityEducation');
const FacilityHealth = require('./facilityHealth');
const FacilityReligious = require('./facilityReligious');
const FacilityRecreation = require('./facilityRecreation');
const FacilityCemetery = require('./facilityCemetery');
const FacilityGreenSpace = require('./facilityGreenSpace');
const FacilityParking = require('./facilityParking');
// Utility models
const UtilityElectricity = require('./utilityElectricity');
const UtilityWater = require('./utilityWater');
const UtilityTelecom = require('./utilityTelecom');
const UtilityGas = require('./utilityGas');
const UtilityTransportation = require('./utilityTransportation');
const UtilityFireDepartment = require('./utilityFireDepartment');
const UtilityStreetLighting = require('./utilityStreetLighting');
// Housing Development
const HousingDevelopment = require('./housingDevelopment');

// Initialize models with sequelize instance
const models = {
  User: User(sequelize, DataTypes),
  Role: Role(sequelize, DataTypes),
  Permission: Permission(sequelize, DataTypes),
  RolePermission: RolePermission(sequelize, DataTypes),
  UserRole: UserRole(sequelize, DataTypes),
  UserSession: UserSession(sequelize, DataTypes),
  AuditLog: AuditLog(sequelize, DataTypes),
  Notification: Notification(sequelize, DataTypes),
  RoleCategory: RoleCategory(sequelize, DataTypes),
  OAuthProvider: OAuthProvider(sequelize, DataTypes),
  UserOAuthAccount: UserOAuthAccount(sequelize, DataTypes),
  Province: Province(sequelize, DataTypes),
  Regency: Regency(sequelize, DataTypes),
  District: District(sequelize, DataTypes),
  Village: Village(sequelize, DataTypes),
  FormRespondent: FormRespondent(sequelize, DataTypes),
  HouseholdOwner: HouseholdOwner(sequelize, DataTypes),
  HouseData: HouseData(sequelize, DataTypes),
  WaterAccess: WaterAccess(sequelize, DataTypes),
  SanitationAccess: SanitationAccess(sequelize, DataTypes),
  WasteManagement: WasteManagement(sequelize, DataTypes),
  RoadAccess: RoadAccess(sequelize, DataTypes),
  EnergyAccess: EnergyAccess(sequelize, DataTypes),
  FormSubmission: FormSubmission(sequelize, DataTypes),
  HousingPhoto: HousingPhoto(sequelize, DataTypes),
  // Facility Survey models
  FacilitySurvey: FacilitySurvey(sequelize, DataTypes),
  FacilityVillageInfo: FacilityVillageInfo(sequelize, DataTypes),
  FacilityCommercial: FacilityCommercial(sequelize, DataTypes),
  FacilityPublicServices: FacilityPublicServices(sequelize, DataTypes),
  FacilityEducation: FacilityEducation(sequelize, DataTypes),
  FacilityHealth: FacilityHealth(sequelize, DataTypes),
  FacilityReligious: FacilityReligious(sequelize, DataTypes),
  FacilityRecreation: FacilityRecreation(sequelize, DataTypes),
  FacilityCemetery: FacilityCemetery(sequelize, DataTypes),
  FacilityGreenSpace: FacilityGreenSpace(sequelize, DataTypes),
  FacilityParking: FacilityParking(sequelize, DataTypes),
  // Utility models
  UtilityElectricity: UtilityElectricity(sequelize, DataTypes),
  UtilityWater: UtilityWater(sequelize, DataTypes),
  UtilityTelecom: UtilityTelecom(sequelize, DataTypes),
  UtilityGas: UtilityGas(sequelize, DataTypes),
  UtilityTransportation: UtilityTransportation(sequelize, DataTypes),
  UtilityFireDepartment: UtilityFireDepartment(sequelize, DataTypes),
  UtilityStreetLighting: UtilityStreetLighting(sequelize, DataTypes),
  // Housing Development
  HousingDevelopment: HousingDevelopment(sequelize, DataTypes),
};

// Define associations
Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add sequelize instance to models
models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;
