# Loot's Ganja Guide

## Description
A mobile application designed to help cannabis enthusiasts in Anchorage, Alaska discover and track local dispensary deals. The app creates optimized routes based on user preferences, facilitates check-ins at dispensaries, and rewards users with points for their journey completions.

## Features
- User authentication with age verification (21+) and local storage
- Three deal discovery options:
  - Birthday Deals - Special offers for your birthday month
  - Daily Deals - Day-specific promotions at local dispensaries
  - Special Deals - Limited-time offers and events
- Route optimization based on location and preferences
- QR code check-in system at dispensaries
- Points reward system with journey completion bonuses
- Social media integration for sharing check-ins
- Vendor partnership features with premium visibility
- Comprehensive vendor profiles with details, hours, and deals

## Technology Stack
- React Native / Expo
- React Navigation for screen management
- AsyncStorage for local data persistence
- Location services for mapping and routing
- Camera integration for QR code scanning
- Context API for state management

## Project Structure
```
src/
├── screens/
│   ├── auth/       # Authentication screens
│   ├── deals/      # Deal discovery screens
│   ├── navigation/ # Route and map screens
│   ├── vendor/     # Vendor-related screens
│   ├── journey/    # Journey completion screens
│   └── profile/    # User profile screens
├── components/     # Reusable components
├── context/        # Global state management
├── services/       # Business logic and API services
├── utils/          # Helper functions and utilities
└── types/          # Type definitions and schemas
```

## Current Implementation Status
- Created a fresh Expo/React Native project with proper dependency management
- Implemented full authentication flow with age verification and returning user detection
- Built deal discovery screens for all three deal types with filtering options
- Developed journey planning and navigation system with route optimization
- Created vendor profiles with comprehensive deal information
- Implemented QR code check-in system with points rewards
- Added user profiles with points tracking and redemption features
- Integrated mock data services simulating backend APIs (to be replaced with real APIs)

## Monetization Strategy
- Integrated, non-intrusive advertising
- Strategic partnerships with vendors
- Premium placement in routes for partner dispensaries
- Analytics for partner vendors
- Focus on local, industry-related advertisers only

## Development Roadmap

### Phase 1: Core Functionality (Completed)
- Authentication flow
- Deal discovery screens
- Vendor listing and filtering

### Phase 2: Journey System (In Progress)
- Route optimization
- Map integration
- Check-in functionality

### Phase 3: User Engagement (Upcoming)
- Points system
- Social media sharing
- User profiles and history

### Phase 4: Vendor Integration (Planned)
- Partner features
- Analytics dashboard
- Advertising system

## Prerequisites
- Node.js (LTS version)
- npm or yarn
- Expo CLI
- Android Studio (for Android emulator)

## Installation
1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/LootsGanjaGuide.git
cd LootsGanjaGuide
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npx expo start
```

## Development Setup
- Ensure you have the latest version of Node.js installed
- Install the Expo Go app on your mobile device for testing
- Set up Android Studio for emulator testing

## Contributing
- Fork the repository
- Create your feature branch (git checkout -b feature/amazing-feature)
- Commit your changes (git commit -m 'Add some amazing feature')
- Push to the branch (git push origin feature/amazing-feature)
- Open a Pull Request

## License
[License Type] - See LICENSE.md file for details

## Contact
Project Owner: Loothore907

## Acknowledgments
- Local dispensary partners
- Anchorage cannabis community
- React Native and Expo community