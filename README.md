# Loot's Ganja Guide

## Description
A mobile application designed to help cannabis enthusiasts in Anchorage, Alaska discover and track local dispensary deals. The app creates optimized routes based on user preferences, facilitates check-ins at dispensaries, and rewards users with points for their journey completions.

## Features
- Deal discovery (Birthday, Daily, and Special deals)
- Route optimization based on location and preferences
- QR code check-in system
- Points reward system
- Social media integration
- Vendor partnership opportunities
- Age verification (21+)
- Local authentication

## Technology Stack
- React Native / Expo
- React Navigation
- AsyncStorage for local data
- Maps integration
- QR code scanning capabilities
- Social media APIs

## Project Status
This repository contains a fresh implementation of the Loot's Ganja Guide app. The original codebase can be found at: https://github.com/Loothore907/LootsGanjaGuide.git

We've created this fresh project to resolve dependency conflicts and implement an improved architecture.

## Current Implementation Status
- Created a fresh Expo/React Native project
- Successfully configured the development environment with Android Studio emulator
- Basic project structure established with directory hierarchy
- Started implementation of authentication flow
- AppStateContext implemented for state management
- Core navigation flow defined

## Prerequisites
- Node.js (LTS version)
- npm or yarn
- Expo CLI
- Android Studio (for Android emulator)

## Installation
1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/LootsGanjaGuide-Fresh.git
cd LootsGanjaGuide-Fresh

Install dependencies

bashCopynpm install

Start the development server

bashCopynpx expo start
Development Setup

Ensure you have the latest version of Node.js installed
Install the Expo Go app on your mobile device for testing
Set up Android Studio for emulator testing

Project Structure
Copysrc/
├── screens/
│   ├── auth/       # Authentication screens
│   ├── deals/      # Deal discovery screens
│   ├── navigation/ # Route and map screens
│   ├── vendor/     # Vendor-related screens
│   └── journey/    # Journey completion screens
├── components/     # Reusable components
├── context/        # Application state management
└── services/       # API and service integrations
Development Roadmap
Phase 1: Core Functionality (Current)

Complete authentication flow
Implement deal discovery screens
Create vendor listing and filtering

Phase 2: Journey System

Implement route optimization
Develop map integration
Build check-in functionality

Phase 3: User Engagement

Implement points system
Add social media sharing
Create user profiles and history

Phase 4: Vendor Integration

Develop partner features
Create analytics dashboard
Implement advertising system

Contributing

Fork the repository
Create your feature branch (git checkout -b feature/amazing-feature)
Commit your changes (git commit -m 'Add some amazing feature')
Push to the branch (git push origin feature/amazing-feature)
Open a Pull Request

License
[License Type] - See LICENSE.md file for details
Contact
Project Owner: Loothore907
Acknowledgments

Local dispensary partners
Anchorage cannabis community
React Native and Expo community