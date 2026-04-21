import fs from "fs";
import path from "path";
import archiver from "archiver";

type PackageJson = {
    name: string;
};

const rootDir = process.cwd();
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;

if (!pkg.name) {
    throw new Error("package.json is missing the name field.");
}

const buildDir = path.join(rootDir, "build");
if (!fs.existsSync(buildDir)) {
    throw new Error("Build folder not found. Run the build step first.");
}

const zipPath = path.join(rootDir, `${pkg.name}.zip`);
fs.rmSync(zipPath, { force: true });

const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });

const finish = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    archive.on("warning", (err: unknown) => {
        if ((err as { code?: string }).code === "ENOENT") {
            return;
        }
        reject(err);
    });
    archive.on("error", (err: unknown) => reject(err));
});

archive.pipe(output);
archive.directory(buildDir, false);
archive.finalize();

finish
    .then(() => {
        process.stdout.write(
            `Created ${path.basename(zipPath)} (${archive.pointer()} bytes).${"\n"}`
        );
    })
    .catch(error => {
        process.stderr.write(`Failed to create zip. ${String(error)}${"\n"}`);
        process.exit(1);
    });
