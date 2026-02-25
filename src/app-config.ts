import { FeedbackOptions } from "@eyeseetea/feedback-component";
import { buildInfo, feedbackDescriptionTemplate } from "$/utils/build-info";

export const appConfig: AppConfig = {
    id: "coc-visualizer",
    appearance: {
        showShareButton: true,
    },
    feedback: {
        repositories: {
            clickUp: {
                // https://app.clickup.com/${workspace}/v/b/N-${listId}-M
                // Web development -> Common resources -> app-skeleton
                listId: "42597084",
                title: "[User feedback] {title}",
                body: `## dhis2\n\nUsername: {username}\nBuild commit: ${buildInfo.commit}\n\n{body}`,
            },
        },
        layoutOptions: {
            buttonPosition: "bottom-start",
            descriptionTemplate: feedbackDescriptionTemplate,
        },
    },
};

export type AppConfig = {
    id: string;
    appearance: {
        showShareButton: boolean;
    };
    feedback?: FeedbackOptions;
};
