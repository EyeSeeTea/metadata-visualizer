import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Id } from "$/domain/entities/Ref";
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

type OrgUnitsMapPreviewProps = {
    orgUnits: ReadonlyArray<OrgUnit>;
    selectedId: Id | null;
    onSelect: (id: Id) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
};

export const OrgUnitsMapPreview: React.FC<OrgUnitsMapPreviewProps> = ({
    orgUnits,
    selectedId,
    onSelect,
    collapsed,
    onToggleCollapse,
}) => {
    if (collapsed) {
        return (
            <div className="orgunit-map orgunit-map--collapsed">
                <button
                    type="button"
                    className="orgunit-map__toggle"
                    onClick={onToggleCollapse}
                    aria-label={i18n.t("Expand geographic panel")}
                    title={i18n.t("Expand geographic panel")}
                >
                    ‹ {i18n.t("Map")}
                </button>
            </div>
        );
    }

    const hasData = orgUnits.some(orgUnit => orgUnit.geometry !== undefined || orgUnit.coordinates);

    return (
        <div className="orgunit-map">
            <div className="orgunit-map__header">
                <h3 className="orgunit-map__title">{i18n.t("Geographic preview")}</h3>
                <button
                    type="button"
                    className="orgunit-map__toggle"
                    onClick={onToggleCollapse}
                    aria-label={i18n.t("Collapse geographic panel")}
                    title={i18n.t("Collapse geographic panel")}
                >
                    {i18n.t("Collapse")} ›
                </button>
            </div>

            {hasData ? (
                <div className="orgunit-map__canvas">
                    <LeafletMap orgUnits={orgUnits} selectedId={selectedId} />
                </div>
            ) : (
                <div className="orgunit-map__empty">
                    {i18n.t("No geographic data available for the selected organisation units")}
                </div>
            )}

            <CoordinatesList orgUnits={orgUnits} selectedId={selectedId} onSelect={onSelect} />
        </div>
    );
};

const CoordinatesList: React.FC<{
    orgUnits: ReadonlyArray<OrgUnit>;
    selectedId: Id | null;
    onSelect: (id: Id) => void;
}> = ({ orgUnits, selectedId, onSelect }) => (
    <ul className="orgunit-coords">
        {orgUnits.map(orgUnit => {
            const { center, hasData } = getGeographicCenter(orgUnit);
            const isSelected = orgUnit.id === selectedId;

            return (
                <li key={orgUnit.id}>
                    <button
                        type="button"
                        className={
                            isSelected
                                ? "orgunit-coords__item orgunit-coords__item--selected"
                                : "orgunit-coords__item"
                        }
                        onClick={() => onSelect(orgUnit.id)}
                    >
                        <span className="orgunit-coords__name">{orgUnit.displayName}</span>
                        <span className="orgunit-coords__value">
                            {hasData
                                ? `${center[0].toFixed(5)}, ${center[1].toFixed(5)}`
                                : i18n.t("No coordinates")}
                        </span>
                    </button>
                </li>
            );
        })}
    </ul>
);

const LeafletMap: React.FC<{ orgUnits: ReadonlyArray<OrgUnit>; selectedId: Id | null }> = ({
    orgUnits,
    selectedId,
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const focusByIdRef = React.useRef<Map<Id, { latlng: L.LatLng; layer?: L.Layer }>>(new Map());

    React.useEffect(() => {
        if (!containerRef.current) return;

        const map = L.map(containerRef.current).setView([0, 0], 2);
        mapRef.current = map;
        focusByIdRef.current = new Map();

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const allLatLngs = orgUnits.flatMap(orgUnit => {
            const geography = drawOrgUnitGeography(map, orgUnit);
            if (geography.focus) focusByIdRef.current.set(orgUnit.id, geography.focus);
            return geography.latlngs;
        });

        if (allLatLngs.length > 0) {
            map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30], maxZoom: 12 });
        }

        return () => {
            map.remove();
            mapRef.current = null;
            focusByIdRef.current = new Map();
        };
    }, [orgUnits]);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedId) return;

        const focus = focusByIdRef.current.get(selectedId);
        if (!focus) return;

        map.setView(focus.latlng, Math.max(map.getZoom(), 8));
        focus.layer?.openPopup();
    }, [selectedId]);

    return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

type RenderedGeography = {
    latlngs: L.LatLng[];
    focus?: { latlng: L.LatLng; layer?: L.Layer };
};

function drawOrgUnitGeography(map: L.Map, orgUnit: OrgUnit): RenderedGeography {
    const geometry = orgUnit.geometry;
    const coordinates = orgUnit.coordinates;

    if (geometry) {
        if (geometry.type === "Point") {
            const [lng, lat] = geometry.coordinates as [number, number];
            const latlng = L.latLng(lat, lng);
            const marker = L.marker(latlng, { icon: defaultIcon })
                .addTo(map)
                .bindPopup(orgUnit.displayName);
            return { latlngs: [latlng], focus: { latlng, layer: marker } };
        }

        const polygons = extractPolygons(geometry);
        const latlngs = polygons.flatMap(ring => {
            const positions: L.LatLngExpression[] = ring.map(
                ([lng, lat]) => [lat, lng] as [number, number]
            );
            L.polygon(positions, {
                color: "#2c73ff",
                fillColor: "rgba(44, 115, 255, 0.25)",
                weight: 2,
            })
                .addTo(map)
                .bindPopup(orgUnit.displayName);

            return ring.map(([lng, lat]) => L.latLng(lat, lng));
        });

        const focus =
            latlngs.length > 0 ? { latlng: L.latLngBounds(latlngs).getCenter() } : undefined;
        return { latlngs, focus };
    }

    if (coordinates) {
        const latlng = L.latLng(coordinates.latitude, coordinates.longitude);
        const marker = L.marker(latlng, { icon: defaultIcon })
            .addTo(map)
            .bindPopup(orgUnit.displayName);
        return { latlngs: [latlng], focus: { latlng, layer: marker } };
    }

    return { latlngs: [] };
}
