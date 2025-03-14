# Scripts for Loot's Ganja Guide

This directory contains utility scripts for the Loot's Ganja Guide application.

## Add Deals Script

The `addDealsScript.js` script creates sample deals in your Firebase Firestore database. It will create:
- 7 daily deals (one for each day of the week)
- 6 birthday deals
- 4 everyday deals
- 3 special deals

### Prerequisites

1. Install the required dependencies:
   ```
   npm install firebase-admin --save-dev
   ```

2. Make sure you have access to your Firebase Admin service account key file. The script will look for it in:
   - The path specified in `CONFIG.serviceAccountPath` in the script
   - The admin project directory specified in `CONFIG.adminProjectPath`

### Usage

Run the script from the project root directory:

```
node scripts/addDealsScript.js
```

Or use the npm script:

```
npm run add-deals
```

To clear existing deals before adding new ones, use the `--clear` or `-c` flag:

```
node scripts/addDealsScript.js --clear
```

### Customization

You can customize the script by modifying:
- Vendor IDs: Update the `vendorIds` array with actual vendor IDs from your database
- Deal titles and descriptions: Modify the arrays at the top of the script
- Deal properties: Adjust the properties in the create functions (discount percentages, terms, etc.)

## Troubleshooting

If you encounter permission errors, make sure:
1. The service account key file exists at the specified path
2. The service account has the necessary permissions in Firebase
3. The Firebase project ID in the service account key matches your actual project

If you see "Could not find service account credentials", update the `CONFIG.serviceAccountPath` in the script to point to your actual service account key file. 