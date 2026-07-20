// Side-effect polyfill that installs a stub `GPUShaderStage` on the global object before
// any three.js / react-force-graph-3d module is evaluated.
//
// `three-render-objects` (a transitive dependency of `react-force-graph-3d`) ships an
// upstream polyfill that reads `self.GPUShaderStage` at module-load time:
//
//   const GPUShaderStage = (typeof self !== "undefined") ? self.GPUShaderStage
//                                                        : { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
//
// The check is wrong: `self` always exists in browsers, so the ternary always picks
// `self.GPUShaderStage`. In Firefox without `dom.webgpu.enabled`, that property is
// `undefined`, leaving the local binding `undefined`. Any later access such as
// `GPUShaderStage.VERTEX` then throws `TypeError: GPUShaderStage is undefined`,
// crashing module evaluation of the lazy 3D chunk and surfacing as the WebGL/WebGPU
// fallback in the UI.
//
// Installing a stub before three's module evaluates makes `self.GPUShaderStage` truthy
// so the upstream polyfill picks up sensible default constants. The 3D view never uses
// WebGPU (it renders via WebGL), so these constants are inert.
//
// Must be imported BEFORE `three` and `react-force-graph-3d` in any module that pulls
// them in. Vite preserves ES module import ordering, so an `import "./webgpu-polyfill"`
// listed first in the lazy chunk is enough.
const globalScope = globalThis as Record<string, unknown>;
if (globalScope.GPUShaderStage === undefined) {
    globalScope.GPUShaderStage = Object.freeze({ VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 });
}

export {};
