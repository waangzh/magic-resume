import type { ReactNode } from "react";
import { getProjectLinkHref } from "@/lib/projectLink";

const LinkedTitle = ({ children, link, enabled }: { children: ReactNode; link?: string; enabled?: boolean }) => {
  const href = enabled === true ? getProjectLinkHref(link) : null;
  if (!href) return <>{children}</>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:opacity-80"
      title={href}
      onClick={event => event.stopPropagation()}
    >
      {children}
    </a>
  );
};

export default LinkedTitle;
