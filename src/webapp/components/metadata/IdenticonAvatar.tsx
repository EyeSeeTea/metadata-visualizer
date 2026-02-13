import React from "react";
import { buildIdenticonSvg, identiconSeed, sha256Hex } from "$/domain/metadata/Identicon";
import { ResourceType } from "$/domain/metadata/ResourceType";

type IdenticonAvatarProps = {
    type: ResourceType;
    uid: string;
    size?: number;
    className?: string;
};

export const IdenticonAvatar: React.FC<IdenticonAvatarProps> = ({
    type,
    uid,
    size = 40,
    className,
}) => {
    const [svg, setSvg] = React.useState<string>("");

    React.useEffect(() => {
        let isMounted = true;
        const seed = identiconSeed(type, uid);

        sha256Hex(seed)
            .then(hash => {
                if (!isMounted) return;
                const { svg } = buildIdenticonSvg(hash, size);
                setSvg(svg);
            })
            .catch(() => {
                if (isMounted) setSvg("");
            });

        return () => {
            isMounted = false;
        };
    }, [type, uid, size]);

    if (!svg) {
        return <div className={className} style={{ width: size, height: size }} />;
    }

    return (
        <div
            className={className}
            style={{ width: size, height: size }}
            aria-label={`${type} avatar`}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};
