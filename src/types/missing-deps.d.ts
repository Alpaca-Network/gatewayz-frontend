// Type declarations for optional UI dependencies that may not be installed
// These components are optional and may not be used in the current build

declare module 'vaul' {
  export const Drawer: any;
  export const DrawerContent: any;
  export const DrawerTrigger: any;
  export const DrawerHeader: any;
  export const DrawerTitle: any;
  export const DrawerDescription: any;
  export const DrawerFooter: any;
}

declare module 'input-otp' {
  export const OTPInput: any;
  export const OTPInputContext: any;
}

declare module '@radix-ui/react-aspect-ratio' {
  export const AspectRatio: any;
}

declare module '@radix-ui/react-context-menu' {
  export const ContextMenu: any;
  export const ContextMenuTrigger: any;
  export const ContextMenuContent: any;
  export const ContextMenuItem: any;
}

declare module '@radix-ui/react-hover-card' {
  export const HoverCard: any;
  export const HoverCardTrigger: any;
  export const HoverCardContent: any;
}

declare module '@radix-ui/react-navigation-menu' {
  export const NavigationMenu: any;
  export const NavigationMenuList: any;
  export const NavigationMenuItem: any;
  export const NavigationMenuTrigger: any;
  export const NavigationMenuContent: any;
}

declare module '@radix-ui/react-toggle-group' {
  export const Root: any;
  export const Item: any;
  const ToggleGroup: any;
  export default { Root, Item };
}

declare module '@radix-ui/react-toggle' {
  export const Root: any;
  const Toggle: any;
  export default { Root };
}

declare module 'react-resizable-panels' {
  export const Panel: any;
  export const PanelGroup: any;
  export const PanelResizeHandle: any;
}

declare module 'next-themes' {
  export const ThemeProvider: any;
  export const useTheme: any;
}

declare module 'sonner' {
  export const toast: any;
  export const Toaster: any;
}

