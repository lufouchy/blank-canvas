import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationSettings {
  location_mode: 'disabled' | 'log_only' | 'require_exact' | 'require_radius';
  work_address_cep: string | null;
  work_address_street: string | null;
  work_address_number: string | null;
  work_address_neighborhood: string | null;
  work_address_city: string | null;
  work_address_state: string | null;
  allowed_radius_meters: number | null;
  work_latitude: number | null;
  work_longitude: number | null;
}

interface LocationValidationResult {
  isValid: boolean;
  message: string;
  latitude: number | null;
  longitude: number | null;
  distanceMeters?: number;
  companyLatitude?: number | null;
  companyLongitude?: number | null;
  allowedRadius?: number | null;
}

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Geocode an address to get coordinates using Nominatim (OpenStreetMap)
const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
        },
      }
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const useLocationValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [settings, setSettings] = useState<LocationSettings | null>(null);

  const fetchLocationSettings = useCallback(async (): Promise<LocationSettings | null> => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    // Fetch location settings from the user's profile
    const { data, error } = await supabase
      .from('profiles')
      .select('location_mode, work_address_cep, work_address_street, work_address_number, work_address_neighborhood, work_address_city, work_address_state, allowed_radius_meters, work_latitude, work_longitude')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching location settings from profile:', error);
      return null;
    }

    const settingsData: LocationSettings = {
      location_mode: (data.location_mode as LocationSettings['location_mode']) || 'disabled',
      work_address_cep: data.work_address_cep,
      work_address_street: data.work_address_street,
      work_address_number: data.work_address_number,
      work_address_neighborhood: data.work_address_neighborhood,
      work_address_city: data.work_address_city,
      work_address_state: data.work_address_state,
      allowed_radius_meters: data.allowed_radius_meters,
      work_latitude: data.work_latitude,
      work_longitude: data.work_longitude,
    };
    setSettings(settingsData);
    return settingsData;
  }, []);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada pelo navegador'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const validateLocation = useCallback(async (): Promise<LocationValidationResult> => {
    setIsValidating(true);

    try {
      // Fetch location settings
      const locationSettings = await fetchLocationSettings();

      if (!locationSettings) {
        return {
          isValid: true,
          message: 'Configurações de localização não encontradas. Permitindo registro.',
          latitude: null,
          longitude: null,
        };
      }

      // If location is disabled, allow punch without getting location
      if (locationSettings.location_mode === 'disabled') {
        return {
          isValid: true,
          message: 'Localização desativada. Registro permitido.',
          latitude: null,
          longitude: null,
        };
      }

      // Get user's current position
      let userPosition: GeolocationPosition;
      try {
        userPosition = await getCurrentPosition();
      } catch (geoError: any) {
        if (locationSettings.location_mode === 'log_only') {
          return {
            isValid: true,
            message: 'Não foi possível obter localização, mas registro permitido.',
            latitude: null,
            longitude: null,
          };
        }

        return {
          isValid: false,
          message: geoError.code === 1 
            ? 'Permissão de localização negada. Ative a localização para registrar o ponto.'
            : 'Não foi possível obter sua localização. Verifique as permissões do navegador.',
          latitude: null,
          longitude: null,
        };
      }

      const userLat = userPosition.coords.latitude;
      const userLon = userPosition.coords.longitude;

      // If log_only mode, just return the location without validation
      if (locationSettings.location_mode === 'log_only') {
        return {
          isValid: true,
          message: 'Localização registrada.',
          latitude: userLat,
          longitude: userLon,
          companyLatitude: null,
          companyLongitude: null,
          allowedRadius: null,
        };
      }

      // Get work address coordinates
      let workCoords: { lat: number; lon: number } | null = null;

      // Check if we have stored coordinates
      if (locationSettings.work_latitude && locationSettings.work_longitude) {
        workCoords = {
          lat: Number(locationSettings.work_latitude),
          lon: Number(locationSettings.work_longitude),
        };
      } else {
        // Geocode the work address
        const fullAddress = [
          locationSettings.work_address_street,
          locationSettings.work_address_number,
          locationSettings.work_address_neighborhood,
          locationSettings.work_address_city,
          locationSettings.work_address_state,
          'Brasil',
        ].filter(Boolean).join(', ');

        if (!fullAddress || fullAddress === 'Brasil') {
          return {
            isValid: false,
            message: 'Endereço de trabalho não configurado. Contate o administrador.',
            latitude: userLat,
            longitude: userLon,
          };
        }

        workCoords = await geocodeAddress(fullAddress);

        if (!workCoords) {
          return {
            isValid: false,
            message: 'Não foi possível localizar o endereço de trabalho. Contate o administrador.',
            latitude: userLat,
            longitude: userLon,
          };
        }
      }

      // Calculate distance
      const distance = calculateDistance(userLat, userLon, workCoords.lat, workCoords.lon);

      // Validate based on mode
      if (locationSettings.location_mode === 'require_exact') {
        // For exact address, use a 50m tolerance
        const EXACT_TOLERANCE_METERS = 50;
        if (distance <= EXACT_TOLERANCE_METERS) {
          return {
            isValid: true,
            message: `Localização validada. Você está a ${Math.round(distance)}m do endereço.`,
            latitude: userLat,
            longitude: userLon,
            distanceMeters: distance,
            companyLatitude: workCoords.lat,
            companyLongitude: workCoords.lon,
            allowedRadius: EXACT_TOLERANCE_METERS,
          };
        } else {
          return {
            isValid: false,
            message: `Você está a ${Math.round(distance)}m do endereço de trabalho. Distância máxima permitida: ${EXACT_TOLERANCE_METERS}m.`,
            latitude: userLat,
            longitude: userLon,
            distanceMeters: distance,
            companyLatitude: workCoords.lat,
            companyLongitude: workCoords.lon,
            allowedRadius: EXACT_TOLERANCE_METERS,
          };
        }
      }

      if (locationSettings.location_mode === 'require_radius') {
        const allowedRadius = locationSettings.allowed_radius_meters || 100;
        if (distance <= allowedRadius) {
          return {
            isValid: true,
            message: `Localização validada. Você está a ${Math.round(distance)}m do endereço (limite: ${allowedRadius}m).`,
            latitude: userLat,
            longitude: userLon,
            distanceMeters: distance,
            companyLatitude: workCoords.lat,
            companyLongitude: workCoords.lon,
            allowedRadius,
          };
        } else {
          return {
            isValid: false,
            message: `Você está a ${Math.round(distance)}m do endereço de trabalho. Distância máxima permitida: ${allowedRadius}m.`,
            latitude: userLat,
            longitude: userLon,
            distanceMeters: distance,
            companyLatitude: workCoords.lat,
            companyLongitude: workCoords.lon,
            allowedRadius,
          };
        }
      }

      // Fallback
      return {
        isValid: true,
        message: 'Registro permitido.',
        latitude: userLat,
        longitude: userLon,
      };
    } finally {
      setIsValidating(false);
    }
  }, [fetchLocationSettings]);

  return {
    validateLocation,
    isValidating,
    settings,
  };
};
