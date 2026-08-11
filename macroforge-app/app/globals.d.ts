declare module "*.css";

import "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "s-link": React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLElement>, HTMLElement> & {
        href?: string;
        rel?: string;
      };
    }
  }
}