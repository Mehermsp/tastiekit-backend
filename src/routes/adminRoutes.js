const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');

// Apply authentication and admin role check to all routes
router.use(authenticate);
router.use(requireRole('admin'));

// Dashboard & Statistics
router.get('/statistics', adminController.getStatistics);

// Restaurant Applications
router.get('/applications', adminController.getApplications);
router.get('/applications/:id', adminController.getApplicationById);
router.put('/applications/:id/approve', adminController.approveApplication);
router.put('/applications/:id/reject', adminController.rejectApplication);

// Restaurants Management
router.get('/restaurants', adminController.getRestaurants);
router.get('/restaurants/:id', adminController.getRestaurantById);
router.put('/restaurants/:id/status', adminController.updateRestaurantStatus);
router.put('/restaurants/:id', adminController.updateRestaurant);

// Orders Management
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.put('/orders/:id/assign', adminController.assignDeliveryPartner);

// Delivery Partners Management
router.get('/delivery-partners', adminController.getDeliveryPartners);
router.get('/delivery-partners/:id', adminController.getDeliveryPartnerById);
router.put('/delivery-partners/:id/status', adminController.updateDeliveryPartnerStatus);
router.put('/delivery-partners/:id', adminController.updateDeliveryPartner);

// Settings Management
router.get('/settings/general', adminController.getGeneralSettings);
router.put('/settings/general', adminController.updateGeneralSettings);
router.get('/settings/notifications', adminController.getNotificationSettings);
router.put('/settings/notifications', adminController.updateNotificationSettings);
router.get('/settings/security', adminController.getSecuritySettings);
router.put('/settings/security', adminController.updateSecuritySettings);
router.get('/settings/restaurant-commission', adminController.getRestaurantCommission);
router.put('/settings/restaurant-commission', adminController.updateRestaurantCommission);
router.get('/settings/delivery', adminController.getDeliverySettings);
router.put('/settings/delivery', adminController.updateDeliverySettings);

module.exports = router;