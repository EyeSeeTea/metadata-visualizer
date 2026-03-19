import React from "react";
import { OrgUnit, OrgUnitPathInfo } from "$/domain/orgUnits/OrgUnit";
import i18n from "$/utils/i18n";

type OrgUnitDetailCardProps = {
    orgUnit: OrgUnit;
    pathInfo: OrgUnitPathInfo;
};

export const OrgUnitDetailCard: React.FC<OrgUnitDetailCardProps> = ({ orgUnit, pathInfo }) => {
    return (
        <div className="orgunit-card">
            <h2 className="orgunit-card__title">{orgUnit.displayName}</h2>

            <Field label={i18n.t("UID")} value={orgUnit.id} />
            <Field label={i18n.t("Name")} value={orgUnit.name} />
            <Field label={i18n.t("Short name")} value={orgUnit.shortName} />
            <Field label={i18n.t("Level")} value={String(orgUnit.level)} />

            {orgUnit.parent && (
                <Field
                    label={i18n.t("Parent")}
                    value={`${orgUnit.parent.name} (${orgUnit.parent.id})`}
                />
            )}

            {orgUnit.openingDate && (
                <Field label={i18n.t("Opening date")} value={orgUnit.openingDate} />
            )}

            {orgUnit.closedDate && (
                <Field label={i18n.t("Closed date")} value={orgUnit.closedDate} />
            )}

            {orgUnit.coordinates && (
                <>
                    <Field
                        label={i18n.t("Latitude")}
                        value={String(orgUnit.coordinates.latitude)}
                    />
                    <Field
                        label={i18n.t("Longitude")}
                        value={String(orgUnit.coordinates.longitude)}
                    />
                </>
            )}

            <h3 className="orgunit-card__section-title">{i18n.t("Path")}</h3>
            <div className="orgunit-card__path-section">
                <PathRow label={i18n.t("Path (UIDs)")} value={pathInfo.path} />
                <PathRow label={i18n.t("Path (names)")} value={pathInfo.pathWithNames} />
                <PathRow label={i18n.t("Path (short names)")} value={pathInfo.pathWithShortNames} />
            </div>
        </div>
    );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="orgunit-card__field">
        <span className="orgunit-card__label">{label}:</span>
        <span className="orgunit-card__value">{value}</span>
    </div>
);

const PathRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="orgunit-card__path-row">
        <span className="orgunit-card__path-label">{label}:</span>
        <span className="orgunit-card__path-value">{value}</span>
    </div>
);
