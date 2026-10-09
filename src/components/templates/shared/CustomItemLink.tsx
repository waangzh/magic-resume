import type { CustomItem } from "@/types/resume";
import { getStandaloneProjectLinkMeta } from "@/lib/projectLink";
import LinkedTitle from "./LinkedTitle";

const CustomItemLink = ({ item, fontSize }: { item: CustomItem; fontSize: number }) => {
  const link = getStandaloneProjectLinkMeta(item, { preferFullUrl: true });
  if (!link) return null;
  return (
    <div className="mt-1" style={{ fontSize: `${fontSize}px` }}>
      <LinkedTitle link={link.href} enabled>{link.label}</LinkedTitle>
    </div>
  );
};

export default CustomItemLink;
