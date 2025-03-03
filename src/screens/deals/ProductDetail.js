import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity
} from 'react-native';
import { Text, Button, Divider, Icon, Chip } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductService from '../../services/ProductService';
import { Logger, LogCategory } from '../../services/LoggingService';

const ProductDetail = ({ route, navigation }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    setIsLoading(true);
    try {
      const productData = await ProductService.getProductById(productId);
      setProduct(productData);
      
      // Set the navigation title to the product name
      navigation.setOptions({ title: productData.name });
      
      Logger.info(LogCategory.DEALS, 'Loaded product details', { 
        productId, 
        productName: productData.name 
      });
    } catch (error) {
      Logger.error(LogCategory.DEALS, 'Failed to load product details', { error, productId });
      Alert.alert('Error', 'Failed to load product details. Please try again.');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVendorPress = () => {
    if (product) {
      navigation.navigate('VendorProfile', { vendorId: product.vendorId });
    }
  };

  const handleDirectionsPress = () => {
    if (product) {
      navigation.navigate('MapView', { vendorId: product.vendorId });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" type="material" size={64} color="#F44336" />
        <Text style={styles.errorText}>Product not found</Text>
        <Button 
          title="Go Back" 
          onPress={() => navigation.goBack()} 
          buttonStyle={styles.backButton}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Category and Deal Type */}
        <View style={styles.headerRow}>
          <Text style={styles.categoryText}>{product.category}</Text>
          <View style={[
            styles.dealTypeBadge, 
            { backgroundColor: product.dealType === 'Birthday' ? '#8E44AD' : 
                               product.dealType === 'Special' ? '#F44336' : '#4CAF50' }
          ]}>
            <Text style={styles.dealTypeText}>{product.dealType}</Text>
          </View>
        </View>
        
        {/* Product Name */}
        <Text style={styles.productName}>{product.name}</Text>
        
        {/* Vendor Info (clickable) */}
        <TouchableOpacity onPress={handleVendorPress} style={styles.vendorRow}>
          <Icon name="store" type="material" size={18} color="#666" />
          <Text style={styles.vendorName}>{product.vendorName}</Text>
          <Text style={styles.distance}>{product.distance.toFixed(1)} mi</Text>
        </TouchableOpacity>
        
        <Divider style={styles.divider} />
        
        {/* Price and Discount */}
        <View style={styles.priceRow}>
          <View style={styles.priceContainer}>
            <Text style={styles.salePrice}>${product.salePrice}</Text>
            <Text style={styles.originalPrice}>${product.originalPrice}</Text>
          </View>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{product.discount}</Text>
          </View>
        </View>
        
        {/* Value Score */}
        <View style={styles.valueContainer}>
          <View style={[styles.valueScore, { backgroundColor: product.valueColor }]}>
            <Text style={styles.valueScoreText}>{product.rating}</Text>
          </View>
          <Text style={styles.valueText}>{product.valueScore}</Text>
        </View>
        
        {/* THC/CBD Content */}
        <View style={styles.contentRow}>
          <View style={styles.contentItem}>
            <Text style={styles.contentLabel}>THC</Text>
            <Text style={styles.contentValue}>{product.thc}%</Text>
          </View>
          <View style={styles.contentItem}>
            <Text style={styles.contentLabel}>CBD</Text>
            <Text style={styles.contentValue}>{product.cbd}%</Text>
          </View>
        </View>
        
        {/* Effects */}
        <Text style={styles.sectionTitle}>Effects</Text>
        <View style={styles.effectsContainer}>
          {product.effects.map((effect, index) => (
            <Chip
              key={index}
              title={effect}
              type="outline"
              containerStyle={styles.effectChip}
            />
          ))}
        </View>
        
        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="View Vendor"
            icon={<Icon name="store" type="material" size={18} color="white" style={styles.buttonIcon} />}
            onPress={handleVendorPress}
            buttonStyle={styles.vendorButton}
            containerStyle={styles.buttonContainer}
          />
          <Button
            title="Get Directions"
            icon={<Icon name="directions" type="material" size={18} color="white" style={styles.buttonIcon} />}
            onPress={handleDirectionsPress}
            buttonStyle={styles.directionsButton}
            containerStyle={styles.buttonContainer}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666666',
    marginVertical: 16,
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
  },
  headerRow: {
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  vendorName: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4CAF50',
  },
  distance: {
    marginLeft: 'auto',
    fontSize: 14,
    color: '#666666',
  },
  divider: {
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  salePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  valueScore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8BC34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  valueScoreText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  valueText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  contentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  contentItem: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
  },
  contentLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  contentValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
    color: '#333333',
  },
  effectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  effectChip: {
    margin: 4,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666666',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  buttonContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  vendorButton: {
    backgroundColor: '#4CAF50',
  },
  directionsButton: {
    backgroundColor: '#2196F3',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default ProductDetail; 