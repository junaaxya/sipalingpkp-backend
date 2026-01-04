const express = require('express');
const {
  getProvinces,
  getProvince,
  getRegencies,
  getRegency,
  getDistricts,
  getDistrict,
  getVillages,
  getVillage,
  getLocationHierarchy,
  findLocationByCoordinates,
  getGeoJSONData,
  getSearchIndex,
} = require('../controllers/locationController');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   GET /api/locations/provinces
 * @desc    Get all provinces
 * @access  Public
 */
router.get('/provinces', getProvinces);

/**
 * @route   GET /api/locations/provinces/:provinceId
 * @desc    Get province by ID with regencies
 * @access  Public
 */
router.get('/provinces/:provinceId', getProvince);

/**
 * @route   GET /api/locations/provinces/:provinceId/regencies
 * @desc    Get regencies by province ID
 * @access  Public
 */
router.get('/provinces/:provinceId/regencies', getRegencies);

/**
 * @route   GET /api/locations/regencies/:regencyId
 * @desc    Get regency by ID with districts
 * @access  Public
 */
router.get('/regencies/:regencyId', getRegency);

/**
 * @route   GET /api/locations/regencies/:regencyId/districts
 * @desc    Get districts by regency ID
 * @access  Public
 */
router.get('/regencies/:regencyId/districts', getDistricts);

/**
 * @route   GET /api/locations/districts/:districtId
 * @desc    Get district by ID with villages
 * @access  Public
 */
router.get('/districts/:districtId', getDistrict);

/**
 * @route   GET /api/locations/districts/:districtId/villages
 * @desc    Get villages by district ID
 * @access  Public
 */
router.get('/districts/:districtId/villages', getVillages);

/**
 * @route   GET /api/locations/villages/:villageId
 * @desc    Get village by ID with complete hierarchy
 * @access  Public
 */
router.get('/villages/:villageId', getVillage);

/**
 * @route   GET /api/locations/hierarchy
 * @desc    Get complete location hierarchy (query params: provinceId, regencyId, districtId, villageId)
 * @access  Public
 */
router.get('/hierarchy', getLocationHierarchy);

/**
 * @route   GET /api/locations/reverse-geocode
 * @desc    Find location by coordinates (reverse geocoding)
 * @access  Public
 */
router.get(
  '/reverse-geocode',
  validateRequest('location', 'reverseGeocode'),
  findLocationByCoordinates,
);

/**
 * @route   GET /api/locations/map/:category/:filename
 * @desc    Stream GeoJSON file by category and filename
 * @access  Public
 */
router.get('/map/:category/:filename', getGeoJSONData);

/**
 * @route   GET /api/locations/search-index
 * @desc    Get search index for quick search
 * @access  Public
 */
router.get('/search-index', getSearchIndex);

/**
 * @route   GET /api/locations/search-index.json
 * @desc    Get search index for quick search (compat)
 * @access  Public
 */
router.get('/search-index.json', getSearchIndex);

/**
 * @route   GET /api/locations/search_index.json
 * @desc    Get search index for quick search (compat)
 * @access  Public
 */
router.get('/search_index.json', getSearchIndex);

module.exports = router;
