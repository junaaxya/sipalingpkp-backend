const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Initialize Ajv with additional formats
const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);

const numericField = {
  oneOf: [
    { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
    { type: 'number' },
    { type: 'null' },
  ],
};

const integerField = {
  oneOf: [
    { type: 'string', pattern: '^-?\\d+$' },
    { type: 'number' },
    { type: 'null' },
  ],
};

/**
 * Authentication Validation Schemas
 */
const authSchemas = {
  // User registration schema
  signUp: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:\'\"\\\\|,.<>/?])',
      },
      fullName: {
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: "^[a-zA-Z\\u00C0-\\u017F.'-]+(\\s+[a-zA-Z\\u00C0-\\u017F.'-]+)*$",
      },
      phone: {
        type: 'string',
        pattern: '^[+]?[0-9\\s\\-()]{10,20}$',
      },
      otpChannel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'phone'],
      },
    },
    additionalProperties: false,
  },

  // User sign in schema
  signIn: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
    },
    additionalProperties: false,
  },

  // Refresh token schema
  refreshToken: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
        minLength: 32,
        maxLength: 32,
      },
    },
    additionalProperties: false,
  },

  verifyOtp: {
    type: 'object',
    required: ['userId', 'code'],
    properties: {
      userId: {
        type: 'string',
        minLength: 6,
        maxLength: 20,
      },
      code: {
        type: 'string',
        pattern: '^\\d{6}$',
      },
      channel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'phone'],
      },
    },
    additionalProperties: false,
  },

  resendOtp: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: {
        type: 'string',
        minLength: 6,
        maxLength: 20,
      },
      channel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'phone'],
      },
    },
    additionalProperties: false,
  },

  reactivate: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255,
      },
      channel: {
        type: 'string',
        enum: ['email', 'whatsapp', 'phone'],
      },
    },
    additionalProperties: false,
  },
};

/**
 * User Management Validation Schemas
 */
const userSchemas = {
  // Update profile schema
  updateProfile: {
    type: 'object',
    required: ['fullName'],
    properties: {
      fullName: {
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: "^[a-zA-Z\\s\\u00C0-\\u017F.'-]+$",
      },
      phone: {
        anyOf: [
          {
            type: 'string',
            minLength: 1,
            pattern: '^(\\+62|62|0)8[0-9\\s()-]{7,12}$',
          },
          {
            type: 'string',
            maxLength: 0,
          },
          {
            type: 'null',
          },
        ],
      },
      familyCardNumber: {
        anyOf: [
          {
            type: 'string',
            minLength: 8,
            maxLength: 20,
            pattern: '^\\d+$',
          },
          {
            type: 'string',
            maxLength: 0,
          },
          {
            type: 'null',
          },
        ],
      },
    },
    additionalProperties: false,
  },

  // Change password schema
  changePassword: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
      newPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '^(?=.*\\d).{8,128}$',
      },
    },
    additionalProperties: false,
  },

  updateTwoFactor: {
    type: 'object',
    required: ['enabled'],
    properties: {
      enabled: {
        type: 'boolean',
      },
    },
    additionalProperties: false,
  },
  updateNotificationPreferences: {
    type: 'object',
    required: ['notificationEmailEnabled', 'notificationWhatsappEnabled'],
    properties: {
      notificationEmailEnabled: { type: 'boolean' },
      notificationWhatsappEnabled: { type: 'boolean' },
    },
    additionalProperties: false,
  },

  // Get audit logs query schema
  getAuditLogs: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      limit: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      action: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
      },
    },
    additionalProperties: false,
  },
  adminCreateUser: {
    type: 'object',
    required: ['fullName', 'email', 'password', 'role'],
    properties: {
      fullName: {
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: "^[a-zA-Z\\s\\u00C0-\\u017F.'-]+$",
      },
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128,
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\\d!@#$%^&*(),.?":{}|<>]{8,}$',
      },
      role: {
        type: 'string',
        enum: ['admin_desa', 'admin_kabupaten', 'verifikator'],
      },
      regencyId: {
        type: ['string', 'null'],
        minLength: 12,
        maxLength: 12,
      },
      villageId: {
        type: ['string', 'null'],
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },
  adminUpdateUser: {
    type: 'object',
    required: ['fullName', 'role'],
    properties: {
      fullName: {
        type: 'string',
        minLength: 2,
        maxLength: 100,
        pattern: "^[a-zA-Z\\s\\u00C0-\\u017F.'-]+$",
      },
      role: {
        type: 'string',
        enum: ['admin_desa', 'admin_kabupaten', 'verifikator'],
      },
      regencyId: {
        type: ['string', 'null'],
        minLength: 12,
        maxLength: 12,
      },
      villageId: {
        type: ['string', 'null'],
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },
  adminListUsers: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      limit: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      search: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      userLevel: {
        type: 'string',
        maxLength: 50,
      },
      isActive: {
        type: 'string',
        enum: ['true', 'false'],
      },
      assignedProvinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      assignedRegencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      assignedDistrictId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      assignedVillageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Housing Form Validation Schemas
 */
const housingSchemas = {
  // Form submissions query schema
  getFormSubmissions: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      limit: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
        status: {
          type: 'string',
          enum: ['submitted', 'reviewed', 'under_review', 'approved', 'rejected', 'history'],
        },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },

  // Review form submission schema
  reviewFormSubmission: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['under_review', 'reviewed', 'approved', 'rejected'],
      },
      reviewNotes: {
        type: 'string',
        maxLength: 1000,
      },
    },
    additionalProperties: false,
  },
  updateFormSubmission: {
    type: 'object',
    properties: {
      householdOwner: {
        type: 'object',
        properties: {
          ownerName: { type: 'string', maxLength: 100 },
          ownerPhone: { type: 'string', maxLength: 20 },
          headOfFamilyName: { type: 'string', maxLength: 100 },
          headOfFamilyPhone: { type: 'string', maxLength: 20 },
          headOfFamilyAge: integerField,
          familyCardNumber: { type: 'string', maxLength: 20 },
          totalFamilyMembers: integerField,
          houseNumber: { type: 'string', maxLength: 20 },
          rt: { type: 'string', maxLength: 10 },
          rw: { type: 'string', maxLength: 10 },
          villageId: { type: 'string', minLength: 12, maxLength: 12 },
          districtId: { type: 'string', minLength: 12, maxLength: 12 },
          regencyId: { type: 'string', minLength: 12, maxLength: 12 },
          provinceId: { type: 'string', minLength: 12, maxLength: 12 },
          educationLevel: {
            type: 'string',
            enum: ['tidak_sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'magister', 'doktor', 'lainnya'],
          },
          educationLevelOther: { type: 'string', maxLength: 100 },
          occupation: { type: 'string', maxLength: 100 },
          monthlyIncome: numericField,
          landOwnershipStatus: { type: 'string', enum: ['milik_sendiri', 'bukan_milik_sendiri'] },
          houseOwnershipStatus: { type: 'string', enum: ['milik_sendiri', 'sewa', 'menumpang'] },
          hasReceivedHousingAssistance: { type: ['boolean', 'null'] },
          housingAssistanceYear: integerField,
          isRegisteredAsPoor: { type: ['boolean', 'null'] },
          poorRegistrationAttachment: { type: 'string', maxLength: 255 },
          latitude: numericField,
          longitude: numericField,
        },
        additionalProperties: false,
      },
      formRespondent: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email', maxLength: 255 },
          phone: { type: 'string', maxLength: 20 },
          position: {
            type: 'string',
            enum: ['perangkat_desa', 'pemilik_rumah', 'lainnya'],
          },
          positionOther: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
      houseData: {
        type: 'object',
        properties: {
          buildingArea: numericField,
          landArea: numericField,
          hasBuildingPermit: { type: ['boolean', 'null'] },
          houseType: { type: 'string', enum: ['rumah_tapak', 'rumah_susun', 'rumah_petak', 'kos'] },
          totalOccupants: integerField,
          floorMaterial: { type: 'string', enum: ['tanah', 'keramik', 'rabat_semen', 'papan', 'kayu', 'bata'] },
          wallMaterial: {
            type: 'string',
            enum: ['tembok_tanpa_plester', 'tembok_dengan_plester', 'papan', 'anyaman_bambu', 'lainnya'],
          },
          wallMaterialOther: { type: 'string', maxLength: 100 },
          roofMaterial: {
            type: 'string',
            enum: ['genteng_beton', 'genteng_keramik', 'seng_multiroof', 'kayu_sirap', 'asbes', 'lainnya'],
          },
          roofMaterialOther: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
      waterAccess: {
        type: 'object',
        properties: {
          sanitationWaterSource: { type: 'string', enum: ['sumur_gali', 'sumur_bor', 'ledeng', 'lainnya'] },
          sanitationWaterSourceOther: { type: 'string', maxLength: 100 },
          sanitationWaterDepth: integerField,
          sanitationWaterLocation: { type: 'string', enum: ['di_tanah_sendiri', 'menumpang_tempat_lain'] },
          drinkingWaterSource: {
            type: 'string',
            enum: ['sumur_gali', 'sumur_bor', 'ledeng', 'air_isi_ulang', 'lainnya'],
          },
          drinkingWaterSourceOther: { type: 'string', maxLength: 100 },
          drinkingWaterDepth: integerField,
        },
        additionalProperties: false,
      },
      sanitationAccess: {
        type: 'object',
        properties: {
          toiletOwnership: { type: 'string', enum: ['milik_sendiri', 'jamban_bersama', 'tidak_memiliki'] },
          toiletCount: integerField,
          toiletType: { type: 'string', enum: ['cubluk', 'leher_angsa_jongkok', 'leher_angsa_duduk'] },
          septicTankType: {
            type: 'string',
            enum: ['biotank', 'tanki_permanen', 'lubang_tanah', 'tidak_memiliki'],
          },
          septicTankYear: integerField,
          hasSepticPumping: { type: ['boolean', 'null'] },
          septicPumpingYear: integerField,
          septicPumpingService: {
            type: 'string',
            enum: ['pemda', 'swasta_perorangan', 'swasta_badan_usaha'],
          },
          wastewaterDisposal: {
            type: 'string',
            enum: ['jaringan_pipa', 'tangki_septic', 'drainase_sungai', 'resapan_tanah'],
          },
        },
        additionalProperties: false,
      },
      wasteManagement: {
        type: 'object',
        properties: {
          hasWasteCollection: { type: ['boolean', 'null'] },
          wasteCollectionManager: {
            type: 'string',
            enum: ['pemda', 'pemdes', 'lsm_kelompok_masyarakat', 'swasta', 'lainnya'],
          },
          wasteCollectionManagerOther: { type: 'string', maxLength: 100 },
          wasteDisposalMethod: {
            type: 'string',
            enum: ['dibakar', 'diolah_rumah', 'tempat_sampah_umum', 'dibuang_lainnya'],
          },
          wasteDisposalLocation: { type: 'string', maxLength: 200 },
        },
        additionalProperties: false,
      },
      roadAccess: {
        type: 'object',
        properties: {
          roadType: { type: 'string', enum: ['lebar_kurang_3_5m', 'lebar_lebih_3_5m', 'tidak_ada_akses'] },
          roadConstruction: { type: 'string', enum: ['beton', 'aspal', 'konblok', 'tanah_sirtu', 'lainnya'] },
          roadConstructionOther: { type: 'string', maxLength: 100 },
        },
        additionalProperties: false,
      },
      energyAccess: {
        type: 'object',
        properties: {
          electricitySource: {
            type: 'string',
            enum: ['pln_sendiri', 'pln_menumpang', 'tidak_ada', 'genset', 'pltmh', 'plts', 'lainnya'],
          },
          electricitySourceOther: { type: 'string', maxLength: 100 },
          plnCapacity: { type: 'string', maxLength: 20 },
        },
        additionalProperties: false,
      },
      reviewNotes: { type: 'string', maxLength: 1000 },
    },
    additionalProperties: false,
  },

  // Get statistics query schema
  getStatistics: {
    type: 'object',
    properties: {
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },

  // Get geographic data query schema
  getGeographicData: {
    type: 'object',
    required: ['level'],
    properties: {
      level: {
        type: 'string',
        enum: ['provinces', 'regencies', 'districts', 'villages'],
      },
      parentId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },

  // Complete form submission schema
  createFormSubmission: {
    type: 'object',
    required: [
      'respondent', 'householdOwnerData', 'houseData', 'waterAccess', 'sanitationAccess',
      'wasteManagement', 'roadAccess', 'energyAccess',
    ],
    properties: {
      respondent: {
        type: 'object',
        required: ['name', 'position'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 255,
          },
          position: {
            type: 'string',
            enum: ['perangkat_desa', 'pemilik_rumah', 'lainnya'],
          },
          positionOther: {
            type: 'string',
            maxLength: 100,
          },
          phone: {
            type: 'string',
            pattern: '^[+]?[0-9\\s\\-()]{10,20}$',
            maxLength: 20,
          },
        },
        additionalProperties: false,
      },
      householdOwnerData: {
        type: 'object',
        required: ['ownerName', 'headOfFamilyName', 'landOwnershipStatus', 'houseOwnershipStatus'],
        properties: {
          ownerName: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
          },
          ownerPhone: {
            type: 'string',
            pattern: '^[+]?[0-9\\s\\-()]{10,20}$',
          },
          headOfFamilyName: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
          },
          headOfFamilyPhone: {
            type: 'string',
            pattern: '^[+]?[0-9\\s\\-()]{10,20}$',
          },
          age: {
            type: 'integer',
            minimum: 1,
            maximum: 120,
          },
          familyCardNumber: {
            type: 'string',
            maxLength: 50,
          },
          numHouseholdsInHouse: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
          },
          address: {
            type: 'string',
            maxLength: 255,
          },
          houseNumber: {
            type: 'string',
            maxLength: 50,
          },
          rt: {
            type: 'string',
            maxLength: 10,
          },
          rw: {
            type: 'string',
            maxLength: 10,
          },
          villageId: {
            type: 'string',
            minLength: 12,
            maxLength: 12,
          },
          districtId: {
            type: 'string',
            minLength: 12,
            maxLength: 12,
          },
          regencyId: {
            type: 'string',
            minLength: 12,
            maxLength: 12,
          },
          educationLevel: {
            type: 'string',
            enum: ['tidak_sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'magister', 'doktor', 'lainnya'],
          },
          educationLevelOther: {
            type: 'string',
            maxLength: 100,
          },
          occupation: {
            type: 'string',
            maxLength: 100,
          },
          monthlyIncome: {
            type: 'number',
            minimum: 0,
            maximum: 999999999999.99,
          },
          landOwnershipStatus: {
            type: 'string',
            enum: ['milik_sendiri', 'bukan_milik_sendiri'],
          },
          houseOwnershipStatus: {
            type: 'string',
            enum: ['milik_sendiri', 'sewa', 'menumpang'],
          },
          hasHousingAssistance: {
            type: 'boolean',
          },
          housingAssistanceYear: {
            type: 'integer',
            minimum: 1900,
            maximum: 2030,
          },
          isRegisteredAsPoor: {
            type: 'boolean',
          },
          poorRegistrationAttachment: {
            type: 'string',
            maxLength: 255,
          },
          latitude: {
            oneOf: [
              { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
              { type: 'number' },
              { type: 'null' },
            ],
          },
          longitude: {
            oneOf: [
              { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
              { type: 'number' },
              { type: 'null' },
            ],
          },
        },
        additionalProperties: false,
      },
      houseData: {
        type: 'object',
        required: ['houseType', 'floorMaterial', 'wallMaterial', 'roofMaterial'],
        properties: {
          houseType: {
            type: 'string',
            enum: ['rumah_tapak', 'rumah_susun', 'rumah_petak', 'kos'],
          },
          buildingArea: {
            type: 'number',
            minimum: 0,
            maximum: 999999.99,
          },
          landArea: {
            type: 'number',
            minimum: 0,
            maximum: 999999.99,
          },
          hasBuildingPermit: {
            type: 'boolean',
          },
          buildingPermitNumber: {
            type: 'string',
            maxLength: 100,
          },
          floorMaterial: {
            type: 'string',
            enum: ['keramik', 'marmer', 'granit', 'ubin', 'semen', 'kayu', 'lainnya'],
          },
          floorMaterialOther: {
            type: 'string',
            maxLength: 100,
          },
          wallMaterial: {
            type: 'string',
            enum: ['bata_merah', 'batako', 'bata_ringan', 'kayu', 'bambu', 'lainnya'],
          },
          wallMaterialOther: {
            type: 'string',
            maxLength: 100,
          },
          roofMaterial: {
            type: 'string',
            enum: ['genteng', 'seng', 'asbes', 'kayu', 'bambu', 'lainnya'],
          },
          roofMaterialOther: {
            type: 'string',
            maxLength: 100,
          },
        },
        additionalProperties: false,
      },
      waterAccess: {
        type: 'object',
        required: ['sanitationWaterSource', 'drinkingWaterSource'],
        properties: {
          sanitationWaterSource: {
            type: 'string',
            enum: ['sumur_gali', 'sumur_bor', 'ledeng', 'lainnya'],
          },
          sanitationWaterSourceOther: {
            type: 'string',
            maxLength: 100,
          },
          drinkingWaterSource: {
            type: 'string',
            enum: ['sumur_gali', 'sumur_bor', 'ledeng', 'lainnya'],
          },
          drinkingWaterSourceOther: {
            type: 'string',
            maxLength: 100,
          },
          waterLocation: {
            type: 'string',
            enum: ['di_dalam_rumah', 'di_halaman', 'di_luar_halaman'],
          },
        },
        additionalProperties: false,
      },
      sanitationAccess: {
        type: 'object',
        required: ['toiletOwnership', 'toiletType'],
        properties: {
          toiletOwnership: {
            type: 'string',
            enum: ['milik_sendiri', 'jamban_bersama', 'tidak_memiliki'],
          },
          toiletCount: {
            type: 'integer',
            minimum: 0,
            maximum: 10,
          },
          toiletType: {
            type: 'string',
            enum: ['leher_angsa', 'cemplung', 'tidak_ada'],
          },
          hasSepticTank: {
            type: 'boolean',
          },
          septicTankType: {
            type: 'string',
            enum: ['tank_septic', 'tank_bio', 'tidak_ada'],
          },
        },
        additionalProperties: false,
      },
      wasteManagement: {
        type: 'object',
        required: ['wasteCollection'],
        properties: {
          wasteCollection: {
            type: 'string',
            enum: ['dikumpulkan', 'dibakar', 'dibuang_sembarangan', 'lainnya'],
          },
          wasteCollectionOther: {
            type: 'string',
            maxLength: 100,
          },
        },
        additionalProperties: false,
      },
      roadAccess: {
        type: 'object',
        required: ['roadType'],
        properties: {
          roadType: {
            type: 'string',
            enum: ['aspal', 'beton', 'kerikil', 'tanah', 'lainnya'],
          },
          roadTypeOther: {
            type: 'string',
            maxLength: 100,
          },
          roadWidth: {
            type: 'number',
            minimum: 0,
            maximum: 50,
          },
        },
        additionalProperties: false,
      },
      energyAccess: {
        type: 'object',
        required: ['electricitySource'],
        properties: {
          electricitySource: {
            type: 'string',
            enum: ['pln_sendiri', 'pln_menumpang', 'tidak_ada', 'genset', 'pltmh', 'plts', 'lainnya'],
          },
          electricityCapacity: {
            type: 'string',
            enum: ['450_va', '900_va', '1300_va', '2200_va', '3500_va', '5500_va', 'lainnya'],
          },
          electricityCapacityOther: {
            type: 'string',
            maxLength: 100,
          },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
};

/**
 * OAuth Validation Schemas
 */
const oauthSchemas = {
  // Link OAuth account schema
  linkAccount: {
    type: 'object',
    required: ['code'],
    properties: {
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
      },
    },
    additionalProperties: false,
  },
};

/**
 * Facility Survey Validation Schemas
 */
const facilityItemSchema = {
  type: 'object',
  required: ['type', 'name'],
  properties: {
    id: {
      type: 'string',
      minLength: 6,
      maxLength: 36,
    },
    type: {
      type: 'string',
      minLength: 1,
      maxLength: 80,
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 160,
    },
    quantity: {
      type: 'integer',
      minimum: 0,
    },
  },
  additionalProperties: false,
};

const facilitySchemas = {
  // Get facility surveys query schema
  getFacilitySurveys: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      limit: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      status: {
        type: 'string',
        enum: ['draft', 'submitted', 'under_review', 'verified', 'approved', 'rejected'],
      },
      surveyYear: {
        type: 'string',
        pattern: '^[0-9]{4}$',
      },
      surveyPeriod: {
        type: 'string',
        enum: ['q1', 'q2', 'q3', 'q4', 'annual', 'adhoc'],
      },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },

  // Create/Update facility survey schema
  createFacilitySurvey: {
    type: 'object',
    required: ['surveyYear', 'surveyPeriod'],
    properties: {
      surveyYear: {
        type: 'integer',
        minimum: 2000,
        maximum: 2100,
      },
      surveyPeriod: {
        type: 'string',
        enum: ['q1', 'q2', 'q3', 'q4', 'annual', 'adhoc'],
      },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      status: {
        type: 'string',
        enum: ['draft', 'submitted'],
      },
      submittedAt: {
        type: 'string',
        maxLength: 40,
      },
      villageInfo: {
        type: 'object',
        properties: {
          populationCount: { type: 'integer', minimum: 0 },
          householdCount: { type: 'integer', minimum: 1 },
          villageArea: { type: 'number', minimum: 0 },
          notes: { type: 'string', maxLength: 1000 },
        },
        required: ['householdCount'],
        additionalProperties: false,
      },
      commercial: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      publicServices: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      education: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      health: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      religious: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      recreation: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      cemetery: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      greenSpace: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      parking: {
        type: 'array',
        maxItems: 200,
        items: facilityItemSchema,
      },
      electricity: {
        type: 'object',
        properties: {
          isFullCoverage: { type: 'boolean' },
          uncoveredDusunCount: { type: 'integer', minimum: 0 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      water: {
        type: 'object',
        properties: {
          spamCount: { type: 'integer', minimum: 0 },
          pipedWaterCoverage: { type: 'number', minimum: 0, maximum: 100 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      telecom: {
        type: 'object',
        properties: {
          towerCount: { type: 'integer', minimum: 0 },
          coveragePercentage: { type: 'number', minimum: 0, maximum: 100 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      gas: {
        type: 'object',
        properties: {
          lpgStationCount: { type: 'integer', minimum: 0 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      transportation: {
        type: 'object',
        properties: {
          terminalCount: { type: 'integer', minimum: 0 },
          busStopCount: { type: 'integer', minimum: 0 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      fireDepartment: {
        type: 'object',
        properties: {
          stationCount: { type: 'integer', minimum: 0 },
          vehicleCount: { type: 'integer', minimum: 0 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
      streetLighting: {
        type: 'object',
        properties: {
          lampCount: { type: 'integer', minimum: 0 },
          coveragePercentage: { type: 'number', minimum: 0, maximum: 100 },
          notes: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },

  reviewFacilitySurvey: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['under_review', 'verified', 'approved', 'rejected'],
      },
      reviewNotes: {
        type: 'string',
        maxLength: 1000,
      },
    },
    additionalProperties: false,
  },

};

/**
 * Housing Development Validation Schemas
 */
const housingDevelopmentSchemas = {
  // Get housing developments query schema
  getHousingDevelopments: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      limit: {
        type: 'string',
        pattern: '^[1-9][0-9]*$',
      },
      status: {
        type: 'string',
        enum: ['draft', 'submitted', 'under_review', 'verified', 'approved', 'rejected'],
      },
      housingType: {
        type: 'string',
        enum: ['sederhana', 'menengah', 'mewah', 'campuran'],
      },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },

  // Create/Update housing development schema
  createHousingDevelopment: {
    type: 'object',
    required: ['developmentName', 'landArea', 'housingType', 'plannedUnitCount'],
    properties: {
      developmentName: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
      },
      developerName: {
        type: 'string',
        maxLength: 200,
      },
      landArea: {
        type: 'number',
        minimum: 0,
      },
      latitude: {
        type: 'number',
        minimum: -90,
        maximum: 90,
      },
      longitude: {
        type: 'number',
        minimum: -180,
        maximum: 180,
      },
      housingType: {
        type: 'string',
        enum: ['sederhana', 'menengah', 'mewah', 'campuran'],
      },
      plannedUnitCount: {
        type: 'integer',
        minimum: 0,
      },
      hasRoadAccess: {
        type: 'boolean',
      },
      roadLengthMeters: {
        type: 'number',
        minimum: 0,
      },
      landStatus: {
        type: 'string',
        maxLength: 100,
      },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      notes: {
        type: 'string',
        maxLength: 2000,
      },
      status: {
        type: 'string',
        enum: ['draft', 'submitted'],
      },
      submittedAt: {
        type: 'string',
        maxLength: 40,
      },
    },
    additionalProperties: false,
  },

  reviewHousingDevelopment: {
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['under_review', 'verified', 'approved', 'rejected'],
      },
      reviewNotes: {
        type: 'string',
        maxLength: 1000,
      },
    },
    additionalProperties: false,
  },
};

// Compile all schemas
const compiledSchemas = {
  auth: {},
  user: {},
  housing: {},
  oauth: {},
  facility: {},
  housingDevelopment: {},
  location: {},
};

// Compile auth schemas
Object.keys(authSchemas).forEach((key) => {
  compiledSchemas.auth[key] = ajv.compile(authSchemas[key]);
});

// Compile user schemas
Object.keys(userSchemas).forEach((key) => {
  compiledSchemas.user[key] = ajv.compile(userSchemas[key]);
});

// Compile housing schemas
Object.keys(housingSchemas).forEach((key) => {
  compiledSchemas.housing[key] = ajv.compile(housingSchemas[key]);
});

// Compile oauth schemas
Object.keys(oauthSchemas).forEach((key) => {
  compiledSchemas.oauth[key] = ajv.compile(oauthSchemas[key]);
});

// Compile facility schemas
Object.keys(facilitySchemas).forEach((key) => {
  compiledSchemas.facility[key] = ajv.compile(facilitySchemas[key]);
});

// Compile housing development schemas
Object.keys(housingDevelopmentSchemas).forEach((key) => {
  compiledSchemas.housingDevelopment[key] = ajv.compile(housingDevelopmentSchemas[key]);
});

/**
 * Location Validation Schemas
 */
const locationSchemas = {
  // Get location hierarchy query schema
  getLocationHierarchy: {
    type: 'object',
    properties: {
      provinceId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      regencyId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      districtId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
      villageId: {
        type: 'string',
        minLength: 12,
        maxLength: 12,
      },
    },
    additionalProperties: false,
  },
  // Reverse geocoding query schema
  reverseGeocode: {
    type: 'object',
    required: ['latitude', 'longitude'],
    properties: {
      latitude: {
        oneOf: [
          { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
          { type: 'number' },
        ],
      },
      longitude: {
        oneOf: [
          { type: 'string', pattern: '^-?\\d+(\\.\\d+)?$' },
          { type: 'number' },
        ],
      },
    },
    additionalProperties: false,
  },
};

// Compile location schemas
Object.keys(locationSchemas).forEach((key) => {
  compiledSchemas.location[key] = ajv.compile(locationSchemas[key]);
});

module.exports = {
  schemas: {
    auth: authSchemas,
    user: userSchemas,
    housing: housingSchemas,
    oauth: oauthSchemas,
    facility: facilitySchemas,
    housingDevelopment: housingDevelopmentSchemas,
    location: locationSchemas,
  },
  compiledSchemas,
  ajv,
};
