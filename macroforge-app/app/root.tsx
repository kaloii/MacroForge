import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const loader = async ({request}: LoaderFunctionArgs) => {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || ""
  }
}

export function links() {
  return [{ rel: "stylesheet", href: polarisStyles }];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { apiKey } = useLoaderData<typeof loader>();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="shopify-api-key" content={apiKey} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}