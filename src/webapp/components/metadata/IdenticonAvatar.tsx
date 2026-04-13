import React from "react";
import {
    IdenticonShape,
    buildIdenticonShape,
    identiconSeed,
    sha256Hex,
} from "$/domain/metadata/Identicon";
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
    const [shape, setShape] = React.useState<IdenticonShape | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        const seed = identiconSeed(type, uid);

        sha256Hex(seed)
            .then(hash => {
                if (!isMounted) return;
                setShape(buildIdenticonShape(hash, size));
            })
            .catch(() => {
                if (isMounted) setShape(null);
            });

        return () => {
            isMounted = false;
        };
    }, [type, uid, size]);

    if (!shape) {
        return <div className={className} style={{ width: size, height: size }} />;
    }

    return (
        <div className={className} style={{ width: size, height: size }}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={shape.size}
                height={shape.size}
                viewBox={`0 0 ${shape.size} ${shape.size}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label={`${type} avatar`}
            >
                <rect width={shape.size} height={shape.size} fill={shape.background} />
                {shape.rects.map((r, index) => (
                    <rect
                        key={`${r.x}-${r.y}-${index}`}
                        x={r.x}
                        y={r.y}
                        width={r.width}
                        height={r.height}
                        fill={r.fill}
                    />
                ))}
            </svg>
        </div>
    );
};
