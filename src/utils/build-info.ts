export type BuildInfo = {
    commit: string;
    shortCommit: string;
    builtAt: string;
};

const commit = (__APP_BUILD_COMMIT__ || "unknown").trim();
const builtAt = (__APP_BUILD_TIME__ || "").trim();

export const buildInfo: BuildInfo = {
    commit,
    shortCommit: commit.length > 12 ? commit.slice(0, 12) : commit,
    builtAt: builtAt || "unknown",
};

export const feedbackDescriptionTemplate = [`Build commit: ${buildInfo.commit}`, ""].join("\n");
