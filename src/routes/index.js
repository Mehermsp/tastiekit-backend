const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const adminRoutes = require('./adminRoutes');
const customerRoutes = require('./customer');
const restaurantRoutes = require('./restaurants');
const orderRoutes = require('./orders');
const cartRoutes = require('./cart');
const deliveryRoutes = require('./delivery');
const notificationRoutes = require('./notifications');
const reviewRoutes = require('./reviews');
const paymentRoutes = require('./payment');

// Mount routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/customer', customerRoutes);
router.use('/restaurant', restaurantRoutes);
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/payment', paymentRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;