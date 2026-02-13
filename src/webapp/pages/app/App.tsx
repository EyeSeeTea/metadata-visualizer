import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useDataEngine } from "@dhis2/app-runtime";
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
                    <AppHeader>
                        <AppTitle>Metadata Visualizer</AppTitle>
                        <AppUser>
                            {appContext.currentUser.name} ({appContext.currentUser.username})
                        </AppUser>
                    </AppHeader>

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
                    </div>

                    <Share visible={showShareButton} />
                </SnackbarProvider>
            </OldMuiThemeProvider>
        </MuiThemeProvider>
    );
}

const AppHeader = styled.header`
    height: 48px;
    background: #2c6693;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
`;

const AppTitle = styled.h1`
    font-size: 16px;
    font-weight: 600;
    margin: 0;
`;

const AppUser = styled.div`
    font-size: 12px;
    opacity: 0.85;
`;

export const App = React.memo(App_);

type AppState =
    | { type: "loading" }
    | { type: "loaded"; data: AppContextState }
    | { type: "error"; error: Error };
