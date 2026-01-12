import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface LocationFilterContextType {
    selectedLocationId: string | null;
    setSelectedLocationId: (id: string | null) => void;
    isFilterActive: boolean;
    userLocationId: string | null; // The location assigned to the current user
}

const LocationFilterContext = createContext<LocationFilterContextType | undefined>(undefined);

export const LocationFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { role, profile } = useAuth();

    // Get the location assigned to the current user
    const userLocationId = profile?.location_id || null;

    // For ADMIN users, allow selection of any location
    // For other users, default to their assigned location
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
        const savedLocation = localStorage.getItem('selected_location_id');

        if (role === 'ADMIN') {
            // ADMIN can select any location or "All locations"
            return savedLocation || null;
        } else {
            // Non-ADMIN users should default to their assigned location
            return savedLocation || userLocationId || null;
        }
    });

    // Effect to persist to localStorage
    useEffect(() => {
        if (selectedLocationId) {
            localStorage.setItem('selected_location_id', selectedLocationId);
        } else {
            localStorage.removeItem('selected_location_id');
        }
    }, [selectedLocationId]);

    // Reset selection when user logs out or role changes
    useEffect(() => {
        if (!role) {
            setSelectedLocationId(null);
            localStorage.removeItem('selected_location_id');
        } else if (role !== 'ADMIN' && userLocationId) {
            // Non-ADMIN users should only see their assigned location
            setSelectedLocationId(userLocationId);
        }
    }, [role, userLocationId]);

    // Determine if filter is active
    // For non-ADMIN users, it's active if they have an assigned location
    // For ADMIN users, it's active if they've selected a specific location
    const isFilterActive = role === 'ADMIN'
        ? !!selectedLocationId
        : !!userLocationId;

    return (
        <LocationFilterContext.Provider value={{
            selectedLocationId: role === 'ADMIN' ? selectedLocationId : userLocationId,
            setSelectedLocationId: (id: string | null) => {
                if (role === 'ADMIN') {
                    setSelectedLocationId(id);
                }
                // Non-ADMIN users cannot change their location selection
            },
            isFilterActive,
            userLocationId
        }}>
            {children}
        </LocationFilterContext.Provider>
    );
};

export const useLocationFilter = () => {
    const context = useContext(LocationFilterContext);
    if (context === undefined) {
        throw new Error('useLocationFilter must be used within a LocationFilterProvider');
    }
    return context;
};
