import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OrgUnit, extractPolygons, getGeographicCenter } from "$/domain/orgUnits/OrgUnit";
import i18n from "$/utils/i18n";

const defaultIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

type OrgUnitMapPreviewProps = {
    orgUnit: OrgUnit;
};

export const OrgUnitMapPreview: React.FC<OrgUnitMapPreviewProps> = ({ orgUnit }) => {
    const { center, hasData } = getGeographicCenter(orgUnit);

    return (
        <div className="orgunit-map">
            <h3 className="orgunit-map__title">{i18n.t("Geographic preview")}</h3>

            {!hasData ? (
                <div className="orgunit-map__empty">
                    {i18n.t("No geographic data available for this organisation unit")}
                </div>
            ) : (
                <div className="orgunit-map__canvas">
                    <LeafletMap orgUnit={orgUnit} center={center} />
                </div>
            )}
        </div>
    );
};

const LeafletMap: React.FC<{ orgUnit: OrgUnit; center: [number, number] }> = ({
    orgUnit,
    center,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<L.Map | null>(null);

    React.useEffect(() => {
        if (!containerRef.current) return;

        const isPolygon =
            orgUnit.geometry?.type === "Polygon" || orgUnit.geometry?.type === "MultiPolygon";

        const map = L.map(containerRef.current).setView(center, isPolygon ? 6 : 10);
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        renderOrgUnitGeography(map, orgUnit);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [orgUnit, center]);

    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

function renderOrgUnitGeography(map: L.Map, orgUnit: OrgUnit): void {
    const geometry = orgUnit.geometry;
    const coordinates = orgUnit.coordinates;

    if (geometry) {
        if (geometry.type === "Point") {
            const [lng, lat] = geometry.coordinates as [number, number];
            L.marker([lat, lng], { icon: defaultIcon }).addTo(map);
            return;
        }

        const polygons = extractPolygons(geometry);
        const allLatLngs: L.LatLng[] = [];

        polygons.forEach(ring => {
            const positions: L.LatLngExpression[] = ring.map(
                ([lng, lat]) => [lat, lng] as [number, number]
            );
            L.polygon(positions, {
                color: "#2c73ff",
                fillColor: "rgba(44, 115, 255, 0.25)",
                weight: 2,
            }).addTo(map);

            ring.forEach(([lng, lat]) => allLatLngs.push(L.latLng(lat, lng)));
        });

        if (allLatLngs.length > 0) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] });
        }
        return;
    }

    if (coordinates) {
        L.marker([coordinates.latitude, coordinates.longitude], { icon: defaultIcon }).addTo(map);
    }
}
