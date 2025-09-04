(function() {
    'use strict';

    // Migration utility for importing localStorage data to Firestore
    // This is primarily used during the first login after implementing cloud storage

    const LEGACY_STORAGE_KEY = 'budgetBuckets.v1';

    // Check if local data exists
    function hasLocalData() {
        try {
            const data = localStorage.getItem(LEGACY_STORAGE_KEY);
            return !!data;
        } catch (error) {
            console.error('Error checking for local data:', error);
            return false;
        }
    }

    // Get local data
    function getLocalData() {
        try {
            const data = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (!data) return null;
            
            return JSON.parse(data);
        } catch (error) {
            console.error('Error parsing local data:', error);
            return null;
        }
    }

    // Validate local data structure
    function validateLocalData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        // Check for required structure
        if (!data.settings || typeof data.settings !== 'object') {
            return false;
        }
        
        if (!Array.isArray(data.expenses) || !Array.isArray(data.savings)) {
            return false;
        }
        
        return true;
    }

    // Transform local data to cloud format
    function transformLocalData(localData) {
        // Ensure all buckets have required fields
        const transformBucket = (bucket) => ({
            id: bucket.id || generateId(),
            name: bucket.name || 'Unnamed',
            bankAccount: bucket.bankAccount || '',
            include: Boolean(bucket.include),
            color: bucket.color || '',
            items: (bucket.items || []).map(item => ({
                id: item.id || generateId(),
                name: item.name || 'New item',
                amount: parseFloat(item.amount) || 0,
                include: Boolean(item.include)
            })),
            // Savings-specific fields
            ...(bucket.goalEnabled !== undefined && {
                goalEnabled: Boolean(bucket.goalEnabled),
                goalAmount: parseFloat(bucket.goalAmount) || 0
            })
        });

        const transformedData = {
            name: 'Imported Budget',
            settings: {
                incomeAmount: parseFloat(localData.settings.incomeAmount) || 0,
                incomeFrequency: localData.settings.incomeFrequency || 'Fortnightly',
                currency: localData.settings.currency || 'AUD'
            },
            expenses: localData.expenses.map(transformBucket),
            savings: localData.savings.map(bucket => {
                const transformed = transformBucket(bucket);
                // Ensure savings buckets have goal fields
                if (transformed.goalEnabled === undefined) {
                    transformed.goalEnabled = false;
                    transformed.goalAmount = 0;
                }
                return transformed;
            })
        };

        return transformedData;
    }

    // Generate ID (same as in main app)
    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Import local data to cloud
    async function importLocalDataToCloud(user) {
        if (!user) {
            throw new Error('User must be authenticated');
        }

        const localData = getLocalData();
        if (!localData) {
            throw new Error('No local data found');
        }

        if (!validateLocalData(localData)) {
            throw new Error('Invalid local data format');
        }

        try {
            // Transform the data
            const transformedData = transformLocalData(localData);
            
            // Save to cloud
            const budget = await cloudStore.createBudget(user.uid, transformedData);
            
            return budget;
        } catch (error) {
            console.error('Error importing local data:', error);
            throw error;
        }
    }

    // Clear local data after successful migration
    function clearLocalData() {
        try {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing local data:', error);
        }
    }

    // Prompt user for migration
    async function promptForMigration(user) {
        if (!hasLocalData()) {
            return null;
        }

        const localData = getLocalData();
        if (!localData || !validateLocalData(localData)) {
            console.warn('Local data exists but is invalid');
            return null;
        }

        // Count items for user reference
        const expenseCount = localData.expenses.reduce((sum, bucket) => sum + bucket.items.length, 0);
        const savingsCount = localData.savings.reduce((sum, bucket) => sum + bucket.items.length, 0);
        
        const message = `We found budget data saved on this device:\n\n` +
            `• ${localData.expenses.length} expense categories with ${expenseCount} items\n` +
            `• ${localData.savings.length} savings categories with ${savingsCount} items\n` +
            `• Income: ${localData.settings.currency} ${localData.settings.incomeAmount} (${localData.settings.incomeFrequency})\n\n` +
            `Would you like to import this data to your cloud account?\n\n` +
            `Note: This will create a new budget in your cloud storage.`;

        return new Promise((resolve) => {
            if (confirm(message)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }

    // Full migration workflow
    async function performMigration(user) {
        try {
            showMigrationProgress('Checking for local data...');
            
            const shouldMigrate = await promptForMigration(user);
            if (shouldMigrate === null) {
                return { migrated: false, reason: 'no_local_data' };
            }
            
            if (!shouldMigrate) {
                return { migrated: false, reason: 'user_declined' };
            }

            showMigrationProgress('Importing your budget data...');
            
            const budget = await importLocalDataToCloud(user);
            
            showMigrationProgress('Cleaning up local storage...');
            clearLocalData();
            
            hideMigrationProgress();
            
            return { 
                migrated: true, 
                budget: budget,
                message: 'Your local budget has been successfully imported to the cloud!'
            };
            
        } catch (error) {
            hideMigrationProgress();
            throw error;
        }
    }

    // UI helpers for migration progress
    function showMigrationProgress(message) {
        const existing = document.getElementById('migrationProgress');
        if (existing) {
            existing.querySelector('.message').textContent = message;
            return;
        }

        const progressHtml = `
            <div id="migrationProgress" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: #e4e4e4;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    width: 48px;
                    height: 48px;
                    border: 3px solid #333;
                    border-top-color: #4a9eff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                "></div>
                <p class="message">${message}</p>
                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', progressHtml);
    }

    function hideMigrationProgress() {
        const progress = document.getElementById('migrationProgress');
        if (progress) {
            progress.remove();
        }
    }

    // Export functions
    window.migrationUtils = {
        hasLocalData,
        getLocalData,
        validateLocalData,
        transformLocalData,
        importLocalDataToCloud,
        clearLocalData,
        promptForMigration,
        performMigration,
        showMigrationProgress,
        hideMigrationProgress
    };
})();