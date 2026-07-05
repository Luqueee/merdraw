import { useStore, type SidebarTab } from '../flow/store';
import { Inspector } from './Inspector';
import { MermaidPanel } from './MermaidPanel';
import { IconPicker } from './IconPicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function Sidebar() {
  const tab = useStore((s) => s.sidebarTab);
  const setTab = useStore((s) => s.setSidebarTab);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l bg-sidebar">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as SidebarTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="m-3 mb-0 shrink-0">
          <TabsTrigger value="diagram">Diagrama</TabsTrigger>
          <TabsTrigger value="icons">Iconos</TabsTrigger>
        </TabsList>

        <TabsContent
          value="diagram"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <Inspector />
          <MermaidPanel />
        </TabsContent>

        <TabsContent
          value="icons"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <IconPicker />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
