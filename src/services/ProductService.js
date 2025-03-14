// src/services/ProductService.js
import { Logger, LogCategory } from './LoggingService';
import { calculateValueScore } from '../utils/ValueCalculator';
import { DealRepository } from '../repositories/repositoryExports';

/**
 * Service for product-related operations
 * Uses DealRepository as the data source
 */
const ProductService = {
  /**
   * Get products with filtering and sorting
   * @param {Object} options - Filter and sort options
   * @returns {Promise<Array>} - Array of products with value scores
   */
  getProducts: async (options = {}) => {
    try {
      Logger.info(LogCategory.DEALS, 'Getting products with options', { options });
      
      // Map our product options to deal repository options
      const dealOptions = {
        type: options.dealType,
        day: options.day,
        category: options.category,
        maxDistance: options.maxDistance,
        activeOnly: true,
        limit: options.limit || 50,
        offset: options.offset || 0,
        userLocation: options.userLocation,
        vendorId: options.vendorId
      };
      
      // Get deals from repository
      const deals = await DealRepository.getAll(dealOptions);
      
      // Transform deals to product format
      const products = deals.map(deal => {
        // Calculate value score
        const currentPrice = deal.discountedPrice || deal.price;
        const regularPrice = deal.price;
        const marketAverage = deal.marketAverage || (deal.price * 1.2); // Estimate if not available
        
        return {
          id: deal.id,
          name: deal.name || deal.description,
          type: deal.category || 'Unknown',
          thcContent: deal.thcContent || 'N/A',
          cbdContent: deal.cbdContent || 'N/A',
          currentPrice: currentPrice,
          regularPrice: regularPrice,
          marketAverage: marketAverage,
          vendorId: deal.vendorId,
          vendorName: deal.vendorName,
          vendorDistance: deal.vendorDistance,
          imageUrl: deal.imageUrl || null,
          dealType: deal.dealType,
          expiresAt: deal.expiresAt ? deal.expiresAt.toDate().toISOString() : null,
          valueScore: calculateValueScore(currentPrice, regularPrice, marketAverage)
        };
      });
      
      // Apply additional filtering if needed
      let filteredProducts = [...products];
      
      // Filter by product type
      if (options.productType) {
        filteredProducts = filteredProducts.filter(p => 
          p.type && p.type.toLowerCase() === options.productType.toLowerCase()
        );
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
      
      Logger.info(LogCategory.DEALS, `Found ${filteredProducts.length} products`);
      return filteredProducts;
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Error getting products', { error });
      return []; // Return empty array instead of throwing
    }
  },
  
  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Product with value score
   */
  getProductById: async (productId) => {
    try {
      Logger.info(LogCategory.DEALS, `Getting product by ID: ${productId}`);
      
      // Get deal from repository
      const deal = await DealRepository.getById(productId);
      
      if (!deal) {
        Logger.warn(LogCategory.DEALS, `Product with ID ${productId} not found`);
        return null;
      }
      
      // Calculate value score
      const currentPrice = deal.discountedPrice || deal.price;
      const regularPrice = deal.price;
      const marketAverage = deal.marketAverage || (deal.price * 1.2); // Estimate if not available
      
      // Transform deal to product format
      return {
        id: deal.id,
        name: deal.name || deal.description,
        type: deal.category || 'Unknown',
        thcContent: deal.thcContent || 'N/A',
        cbdContent: deal.cbdContent || 'N/A',
        currentPrice: currentPrice,
        regularPrice: regularPrice,
        marketAverage: marketAverage,
        vendorId: deal.vendorId,
        vendorName: deal.vendorName,
        vendorDistance: deal.vendorDistance,
        imageUrl: deal.imageUrl || null,
        dealType: deal.dealType,
        expiresAt: deal.expiresAt ? deal.expiresAt.toDate().toISOString() : null,
        valueScore: calculateValueScore(currentPrice, regularPrice, marketAverage)
      };
    } catch (error) {
      Logger.error(LogCategory.DEALS, `Error getting product ${productId}`, { error });
      return null;
    }
  }
};

export default ProductService;