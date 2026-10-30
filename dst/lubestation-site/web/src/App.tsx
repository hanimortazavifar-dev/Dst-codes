import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { createBrowserRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";
import RequireRole from "./components/RequireRole";
import { AuthProvider } from "./lib/auth";
import { ROUTES, SITE_URL } from "./routes";
import CoreOperations from "./pages/CoreOperations";
import NotFound from "./pages/NotFound";
import PartnerEcosystem from "./pages/PartnerEcosystem";

// The three.js pages and the signed-in pages are split into their own chunks.
const Home = lazy(() => import("./pages/Home"));
const CorporateGovernance = lazy(() => import("./pages/CorporateGovernance"));
const TechnicalSupport = lazy(() => import("./pages/TechnicalSupport"));
const Admin = lazy(() => import("./pages/Admin"));
const DealerReport = lazy(() => import("./pages/DealerReport"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const SchemeOverview = lazy(() => import("./pages/SchemeOverview"));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="app-error" dir="rtl" role="alert">
        <p>مشکلی در نمایش این صفحه پیش آمد.</p>
        <button type="button" onClick={() => location.reload()}>
          بارگذاری دوباره
        </button>
      </div>
    );
  }
}

function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: scrollTo returns a Promise in newer browsers, which must not become the cleanup.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return (
    <ErrorBoundary key={pathname}>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );
}

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** Sets the document title, description, canonical URL and robots policy for a route. */
function Page({ title, description, path, noindex, children }: { title: string; description?: string; path?: string; noindex?: boolean; children: ReactNode }) {
  useEffect(() => {
    document.title = title;
    const meta = (name: string) => () => Object.assign(document.createElement("meta"), { name });
    if (description) setMeta('meta[name="description"]', meta("description"), "content", description);
    setMeta('meta[name="robots"]', meta("robots"), "content", noindex ? "noindex, nofollow" : "index, follow");
    if (path != null) setMeta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", SITE_URL + path);
  }, [title, description, path, noindex]);
  return children;
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        {
          path: ROUTES.home,
          element: (
            <Page title="LUBESTATION — DST" path={ROUTES.home} description="LUBESTATION: سامانه مدیریت و پایش مخازن هوشمند روغن دیزل DST در نمایندگی‌های سراسر کشور.">
              <RequireRole page="home">
                <Home />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.governance,
          element: (
            <Page title="مدیریت مخازن — LUBESTATION" noindex>
              <RequireRole page="governance">
                <CorporateGovernance />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.partners,
          element: (
            <Page title="انتخاب نمایندگی — LUBESTATION" path={ROUTES.partners} description="نمایندگی‌های طرح روغن فله LUBESTATION در سراسر کشور.">
              <RequireRole page="partners">
                <PartnerEcosystem />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: `${ROUTES.dealerReport}/:slug`,
          element: (
            <Page title="گزارش نمایندگی — LUBESTATION" noindex>
              <RequireRole page="dealers">
                <DealerReport />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.support,
          element: (
            <Page title="پشتیبانی فنی — LUBESTATION" noindex>
              <RequireRole page="support">
                <TechnicalSupport />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.scheme,
          element: (
            <Page title="معرفی طرح و راهنمای مخزن — LUBESTATION" noindex>
              {/* Every signed-in user, whatever pages they were given. */}
              <RequireRole page="signedIn">
                <SchemeOverview />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.core,
          element: (
            <Page title="Core Operations — DST" path={ROUTES.core} description="معرفی شرکت DST (Diesel Super Technology) و محصولات آن.">
              <RequireRole page="core">
                <CoreOperations />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.admin,
          element: (
            <Page title="مدیریت سامانه — LUBESTATION" noindex>
              <RequireRole page="admin">
                <Admin />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: ROUTES.account,
          element: (
            <Page title="تغییر رمز عبور — LUBESTATION" noindex>
              <RequireRole page="signedIn">
                <ChangePassword />
              </RequireRole>
            </Page>
          ),
        },
        {
          path: "*",
          element: (
            <Page title="صفحه پیدا نشد — LUBESTATION" noindex>
              <NotFound />
            </Page>
          ),
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
