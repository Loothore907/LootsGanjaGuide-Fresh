// src/services/ProductService.js
import { Logger, LogCategory } from './LoggingService';
import { calculateValueScore } from '../utils/ValueCalculator';

// Mock data for products - in a real app, this would come from an API
const MOCK_PRODUCTS = [
  {
    id: 'p1',
    name: 'Blue Dream',
    type: 'Flower',
    thcContent: '22%',
    cbdContent: '0.1%',
    currentPrice: 45,
    regularPrice: 55,
    marketAverage: 60,
    vendorId: 'v1',
    vendorName: 'Green Horizon',
    vendorDistance: 1.8,
    imageUrl: 'https://example.com/products/blue-dream.jpg',
    dealType: 'daily', // Can be 'daily', 'birthday', 'special', or null
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
  },
  {
    id: 'p2',
    name: 'Girl Scout Cookies',
    type: 'Flower',
    thcContent: '24%',
    cbdContent: '0.2%',
    currentPrice: 50,
    regularPrice: 60,
    marketAverage: 55,
    vendorId: 'v3',
    vendorName: 'Northern Lights Cannabis',
    vendorDistance: 3.5,
    imageUrl: 'https://example.com/products/gsc.jpg',
    dealType: 'special',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
  },
  {
    id: 'p3',
    name: 'Sour Diesel',
    type: 'Flower',
    thcContent: '20%',
    cbdContent: '0.1%',
    currentPrice: 40,
    regularPrice: 50,
    marketAverage: 52,
    vendorId: 'v2',
    vendorName: 'Aurora Dispensary',
    vendorDistance: 2.3,
    imageUrl: 'https://example.com/products/sour-diesel.jpg',
    dealType: 'birthday',
    expiresAt: null, // Birthday deals don't expire
  },
  {
    id: 'p4',
    name: 'CBD Tincture 1000mg',
    type: 'Tincture',
    thcContent: '0.3%',
    cbdContent: '33.3mg/ml',
    currentPrice: 70,
    regularPrice: 85,
    marketAverage: 90,
    vendorId: 'v4',
    vendorName: 'Denali Dispensary',
    vendorDistance: 1.2,
    imageUrl: 'https://example.com/products/cbd-tincture.jpg',
    dealType: 'daily',
    expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
  },
  {
    id: 'p5',
    name: 'Strawberry Gummies 100mg',
    type: 'Edible',
    thcContent: '100mg',
    cbdContent: '0mg',
    currentPrice: 25,
    regularPrice: 30,
    marketAverage: 28,
    vendorId: 'v1',
    vendorName: 'Green Horizon',
    vendorDistance: 1.8,
    imageUrl: 'https://example.com/products/strawberry-gummies.jpg',
    dealType: 'daily',
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
  },
  {
    id: 'p6',
    name: 'OG Kush Cartridge 1g',
    type: 'Cartridge',
    thcContent: '85%',
    cbdContent: '0%',
    currentPrice: 60,
    regularPrice: 60,
    marketAverage: 65,
    vendorId: 'v3',
    vendorName: 'Northern Lights Cannabis',
    vendorDistance: 3.5,
    imageUrl: 'https://example.com/products/og-kush-cart.jpg',
    dealType: null, // No special deal
    expiresAt: null,
  },
  {
    id: 'p7',
    name: 'Wedding Cake',
    type: 'Flower',
    thcContent: '25%',
    cbdContent: '0.1%',
    currentPrice: 45,
    regularPrice: 60,
    marketAverage: 58,
    vendorId: 'v5',
    vendorName: 'Arctic Buds',
    vendorDistance: 4.1,
    imageUrl: 'https://example.com/products/wedding-cake.jpg',
    dealType: 'special',
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  },
  {
    id: 'p8',
    name: 'Pineapple Express Pre-Rolls 5pk',
    type: 'Pre-Roll',
    thcContent: '18%',
    cbdContent: '0.1%',
    currentPrice: 30,
    regularPrice: 35,
    marketAverage: 38,
    vendorId: 'v2',
    vendorName: 'Aurora Dispensary',
    vendorDistance: 2.3,
    imageUrl: 'https://example.com/products/pineapple-express-prerolls.jpg',
    dealType: 'daily',
    expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
  }
];

// Product categories
export const PRODUCT_CATEGORIES = [
  'All',
  'Flower',
  'Pre-Roll',
  'Cartridge',
  'Concentrate',
  'Edible',
  'Tincture',
  'Topical',
  'Accessory'
];

// Product service
const ProductService = {
  /**
   * Get all products with optional filtering
   * @param {Object} options - Filter options
   * @param {string} options.category - Product category
   * @param {string} options.dealType - Deal type (birthday, daily, special)
   * @param {number} options.minValue - Minimum value score
   * @param {number} options.maxPrice - Maximum price
   * @param {number} options.maxDistance - Maximum distance in miles
   * @param {string} options.vendorId - Filter by specific vendor
   * @param {string} options.sortBy - Sort field (value, price, distance)
   * @param {string} options.sortDirection - Sort direction (asc, desc)
   * @returns {Promise<Array>} - Array of products with value scores
   */
  getAllProducts: async (options = {}) => {
    try {
      Logger.info(LogCategory.DEALS, 'Getting all products', { options });
      
      // Add value scores to all products
      const productsWithValue = MOCK_PRODUCTS.map(product => ({
        ...product,
        valueScore: calculateValueScore(
          product.currentPrice,
          product.regularPrice,
          product.marketAverage
        )
      }));
      
      // Apply filters
      let filteredProducts = [...productsWithValue];
      
      // Filter by category
      if (options.category && options.category !== 'All') {
        filteredProducts = filteredProducts.filter(p => p.type === options.category);
      }
      
      // Filter by deal type
      if (options.dealType) {
        filteredProducts = filteredProducts.filter(p => p.dealType === options.dealType);
      }
      
      // Filter by minimum value score
      if (options.minValue) {
        filteredProducts = filteredProducts.filter(p => p.valueScore >= options.minValue);
      }
      
      // Filter by maximum price
      if (options.maxPrice) {
        filteredProducts = filteredProducts.filter(p => p.currentPrice <= options.maxPrice);
      }
      
      // Filter by maximum distance
      if (options.maxDistance) {
        filteredProducts = filteredProducts.filter(p => p.vendorDistance <= options.maxDistance);
      }
      
      // Filter by vendor
      if (options.vendorId) {
        filteredProducts = filteredProducts.filter(p => p.vendorId === options.vendorId);
      }
      
      // Apply sorting
      const sortBy = options.sortBy || 'valueScore';
      const sortDirection = options.sortDirection === 'asc' ? 1 : -1;
      
      filteredProducts.sort((a, b) => {
        if (sortBy === 'price') {
          return (a.currentPrice - b.currentPrice) * sortDirection;
        } else if (sortBy === 'distance') {
          return (a.vendorDistance - b.vendorDistance) * sortDirection;
        } else {
          // Default to value score
          return (b.valueScore - a.valueScore) * sortDirection;
        }
      });
      
      return filteredProducts;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting products', { error });
      throw error;
    }
  },
  
  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Product with value score
   */
  getProductById: async (productId) => {
    try {
      const product = MOCK_PRODUCTS.find(p => p.id === productId);
      
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      // Add value score
      return {
        ...product,
        valueScore: calculateValueScore(
          product.currentPrice,
          product.regularPrice, 
          product.marketAverage
        )
      };
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Error getting product ${productId}`, { error });
      throw error;
    }
  }
};

export default ProductService;