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

    // This state ONLY tracks the selection made by an ADMIN.
    const [adminSelectedLocationId, setAdminSelectedLocationId] = useState<string | null>(() => {
        return localStorage.getItem('selected_location_id');
    });

    // Determine the final, effective location ID based on role.
    const effectiveLocationId = role === 'ADMIN' ? adminSelectedLocationId : userLocationId;

    // Effect to persist ADMIN's selection to localStorage, and clean up for non-admins.
    useEffect(() => {
        if (role === 'ADMIN') {
            if (adminSelectedLocationId) {
                localStorage.setItem('selected_location_id', adminSelectedLocationId);
            } else {
                localStorage.removeItem('selected_location_id');
            }
        } else {
            // For non-admins, clear the local storage to prevent future conflicts.
            localStorage.removeItem('selected_location_id');
        }
    }, [adminSelectedLocationId, role]);

    const isFilterActive = role === 'ADMIN'
        ? !!adminSelectedLocationId
        : !!userLocationId;

    const setLocation = (id: string | null) => {
        if (role === 'ADMIN') {
            setAdminSelectedLocationId(id);
        }
        // For non-admins, this function does nothing.
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
