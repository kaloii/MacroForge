import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError, useSearchParams, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as BridgeAppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

import { authenticate } from "../shopify.server";
import { runBackgroundLogCleanup } from "../utils/cleanup.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Silently trigger background cleanup of activity logs older than 30 days (throttled to 24h per shop)
  runBackgroundLogCleanup(shopDomain);

  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const searchString = searchParams.toString();

  // Dynamically attach active query parameters to maintain Shopify context
  const getHref = (path: string) => {
    return searchString ? `${path}?${searchString}` : path;
  };

  const tabs = [
    { path: "/app", label: "Home" },
    { path: "/app/discounts", label: "Forge Stack Discount" },
    { path: "/app/rules", label: "Recommendation Rules" },
    { path: "/app/batches", label: "Food Batch Management" },
    { path: "/app/batch-losses", label: "Food Batch Losses" },
    { path: "/app/batch-losses", label: "Food Batch Waitlist" }
  ];

  return (
    <BridgeAppProvider apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        {/* Clean Browser Tabs Interface */}
        <div className="browser-tab-container">
          <nav className="browser-tab-bar">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path;
              return (
                <a
                  key={tab.path}
                  href={getHref(tab.path)}
                  className={`browser-tab ${isActive ? "active" : ""}`}
                >
                  {tab.label}
                </a>
              );
            })}
          </nav>
        </div>

        <Outlet />

        <style>{`
          .browser-tab-container {
            background-color: #1a051a;
            border-bottom: 1px solid #847996;
            padding-top: 8px;
          }
          .browser-tab-bar {
            display: flex;
            background-color: #1a051a;
            padding: 0 16px;
            gap: 4px;
            overflow-x: auto;
          }
          .browser-tab {
            display: flex;
            align-items: center;
            padding: 8px 18px;
            background-color: #220522;
            color: #847996;
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
            border: 1px solid #847996;
            border-bottom: none;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
          }
          .browser-tab:hover {
            background-color: #2c092c;
            color: #FDF0D5;
          }
          .browser-tab.active {
            background-color: #310A31;
            color: #FDF0D5;
            border-color: #847996;
            border-top: 3px solid #F15BB5;
            font-weight: 600;
          }
        `}</style>
      </PolarisAppProvider>
    </BridgeAppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};