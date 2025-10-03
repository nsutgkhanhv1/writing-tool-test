import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Route, Router, useLocation } from "wouter";
import { FullScreenContainer } from "./components/fullscreen";
import Layout from "./components/Layout";
import { AnonoymousLoginPage } from "./pages/AnonymousLogin.page";

const queryClient = new QueryClient();

function App() {
  const [location] = useLocation();

  return (
    <FullScreenContainer className="flex flex-col">
      <QueryClientProvider client={queryClient}>
        <Layout key={location}>
          <Router>
            <Route path={"/"} component={AnonoymousLoginPage} />
          </Router>
        </Layout>
      </QueryClientProvider>

      <ToastContainer
        position="top-right"
        style={{
          padding: "0 24px",
          margin: "auto",
          top: 50,
          right: 0,
          zIndex: 99,
          height: "fit-content",
        }}
        theme="dark"
        closeOnClick
        autoClose={2000}
      />
    </FullScreenContainer>
  );
}

export default App;
