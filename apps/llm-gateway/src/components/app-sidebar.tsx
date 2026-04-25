'use client';

import { LogOut, RouterIcon } from 'lucide-react';

import { sidebarData, type GatewayCenterId } from '@/components/dashboard-data';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { logoutAdmin } from '@/auth/admin-client-auth';

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeCenter: GatewayCenterId;
  onCenterSelect: (center: GatewayCenterId) => void;
}

export function AppSidebar({ activeCenter, onCenterSelect, ...props }: AppSidebarProps) {
  async function handleLogout() {
    await logoutAdmin();
    window.location.assign('/admin/login');
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="px-5 py-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-9 data-[slot=sidebar-menu-button]:!p-1">
              <button onClick={() => onCenterSelect('runtime')} type="button">
                <RouterIcon className="h-5 w-5" />
                <span className="text-base font-semibold text-foreground">大模型网关</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-5 px-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {sidebarData.navMain.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className="h-10"
                    isActive={activeCenter === item.id}
                    onClick={() => onCenterSelect(item.id)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden p-0">
          <SidebarGroupLabel>网关治理</SidebarGroupLabel>
          <SidebarMenu>
            {sidebarData.documents.map(item => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton isActive={activeCenter === item.id} onClick={() => onCenterSelect(item.id)}>
                  <item.icon />
                  <span>{item.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-5 py-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-background text-xs font-semibold">
                GW
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">网关管理员</span>
                <span className="truncate text-xs text-muted-foreground">私有运行时</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
