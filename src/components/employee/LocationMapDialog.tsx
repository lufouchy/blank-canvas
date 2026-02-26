import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const companyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  companyLocation?: { lat: number; lng: number } | null;
  allowedRadius?: number | null;
  distanceMeters?: number;
  isValid?: boolean;
}

// Component to recenter map when locations change
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
};

const LocationMapDialog = ({
  open,
  onOpenChange,
  userLocation,
  companyLocation,
  allowedRadius,
  distanceMeters,
  isValid,
}: LocationMapDialogProps) => {
  // Only render map content when dialog is open AND we have user location
  const shouldRenderMap = open && userLocation;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📍 Sua Localização
            {isValid !== undefined && (
              <span className={`text-sm px-2 py-1 rounded-full ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isValid ? '✓ Dentro da área' : '✗ Fora da área'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Map container - only render when dialog is open */}
          <div className="h-[400px] w-full rounded-lg overflow-hidden border">
            {shouldRenderMap ? (
              <MapContainer
                key={`map-${userLocation.lat}-${userLocation.lng}`}
                center={[userLocation.lat, userLocation.lng]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter center={[userLocation.lat, userLocation.lng]} />

                {/* User marker */}
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>
                    <strong>Sua localização</strong>
                    <br />
                    Lat: {userLocation.lat.toFixed(6)}
                    <br />
                    Lng: {userLocation.lng.toFixed(6)}
                  </Popup>
                </Marker>

                {/* Company marker and radius circle */}
                {companyLocation && (
                  <>
                    <Marker
                      position={[companyLocation.lat, companyLocation.lng]}
                      icon={companyIcon}
                    >
                      <Popup>
                        <strong>Empresa</strong>
                        <br />
                        Lat: {companyLocation.lat.toFixed(6)}
                        <br />
                        Lng: {companyLocation.lng.toFixed(6)}
                      </Popup>
                    </Marker>

                    {/* Allowed radius circle */}
                    {allowedRadius && (
                      <Circle
                        center={[companyLocation.lat, companyLocation.lng]}
                        radius={allowedRadius}
                        pathOptions={{
                          color: isValid ? '#22c55e' : '#ef4444',
                          fillColor: isValid ? '#22c55e' : '#ef4444',
                          fillOpacity: 0.1,
                        }}
                      />
                    )}
                  </>
                )}
              </MapContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <span className="text-muted-foreground">Carregando mapa...</span>
              </div>
            )}
          </div>

          {/* Distance info */}
          {userLocation && (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full" />
                <span>Sua localização</span>
              </div>
              {companyLocation && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                  <span>Empresa</span>
                </div>
              )}
              {distanceMeters !== undefined && (
                <div className="ml-auto text-muted-foreground">
                  Distância: <strong>{Math.round(distanceMeters)}m</strong>
                  {allowedRadius && (
                    <span> (limite: {allowedRadius}m)</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationMapDialog;
