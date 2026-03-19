import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useDataEngine } from "@dhis2/app-runtime";
import { HeaderBar } from "@dhis2/ui";
import { SnackbarProvider } from "@eyeseetea/d2-ui-components";
import { Feedback } from "@eyeseetea/feedback-component";
import { MuiThemeProvider } from "@material-ui/core/styles";
//@ts-ignore
import OldMuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import { appConfig } from "$/app-config";
import { getWebappCompositionRoot } from "$/CompositionRoot";
import { Share } from "$/webapp/components/share/Share";
import { AppContext, AppContextState } from "$/webapp/contexts/app-context";
import { MetadataExplorerPage } from "$/webapp/pages/metadata/MetadataExplorerPage";
import { configI18n } from "$/webapp/utils/i18n-setup";
import { buildInfo } from "$/utils/build-info";
import i18n from "$/utils/i18n";
import "./App.css";
import muiThemeLegacy from "./themes/dhis2-legacy.theme";
import { muiTheme } from "./themes/dhis2.theme";

function App_(_props: {}) {
    const dataEngine = useDataEngine();
    const [showShareButton, setShowShareButton] = useState(false);
    const [appState, setAppState] = useState<AppState>({ type: "loading" });

    useEffect(() => {
        async function setup() {
            const compositionRoot = getWebappCompositionRoot(dataEngine);
            const isShareButtonVisible = appConfig.appearance.showShareButton;
            const [currentUser, localeSettings] = await Promise.all([
                compositionRoot.users.getCurrent.execute().toPromise(),
                compositionRoot.system.getUiLocale.execute().toPromise(),
            ]);

            configI18n(localeSettings);

            setShowShareButton(isShareButtonVisible);
            setAppState({ type: "loaded", data: { currentUser, compositionRoot } });
        }
        setup().catch(error => setAppState({ type: "error", error }));
    }, [dataEngine]);

    if (appState.type === "loading") return null;
    if (appState.type === "error") {
        return <h3 style={{ margin: 20 }}>{appState.error.message}</h3>;
    }

    const appContext: AppContextState = {
        currentUser: appState.data.currentUser,
        compositionRoot: appState.data.compositionRoot,
    };

    return (
        <MuiThemeProvider theme={muiTheme}>
            <OldMuiThemeProvider muiTheme={muiThemeLegacy}>
                <SnackbarProvider>
                    <StyledHeaderBar appName={i18n.t("Metadata Visualizer")} />

                    {appConfig.feedback && appContext && (
                        <Feedback
                            options={appConfig.feedback}
                            username={appContext.currentUser.username}
                        />
                    )}

                    <div id="app" className="content">
                        <AppContext.Provider value={appContext}>
                            <MetadataExplorerPage />
                        </AppContext.Provider>

                        <BuildStamp data-build-commit={buildInfo.commit} data-build-time={buildInfo.builtAt}>
                            {`build:${buildInfo.commit}`}
                        </BuildStamp>
                    </div>

                    <Share visible={showShareButton} />
                </SnackbarProvider>
            </OldMuiThemeProvider>
        </MuiThemeProvider>
    );
}

const StyledHeaderBar = styled(HeaderBar)`
    div:first-of-type {
        box-sizing: border-box;
    }
`;

const BuildStamp = styled.div`
    display: block;
    width: fit-content;
    margin: 4px 0 0 auto;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.2px;
    color: transparent;
    user-select: text;
    cursor: text;

    &::selection {
        color: #6b7280;
        background: #d1d5db;
    }

    &::-moz-selection {
        color: #6b7280;
        background: #d1d5db;
    }
`;

export const App = React.memo(App_);

type AppState =
    | { type: "loading" }
    | { type: "loaded"; data: AppContextState }
    | { type: "error"; error: Error };
