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
    const userLocationId = profile?.location_id || null;

    const isGlobalRole = role === 'ADMIN' || role === 'SERVICE_CLIENT';

    // This state tracks the selection made by global multi-site users (ADMIN or SERVICE_CLIENT).
    const [globalSelectedLocationId, setGlobalSelectedLocationId] = useState<string | null>(() => {
        return localStorage.getItem('selected_location_id');
    });

    // Determine the final, effective location ID based on role.
    const effectiveLocationId = isGlobalRole ? globalSelectedLocationId : userLocationId;

    // Effect to persist global user's selection to localStorage, and clean up for site-restricted agents.
    useEffect(() => {
        if (isGlobalRole) {
            if (globalSelectedLocationId) {
                localStorage.setItem('selected_location_id', globalSelectedLocationId);
            } else {
                localStorage.removeItem('selected_location_id');
            }
        } else {
            // For site-restricted agents, clear the local storage to prevent future conflicts.
            localStorage.removeItem('selected_location_id');
        }
    }, [globalSelectedLocationId, isGlobalRole]);

    const isFilterActive = isGlobalRole
        ? !!globalSelectedLocationId
        : !!userLocationId;

    const setLocation = (id: string | null) => {
        if (isGlobalRole) {
            setGlobalSelectedLocationId(id);
        }
    };

    return (
        <LocationFilterContext.Provider value={{
            selectedLocationId: effectiveLocationId,
            setSelectedLocationId: setLocation,
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
