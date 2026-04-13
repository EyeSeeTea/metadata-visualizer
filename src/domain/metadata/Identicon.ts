import { ResourceType } from "$/domain/metadata/ResourceType";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const DEFAULT_GRID = 5;
const DEFAULT_SIZE = 40;

export type IdenticonRect = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
}>;

export type IdenticonShape = Readonly<{
    size: number;
    background: string;
    color: string;
    rects: ReadonlyArray<IdenticonRect>;
}>;

export type IdenticonResult = Readonly<{
    svg: string;
    color: string;
    background: string;
}>;

export function identiconSeed(type: ResourceType, uid: string): string {
    return `${type}:${uid}:v1`;
}

export async function sha256Hex(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    if (!("crypto" in globalThis) || !globalThis.crypto.subtle) {
        return bytesToHex(sha256(data));
    }
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds a structured representation of the identicon suitable for rendering directly
 * as JSX (`<svg><rect .../></svg>`), avoiding `dangerouslySetInnerHTML`.
 */
export function buildIdenticonShape(
    hashHex: string,
    size: number = DEFAULT_SIZE,
    grid: number = DEFAULT_GRID
): IdenticonShape {
    const { color, background } = colorsFromHash(hashHex);
    const cell = Math.floor(size / grid);
    const svgSize = cell * grid;

    const bits = hexToBits(hashHex);
    const halfGrid = Math.ceil(grid / 2);

    const cellCoordinates = Array.from({ length: grid }, (_, y) =>
        Array.from({ length: halfGrid }, (_, x) => ({ x, y }))
    ).flat();

    const rects: IdenticonRect[] = cellCoordinates
        .map((coord, bitIndex) => ({ ...coord, on: bits[bitIndex % bits.length] === "1" }))
        .filter(cellState => cellState.on)
        .flatMap(({ x, y }) => {
            const mirrorX = grid - 1 - x;
            const primary = buildRect(x, y, cell, color);
            return mirrorX === x ? [primary] : [primary, buildRect(mirrorX, y, cell, color)];
        });

    return { size: svgSize, background, color, rects };
}

/**
 * Serializes the identicon shape to an inline SVG string. Kept for the 3D texture
 * loader in `MetadataGraphView3D`, which feeds the SVG into `THREE.TextureLoader`.
 * For React rendering prefer `buildIdenticonShape` + JSX.
 */
export function buildIdenticonSvg(
    hashHex: string,
    size: number = DEFAULT_SIZE,
    grid: number = DEFAULT_GRID
): IdenticonResult {
    const shape = buildIdenticonShape(hashHex, size, grid);
    const rectStrings = shape.rects.map(
        r =>
            `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}" />`
    );
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${shape.size}" height="${shape.size}" viewBox="0 0 ${shape.size} ${shape.size}" shape-rendering="crispEdges">`,
        `<rect width="${shape.size}" height="${shape.size}" fill="${shape.background}" />`,
        rectStrings.join(""),
        "</svg>",
    ].join("");

    return { svg, color: shape.color, background: shape.background };
}

function buildRect(x: number, y: number, cell: number, fill: string): IdenticonRect {
    return { x: x * cell, y: y * cell, width: cell, height: cell, fill };
}

function hexToBits(hashHex: string): string {
    return hashHex
        .split("")
        .map(c => parseInt(c, 16).toString(2).padStart(4, "0"))
        .join("");
}

function colorsFromHash(hashHex: string): { color: string; background: string } {
    const hue = parseInt(hashHex.slice(0, 6), 16) % 360;
    const color = `hsl(${hue}, 65%, 45%)`;
    const background = `hsl(${(hue + 180) % 360}, 35%, 92%)`;
    return { color, background };
}
