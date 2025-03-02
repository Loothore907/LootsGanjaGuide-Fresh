// src/utils/ValueCalculator.js
// This utility calculates the "value score" of products based on pricing data

/**
 * Calculate a value score for a product
 * Higher scores indicate better value relative to the market
 * @param {number} currentPrice - Current price of the product
 * @param {number} regularPrice - Regular price of the product (before discount)
 * @param {number} marketAverage - Average price for similar products in the region
 * @returns {number} - Value score from 0-10 (10 being best value)
 */
export const calculateValueScore = (currentPrice, regularPrice, marketAverage) => {
    // If any of the inputs are invalid, return a neutral score
    if (!currentPrice || !regularPrice || !marketAverage || 
        currentPrice <= 0 || regularPrice <= 0 || marketAverage <= 0) {
      return 5.0;
    }
    
    // Calculate discount percentage from regular price
    const discountPercent = ((regularPrice - currentPrice) / regularPrice) * 100;
    
    // Calculate price compared to market average
    const marketComparisonPercent = ((marketAverage - currentPrice) / marketAverage) * 100;
    
    // Calculate value score (weighted average of discount and market comparison)
    // 40% weight to discount, 60% weight to market comparison
    const valueScore = (discountPercent * 0.4) + (marketComparisonPercent * 0.6);
    
    // Convert to 0-10 scale
    // A neutral score (5) means price is equal to market average with no discount
    // Maximum score (10) means price is at least 50% below market average
    // Minimum score (0) means price is at least 50% above market average
    let normalizedScore = 5 + (valueScore / 10);
    
    // Clamp between 0 and 10
    normalizedScore = Math.max(0, Math.min(10, normalizedScore));
    
    // Round to one decimal place
    return Math.round(normalizedScore * 10) / 10;
  };
  
  /**
   * Get a human-readable value rating based on score
   * @param {number} score - Value score from 0-10
   * @returns {string} - Text representation of value
   */
  export const getValueRating = (score) => {
    if (score >= 9) return 'Exceptional Value';
    if (score >= 7.5) return 'Great Value';
    if (score >= 6) return 'Good Value';
    if (score >= 5) return 'Fair Value';
    if (score >= 3.5) return 'Below Average Value';
    if (score >= 2) return 'Poor Value';
    return 'Not Recommended';
  };
  
  /**
   * Get a color for the value score
   * @param {number} score - Value score from 0-10
   * @returns {string} - Hex color code
   */
  export const getValueColor = (score) => {
    if (score >= 9) return '#00C853'; // Bright green
    if (score >= 7.5) return '#4CAF50'; // Green
    if (score >= 6) return '#8BC34A'; // Light green
    if (score >= 5) return '#FFC107'; // Amber
    if (score >= 3.5) return '#FF9800'; // Orange
    if (score >= 2) return '#FF5722'; // Deep orange
    return '#F44336'; // Red
  };