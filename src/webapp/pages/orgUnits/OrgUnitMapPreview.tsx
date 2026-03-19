import React from "react";
import { OrgUnit } from "$/domain/orgUnits/OrgUnit";
import i18n from "$/utils/i18n";

type OrgUnitMapPreviewProps = {
    orgUnit: OrgUnit;
};

export const OrgUnitMapPreview: React.FC<OrgUnitMapPreviewProps> = ({ orgUnit }) => {
    const hasGeometry = orgUnit.geometry != null;
    const hasCoordinates = orgUnit.coordinates != null;
    const hasLocation = hasGeometry || hasCoordinates;

    return (
        <div className="orgunit-map">
            <h3 className="orgunit-map__title">{i18n.t("Geographic preview")}</h3>

            {!hasLocation && (
                <div className="orgunit-map__empty">
                    {i18n.t("No geographic data available for this organisation unit")}
                </div>
            )}

            {hasGeometry && orgUnit.geometry && (
                <div className="orgunit-map__canvas">
                    <GeometryRenderer geometry={orgUnit.geometry} />
                </div>
            )}

            {!hasGeometry && hasCoordinates && orgUnit.coordinates && (
                <div className="orgunit-map__canvas">
                    <PointRenderer
                        latitude={orgUnit.coordinates.latitude}
                        longitude={orgUnit.coordinates.longitude}
                    />
                </div>
            )}
        </div>
    );
};

type GeometryRendererProps = {
    geometry: NonNullable<OrgUnit["geometry"]>;
};

const GeometryRenderer: React.FC<GeometryRendererProps> = ({ geometry }) => {
    const polygons = React.useMemo(() => extractPolygons(geometry), [geometry]);

    if (polygons.length === 0) {
        if (geometry.type === "Point") {
            const coords = geometry.coordinates as [number, number];
            return <PointRenderer longitude={coords[0]} latitude={coords[1]} />;
        }
        return (
            <div className="orgunit-map__empty">
                {i18n.t("No geographic data available for this organisation unit")}
            </div>
        );
    }

    const allPoints = polygons.flat();
    const lngs = allPoints.map(p => p[0]);
    const lats = allPoints.map(p => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const padding = 20;
    const width = 500;
    const height = 400;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const rangeLng = maxLng - minLng || 1;
    const rangeLat = maxLat - minLat || 1;
    const scale = Math.min(innerW / rangeLng, innerH / rangeLat);

    const toSvg = (lng: number, lat: number): [number, number] => {
        const x = padding + (lng - minLng) * scale;
        const y = padding + (maxLat - lat) * scale;
        return [x, y];
    };

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: "100%", height: "100%", background: "#f0f4f8" }}
        >
            {polygons.map((ring, idx) => {
                const points = ring.map(([lng, lat]) => toSvg(lng, lat));
                const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
                return (
                    <path
                        key={idx}
                        d={d}
                        fill="rgba(44, 115, 255, 0.25)"
                        stroke="#2c73ff"
                        strokeWidth={1.5}
                    />
                );
            })}
        </svg>
    );
};

type PointRendererProps = {
    latitude: number;
    longitude: number;
};

const PointRenderer: React.FC<PointRendererProps> = ({ latitude, longitude }) => {
    return (
        <svg
            viewBox="0 0 500 400"
            style={{ width: "100%", height: "100%", background: "#f0f4f8" }}
        >
            <circle cx={250} cy={180} r={8} fill="#2c73ff" stroke="#1b5ed6" strokeWidth={2} />
            <text x={250} y={220} textAnchor="middle" fontSize={13} fill="#40506b">
                {`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
            </text>
            <text x={250} y={240} textAnchor="middle" fontSize={11} fill="#8c97a9">
                {i18n.t("Point location")}
            </text>
        </svg>
    );
};

type Coord = [number, number];

function extractPolygons(geometry: NonNullable<OrgUnit["geometry"]>): Coord[][] {
    switch (geometry.type) {
        case "Polygon": {
            const rings = geometry.coordinates as Coord[][];
            return rings;
        }
        case "MultiPolygon": {
            const multiRings = geometry.coordinates as Coord[][][];
            return multiRings.flat();
        }
        default:
            return [];
    }
}
