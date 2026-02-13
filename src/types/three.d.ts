declare module "three" {
    export class Texture {
        colorSpace: string;
        encoding?: number;
    }

    export class TextureLoader {
        load(
            url: string,
            onLoad: (texture: Texture) => void,
            onProgress?: (event: unknown) => void,
            onError?: (error: unknown) => void
        ): void;
    }

    export class BoxGeometry {
        constructor(width: number, height: number, depth: number);
    }

    export class MeshLambertMaterial {
        map?: Texture | null;
        needsUpdate: boolean;
        constructor(params?: { color?: string; map?: Texture | null });
    }

    export class Mesh {
        constructor(geometry: BoxGeometry, material: MeshLambertMaterial);
    }

    export const SRGBColorSpace: string;
    export const sRGBEncoding: number;
}
