// src/screens/deals/AllDeals.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Overlay,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl
} from 'react-native';
import { Text, Button, Card, Icon, Chip, Slider } from '@rneui/themed';
import { useAppState } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { tryCatch } from '../../utils/ErrorHandler';
import ProductService, { PRODUCT_CATEGORIES } from '../../services/ProductService';
import { getValueColor, getValueRating } from '../../utils/ValueCalculator';

const AllDeals = ({ navigation }) => {
  const { state } = useAppState();
  
  const dealTypes = [
    {
      title: 'Birthday Deals',
      description: 'Special offers for your birthday!',
      icon: 'cake',
      route: 'BirthdayDeals',
      color: '#8E44AD'
    },
    {
      title: 'Daily Deals',
      description: 'Best deals available today',
      icon: 'local-offer',
      route: 'DailyDeals',
      color: '#2ECC71'
    },
    {
      title: 'Special Offers',
      description: 'Limited time promotions',
      icon: 'event',
      route: 'SpecialDeals',
      color: '#E74C3C'
    }
  ];
  
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDealType, setSelectedDealType] = useState(null);
  const [maxPrice, setMaxPrice] = useState(200);
  const [minValueScore, setMinValueScore] = useState(0);
  const [maxDistance, setMaxDistance] = useState(50);
  const [sortBy, setSortBy] = useState('valueScore');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, selectedCategory, selectedDealType, maxPrice, minValueScore, maxDistance, sortBy, sortDirection]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        const allProducts = await ProductService.getAllProducts({
          category: selectedCategory,
          dealType: selectedDealType,
          maxPrice,
          minValue: minValueScore,
          maxDistance,
          sortBy,
          sortDirection
        });
        setProducts(allProducts);
        
        Logger.info(LogCategory.DEALS, 'Loaded all products', {
          count: allProducts.length
        });
      }, LogCategory.DEALS, 'loading products', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  const applyFilters = () => {
    let result = [...products];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) || 
        product.vendorName.toLowerCase().includes(query) ||
        product.type.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory !== 'All') {
      result = result.filter(product => product.type === selectedCategory);
    }
    
    if (selectedDealType) {
      result = result.filter(product => product.dealType === selectedDealType);
    }
    
    result = result.filter(product => product.currentPrice <= maxPrice);
    
    result = result.filter(product => product.valueScore >= minValueScore);
    
    result = result.filter(product => product.vendorDistance <= maxDistance);
    
    result.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortBy) {
        case 'price':
          return (a.currentPrice - b.currentPrice) * direction;
        case 'distance':
          return (a.vendorDistance - b.vendorDistance) * direction;
        case 'valueScore':
        default:
          return (b.valueScore - a.valueScore) * direction;
      }
    });
    
    setFilteredProducts(result);
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };
  
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedDealType(null);
    setMaxPrice(200);
    setMinValueScore(0);
    setMaxDistance(50);
    setSortBy('valueScore');
    setSortDirection('desc');
  };

  const renderProductItem = ({ item }) => {
    const valueColor = getValueColor(item.valueScore);
    const valueText = getValueRating(item.valueScore);
    const discountPercent = ((item.regularPrice - item.currentPrice) / item.regularPrice * 100).toFixed(0);
    const hasDiscount = item.currentPrice < item.regularPrice;
    
    return (
      <Card containerStyle={styles.productCard}>
        <TouchableOpacity onPress={() => navigateToProductDetail(item)}>
          {/* Product Header */}
          <View style={styles.productHeader}>
            <View style={styles.productType}>
              <Text style={styles.productTypeText}>{item.type}</Text>
            </View>
            
            {/* Deal Badge */}
            {item.dealType && (
              <View style={[
                styles.dealBadge, 
                item.dealType === 'birthday' ? styles.birthdayBadge : 
                item.dealType === 'daily' ? styles.dailyBadge : 
                styles.specialBadge
              ]}>
                <Text style={styles.dealBadgeText}>
                  {item.dealType === 'birthday' ? 'Birthday' : 
                   item.dealType === 'daily' ? 'Daily' : 'Special'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Product Name */}
          <Text style={styles.productName}>{item.name}</Text>
          
          {/* Vendor Info */}
          <TouchableOpacity 
            style={styles.vendorInfo} 
            onPress={() => navigateToVendor(item.vendorId)}
          >
            <Icon name="storefront" type="material" size={16} color="#666" />
            <Text style={styles.vendorName}>{item.vendorName}</Text>
            <Text style={styles.vendorDistance}>{item.vendorDistance.toFixed(1)} mi</Text>
          </TouchableOpacity>
          
          <Divider style={styles.divider} />
          
          {/* Pricing Info */}
          <View style={styles.pricingInfo}>
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>${item.currentPrice}</Text>
              {hasDiscount && (
                <Text style={styles.regularPrice}>${item.regularPrice}</Text>
              )}
            </View>
            
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discountPercent}% OFF</Text>
              </View>
            )}
          </View>
          
          {/* Value Score */}
          <View style={[styles.valueScoreContainer, { backgroundColor: valueColor + '20' }]}>
            <View style={[styles.valueScoreBadge, { backgroundColor: valueColor }]}>
              <Text style={styles.valueScoreText}>{item.valueScore.toFixed(1)}</Text>
            </View>
            <Text style={[styles.valueRatingText, { color: valueColor }]}>{valueText}</Text>
          </View>
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToVendor(item.vendorId)}
          >
            <Icon name="storefront" type="material" size={18} color="#4CAF50" />
            <Text style={styles.actionButtonText}>View Vendor</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToMap(item)}
          >
            <Icon name="directions" type="material" size={18} color="#2196F3" />
            <Text style={styles.actionButtonText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const navigateToProductDetail = (product) => {
    navigation.navigate('ProductDetail', { 
      productId: product.id
    });
  };
  
  const navigateToVendor = (vendorId) => {
    navigation.navigate('VendorProfile', { vendorId });
  };
  
  const navigateToMap = (product) => {
    navigation.navigate('MapView', { vendorId: product.vendorId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text h4 style={styles.title}>All Deals</Text>
        <Text style={styles.subtitle}>
          Find the best cannabis deals in Anchorage
        </Text>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.dealTypesContainer}>
          {dealTypes.map((dealType, index) => (
            <Card 
              key={index}
              containerStyle={[styles.dealTypeCard, { borderColor: dealType.color }]}
            >
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, { backgroundColor: dealType.color }]}>
                  <Icon name={dealType.icon} type="material" color="#FFFFFF" size={32} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.dealTypeTitle}>{dealType.title}</Text>
                  <Text style={styles.dealTypeDescription}>{dealType.description}</Text>
                </View>
              </View>
              <Button
                title="View Deals"
                onPress={() => navigation.navigate(dealType.route)}
                buttonStyle={[styles.viewButton, { backgroundColor: dealType.color }]}
              />
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Overlay
        isVisible={showFilterModal}
        onBackdropPress={() => setShowFilterModal(false)}
        overlayStyle={styles.filterModal}
      >
        <View style={styles.filterModalContent}>
          <Text style={styles.filterTitle}>Filter & Sort Products</Text>
          
          {/* Categories */}
          <Text style={styles.filterSectionTitle}>Product Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {PRODUCT_CATEGORIES.map(category => (
              <Chip
                key={category}
                title={category}
                type={selectedCategory === category ? 'solid' : 'outline'}
                buttonStyle={selectedCategory === category ? styles.selectedChip : styles.chip}
                titleStyle={selectedCategory === category ? styles.selectedChipTitle : styles.chipTitle}
                onPress={() => setSelectedCategory(category)}
                containerStyle={styles.chipContainer}
              />
            ))}
          </ScrollView>
          
          {/* Deal Types */}
          <Text style={styles.filterSectionTitle}>Deal Type</Text>
          <View style={styles.dealTypeContainer}>
            <Chip
              title="All Deals"
              type={selectedDealType === null ? 'solid' : 'outline'}
              buttonStyle={selectedDealType === null ? styles.selectedChip : styles.chip}
              titleStyle={selectedDealType === null ? styles.selectedChipTitle : styles.chipTitle}
              onPress={() => setSelectedDealType(null)}
              containerStyle={styles.chipContainer}
            />
            <Chip
              title="Birthday"
              type={selectedDealType === 'birthday' ? 'solid' : 'outline'}
              buttonStyle={selectedDealType === 'birthday' ? styles.selectedChip : styles.chip}
              titleStyle={selectedDealType === 'birthday' ? styles.selectedChipTitle : styles.chipTitle}
              onPress={() => setSelectedDealType('birthday')}
              containerStyle={styles.chipContainer}
            />
            <Chip
              title="Daily"
              type={selectedDealType === 'daily' ? 'solid' : 'outline'}
              buttonStyle={selectedDealType === 'daily' ? styles.selectedChip : styles.chip}
              titleStyle={selectedDealType === 'daily' ? styles.selectedChipTitle : styles.chipTitle}
              onPress={() => setSelectedDealType('daily')}
              containerStyle={styles.chipContainer}
            />
            <Chip
              title="Special"
              type={selectedDealType === 'special' ? 'solid' : 'outline'}
              buttonStyle={selectedDealType === 'special' ? styles.selectedChip : styles.chip}
              titleStyle={selectedDealType === 'special' ? styles.selectedChipTitle : styles.chipTitle}
              onPress={() => setSelectedDealType('special')}
              containerStyle={styles.chipContainer}
            />
          </View>
          
          {/* Max Price Slider */}
          <Text style={styles.filterSectionTitle}>Maximum Price: ${maxPrice}</Text>
          <Slider
            value={maxPrice}
            onValueChange={setMaxPrice}
            minimumValue={10}
            maximumValue={200}
            step={5}
            thumbStyle={styles.sliderThumb}
            thumbTintColor="#4CAF50"
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#D8D8D8"
          />
          
          {/* Minimum Value Score Slider */}
          <Text style={styles.filterSectionTitle}>Minimum Value Score: {minValueScore.toFixed(1)}</Text>
          <Slider
            value={minValueScore}
            onValueChange={setMinValueScore}
            minimumValue={0}
            maximumValue={10}
            step={0.5}
            thumbStyle={styles.sliderThumb}
            thumbTintColor="#4CAF50"
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#D8D8D8"
          />
          
          {/* Max Distance Slider */}
          <Text style={styles.filterSectionTitle}>Maximum Distance: {maxDistance} miles</Text>
          <Slider
            value={maxDistance}
            onValueChange={setMaxDistance}
            minimumValue={1}
            maximumValue={50}
            step={1}
            thumbStyle={styles.sliderThumb}
            thumbTintColor="#4CAF50"
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#D8D8D8"
          />
          
          {/* Sort Options */}
          <Text style={styles.filterSectionTitle}>Sort By</Text>
          <View style={styles.sortOptionsContainer}>
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'valueScore' && styles.selectedSortOption
              ]}
              onPress={() => {
                setSortBy('valueScore');
                setSortDirection('desc');
              }}
            >
              <Icon 
                name="trending-up" 
                type="material" 
                size={18} 
                color={sortBy === 'valueScore' ? '#4CAF50' : '#666'} 
              />
              <Text style={[
                styles.sortOptionText,
                sortBy === 'valueScore' && styles.selectedSortOptionText
              ]}>Best Value</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'price' && sortDirection === 'asc' && styles.selectedSortOption
              ]}
              onPress={() => {
                setSortBy('price');
                setSortDirection('asc');
              }}
            >
              <Icon 
                name="arrow-downward" 
                type="material" 
                size={18} 
                color={sortBy === 'price' && sortDirection === 'asc' ? '#4CAF50' : '#666'} 
              />
              <Text style={[
                styles.sortOptionText,
                sortBy === 'price' && sortDirection === 'asc' && styles.selectedSortOptionText
              ]}>Price: Low to High</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'price' && sortDirection === 'desc' && styles.selectedSortOption
              ]}
              onPress={() => {
                setSortBy('price');
                setSortDirection('desc');
              }}
            >
              <Icon 
                name="arrow-upward" 
                type="material" 
                size={18} 
                color={sortBy === 'price' && sortDirection === 'desc' ? '#4CAF50' : '#666'} 
              />
              <Text style={[
                styles.sortOptionText,
                sortBy === 'price' && sortDirection === 'desc' && styles.selectedSortOptionText
              ]}>Price: High to Low</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortBy === 'distance' && styles.selectedSortOption
              ]}
              onPress={() => {
                setSortBy('distance');
                setSortDirection('asc');
              }}
            >
              <Icon 
                name="place" 
                type="material" 
                size={18} 
                color={sortBy === 'distance' ? '#4CAF50' : '#666'} 
              />
              <Text style={[
                styles.sortOptionText,
                sortBy === 'distance' && styles.selectedSortOptionText
              ]}>Distance</Text>
            </TouchableOpacity>
          </View>
          
          {/* Filter Actions */}
          <View style={styles.filterActions}>
            <Button
              title="Reset Filters"
              type="outline"
              onPress={resetFilters}
              buttonStyle={styles.resetButton}
              titleStyle={{ color: '#F44336' }}
            />
            <Button
              title="Apply Filters"
              onPress={() => setShowFilterModal(false)}
              buttonStyle={styles.applyButton}
            />
          </View>
        </View>
      </Overlay>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" type="material" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" type="material" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Icon name="tune" type="material" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
      
      {/* Product List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4CAF50']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="local-offer" type="material" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your filters or search terms
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  dealTypesContainer: {
    padding: 10,
  },
  dealTypeCard: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  dealTypeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dealTypeDescription: {
    fontSize: 14,
    color: '#666666',
  },
  viewButton: {
    margin: 16,
    borderRadius: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
  },
  filterButton: {
    padding: 8,
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
  listContainer: {
    padding: 8,
  },
  productCard: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productType: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  productTypeText: {
    fontSize: 12,
    color: '#666666',
  },
  dealBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  birthdayBadge: {
    backgroundColor: '#9C27B0',
  },
  dailyBadge: {
    backgroundColor: '#4CAF50',
  },
  specialBadge: {
    backgroundColor: '#F44336',
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorName: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  vendorDistance: {
    fontSize: 14,
    color: '#4CAF50',
  },
  divider: {
    marginVertical: 8,
  },
  pricingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  regularPrice: {
    fontSize: 16,
    color: '#666666',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  discountBadge: {
    backgroundColor: '#F44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  valueScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  valueScoreBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  valueScoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  valueRatingText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666666',
  },
  filterModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 10,
    padding: 0,
  },
  filterModalContent: {
    padding: 20,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  categoriesScroll: {
    marginBottom: 16,
  },
  chipContainer: {
    margin: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#4CAF50',
  },
  selectedChip: {
    backgroundColor: '#4CAF50',
  },
  chipTitle: {
    color: '#4CAF50',
  },
  selectedChipTitle: {
    color: '#FFFFFF',
  },
  dealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  sliderThumb: {
    width: 24,
    height: 24,
  },
  sortOptionsContainer: {
    marginBottom: 20,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  selectedSortOption: {
    backgroundColor: '#E8F5E9',
  },
  sortOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  selectedSortOptionText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  resetButton: {
    borderColor: '#F44336',
    paddingHorizontal: 20,
  },
  applyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});

export default AllDeals;