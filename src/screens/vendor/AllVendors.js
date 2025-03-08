// src/screens/vendor/AllVendors.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Icon, 
  Image,
  SearchBar
} from '@rneui/themed';
import { useAppState, AppActions } from '../../context/AppStateContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logger, LogCategory } from '../../services/LoggingService';
import { handleError, tryCatch } from '../../utils/ErrorHandler';
import { getAllVendors } from '../../services/ServiceProvider';

const AllVendors = ({ route, navigation }) => {
  const { state } = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get filter from route params if exists
  const filter = route.params?.filter || 'all';
  
  // Load vendors on component mount
  useEffect(() => {
    loadVendors();
  }, [filter]);
  
  // Filter vendors when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredVendors(vendors);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = vendors.filter(vendor => 
        vendor.name.toLowerCase().includes(query) || 
        vendor.location.address.toLowerCase().includes(query)
      );
      setFilteredVendors(filtered);
    }
  }, [searchQuery, vendors]);
  
  const loadVendors = async () => {
    setIsLoading(true);
    try {
      await tryCatch(async () => {
        // Get all vendors
        const allVendors = await getAllVendors();
        
        // Apply filter
        let filteredList = [...allVendors];
        
        if (filter === 'favorites') {
          // Filter by favorites
          filteredList = allVendors.filter(vendor => 
            state.user.favorites.includes(vendor.id)
          );
        } else if (filter === 'recent') {
          // Filter by recent visits
          const recentIds = state.user.recentVisits.map(visit => visit.vendorId);
          filteredList = allVendors.filter(vendor => 
            recentIds.includes(vendor.id)
          );
          
          // Sort by most recent
          filteredList.sort((a, b) => {
            const aVisit = state.user.recentVisits.find(v => v.vendorId === a.id);
            const bVisit = state.user.recentVisits.find(v => v.vendorId === b.id);
            return new Date(bVisit.lastVisit) - new Date(aVisit.lastVisit);
          });
        } else if (filter === 'partners') {
          // Filter by partner status
          filteredList = allVendors.filter(vendor => vendor.isPartner);
        }
        
        setVendors(filteredList);
        setFilteredVendors(filteredList);
        
        Logger.info(LogCategory.VENDORS, 'Loaded vendor list', {
          filter,
          count: filteredList.length
        });
      }, LogCategory.VENDORS, 'loading vendors list', true);
    } catch (error) {
      // Error already logged by tryCatch
    } finally {
      setIsLoading(false);
    }
  };
  
  const getScreenTitle = () => {
    switch (filter) {
      case 'favorites':
        return 'Favorite Vendors';
      case 'recent':
        return 'Recent Visits';
      case 'partners':
        return 'Partner Vendors';
      default:
        return 'All Vendors';
    }
  };
  
  const renderVendorItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('VendorProfile', { vendorId: item.id })}
    >
      <Card containerStyle={styles.vendorCard}>
        <View style={styles.vendorContent}>
          <Image
            source={{ uri: item.logoUrl || 'https://via.placeholder.com/100x100/4CAF50/FFFFFF?text=Logo' }}
            style={styles.vendorLogo}
            PlaceholderContent={<ActivityIndicator />}
          />
          <View style={styles.vendorInfo}>
            <View style={styles.vendorNameRow}>
              <Text style={styles.vendorName}>{item.name}</Text>
              {item.isPartner && (
                <View style={styles.partnerBadge}>
                  <Text style={styles.partnerText}>PARTNER</Text>
                </View>
              )}
            </View>
            
            <View style={styles.ratingContainer}>
              <Icon name="star" type="material" color="#FFD700" size={16} />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
            
            <View style={styles.addressContainer}>
              <Icon name="place" type="material" color="#666666" size={14} />
              <Text style={styles.addressText} numberOfLines={1}>
                {item.location.address}
              </Text>
            </View>
            
            <View style={styles.distanceContainer}>
              <Icon name="directions" type="material" color="#4CAF50" size={14} />
              <Text style={styles.distanceText}>
                {item.distance.toFixed(1)} miles away
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text h4 style={styles.title}>{getScreenTitle()}</Text>
        <SearchBar
          placeholder="Search vendors..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          containerStyle={styles.searchContainer}
          inputContainerStyle={styles.searchInputContainer}
          inputStyle={styles.searchInput}
          lightTheme
          round
        />
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading vendors...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVendors}
          renderItem={renderVendorItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.vendorsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="store" type="material" size={64} color="#CCCCCC" />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No vendors match your search'
                  : filter === 'favorites'
                  ? 'You have no favorite vendors yet'
                  : filter === 'recent'
                  ? 'You have no recent visits yet'
                  : 'No vendors found'}
              </Text>
              {filter === 'favorites' && (
                <Text style={styles.emptySubtext}>
                  Add vendors to your favorites by tapping the heart icon on vendor profiles.
                </Text>
              )}
            </View>
          }
          refreshing={isLoading}
          onRefresh={loadVendors}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    marginBottom: 8,
  },
  searchContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 0,
  },
  searchInputContainer: {
    backgroundColor: '#F5F5F5',
  },
  searchInput: {
    fontSize: 16,
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
  vendorsList: {
    padding: 8,
  },
  vendorCard: {
    borderRadius: 8,
    padding: 0,
    margin: 8,
    overflow: 'hidden',
  },
  vendorContent: {
    flexDirection: 'row',
    padding: 16,
  },
  vendorLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  partnerBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  partnerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4CAF50',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});

export default AllVendors;