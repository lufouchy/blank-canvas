import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface LocationInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  companyLocation?: { lat: number; lng: number } | null;
  allowedRadius?: number | null;
  distanceMeters?: number;
  isValid?: boolean;
}

const buildOsmUrl = (lat: number, lng: number) =>
  `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=18/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`;

const LocationInfoDialog = ({
  open,
  onOpenChange,
  userLocation,
  companyLocation,
  allowedRadius,
  distanceMeters,
  isValid,
}: LocationInfoDialogProps) => {
  const canShow = Boolean(open && userLocation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📍 Sua Localização
            {isValid !== undefined && (
              <span
                className={
                  "text-sm px-2 py-1 rounded-full bg-muted text-muted-foreground"
                }
              >
                {isValid ? '✓ Dentro da área' : '✗ Fora da área'}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!canShow ? (
          <div className="text-sm text-muted-foreground">Carregando localização…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 text-sm">
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <span className="text-muted-foreground">Lat/Lng:</span>{' '}
                  <span className="font-medium">
                    {userLocation!.lat.toFixed(6)}, {userLocation!.lng.toFixed(6)}
                  </span>
                </div>

                {distanceMeters !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Distância:</span>{' '}
                    <span className="font-medium">{Math.round(distanceMeters)}m</span>
                    {allowedRadius ? (
                      <span className="text-muted-foreground"> (limite: {allowedRadius}m)</span>
                    ) : null}
                  </div>
                )}

                {companyLocation ? (
                  <div className="text-muted-foreground">
                    Empresa: {companyLocation.lat.toFixed(6)}, {companyLocation.lng.toFixed(6)}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => window.open(buildOsmUrl(userLocation!.lat, userLocation!.lng), '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                Ver no OpenStreetMap
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LocationInfoDialog;
