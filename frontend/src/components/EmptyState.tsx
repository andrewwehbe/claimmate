import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Icon size={20} className="text-gray-300" aria-hidden />
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {description && <div className="max-w-sm text-xs text-gray-500">{description}</div>}
    </div>
  );
}
