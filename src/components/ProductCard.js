import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Icon } from '@rneui/themed';

const ProductCard = ({ product, navigation }) => {
  // Handle navigation to product details
  const handleProductPress = () => {
    navigation.navigate('ProductDetail', { productId: product.id });
  };
  
  // Handle navigation to vendor profile
  const handleVendorPress = () => {
    navigation.navigate('VendorProfile', { vendorId: product.vendorId });
  };
  
  // Handle navigation to map/directions
  const handleDirectionsPress = () => {
    navigation.navigate('RouteMapView', { vendorId: product.vendorId });
  };
  
  // Handle value card press - could navigate to a value explanation screen in the future
  const handleValuePress = () => {
    // For now, just show an alert about what the value score means
    Alert.alert(
      'Value Score Explained',
      `The value score of ${product.rating} indicates how good of a deal this is based on price, quality, and market comparison.`,
      [{ text: 'OK' }]
    );
  };
  
  return (
    <View style={styles.productCard}>
      {/* Category and Deal Type */}
      <View style={styles.categoryRow}>
        <Text style={styles.categoryText}>{product.category}</Text>
        {product.dealType && (
          <View style={[
            styles.dealTypeBadge, 
            { backgroundColor: product.dealType === 'Birthday' ? '#8E44AD' : 
                              product.dealType === 'Special' ? '#F44336' : '#4CAF50' }
          ]}>
            <Text style={styles.dealTypeText}>{product.dealType}</Text>
          </View>
        )}
      </View>
      
      {/* Product Name (clickable) */}
      <TouchableOpacity onPress={handleProductPress}>
        <Text style={styles.productName}>{product.name}</Text>
      </TouchableOpacity>
      
      {/* Vendor (clickable) */}
      <TouchableOpacity onPress={handleVendorPress} style={styles.vendorRow}>
        <Icon name="store" type="material" size={16} color="#666" />
        <Text style={styles.vendorName}>{product.vendorName}</Text>
        <Text style={styles.distance}>{product.distance ? product.distance.toFixed(1) : '?'} mi</Text>
      </TouchableOpacity>
      
      {/* Price and Discount */}
      <View style={styles.priceRow}>
        <View style={styles.priceContainer}>
          <Text style={styles.salePrice}>${product.salePrice || product.currentPrice}</Text>
          {product.originalPrice && product.originalPrice !== product.salePrice && (
            <Text style={styles.originalPrice}>${product.originalPrice}</Text>
          )}
        </View>
        {product.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}</Text>
          </View>
        )}
      </View>
      
      {/* Value Score (clickable) */}
      <TouchableOpacity onPress={handleValuePress} style={styles.valueContainer}>
        <View style={[styles.valueScore, { backgroundColor: product.valueColor || '#8BC34A' }]}>
          <Text style={styles.valueScoreText}>{product.rating}</Text>
        </View>
        <Text style={styles.valueText}>{product.valueScore || 'Good Value'}</Text>
      </TouchableOpacity>
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleVendorPress}
        >
          <Icon name="store" type="material" size={16} color="#4CAF50" />
          <Text style={styles.actionButtonText}>View Vendor</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleDirectionsPress}
        >
          <Icon name="directions" type="material" size={16} color="#2196F3" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    color: '#666666',
  },
  dealTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dealTypeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vendorName: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4CAF50',
  },
  distance: {
    marginLeft: 'auto',
    fontSize: 14,
    color: '#666666',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  salePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  valueScore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8BC34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  valueScoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  valueText: {
    fontSize: 14,
    color: '#4CAF50',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666666',
  },
});

export default ProductCard; 