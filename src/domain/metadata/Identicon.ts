import { ResourceType } from "$/domain/metadata/ResourceType";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const DEFAULT_GRID = 5;
const DEFAULT_SIZE = 40;

export type IdenticonResult = {
    svg: string;
    color: string;
    background: string;
};

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

export function buildIdenticonSvg(
    hashHex: string,
    size: number = DEFAULT_SIZE,
    grid: number = DEFAULT_GRID
): IdenticonResult {
    const { color, background } = colorsFromHash(hashHex);
    const cell = Math.floor(size / grid);
    const svgSize = cell * grid;
    const rects: string[] = [];

    const bits = hexToBits(hashHex);
    let bitIndex = 0;

    for (let y = 0; y < grid; y += 1) {
        for (let x = 0; x < Math.ceil(grid / 2); x += 1) {
            const on = bits[bitIndex % bits.length] === "1";
            bitIndex += 1;
            if (!on) continue;
            const mirrorX = grid - 1 - x;
            rects.push(rect(x, y, cell, color));
            if (mirrorX !== x) {
                rects.push(rect(mirrorX, y, cell, color));
            }
        }
    }

    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" shape-rendering="crispEdges">`,
        `<rect width="${svgSize}" height="${svgSize}" fill="${background}" />`,
        rects.join(""),
        "</svg>",
    ].join("");

    return { svg, color, background };
}

function rect(x: number, y: number, cell: number, fill: string): string {
    return `<rect x="${x * cell}" y="${
        y * cell
    }" width="${cell}" height="${cell}" fill="${fill}" />`;
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
