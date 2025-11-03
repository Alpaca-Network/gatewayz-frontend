// Type declarations for optional UI dependencies that may not be installed
// These components are optional and may not be used in the current build

type ComponentType = React.ComponentType<any>;
type AnyExport = any;

declare module 'vaul' {
  export const Drawer: AnyExport;
  export const DrawerContent: AnyExport;
  export const DrawerTrigger: AnyExport;
  export const DrawerHeader: AnyExport;
  export const DrawerTitle: AnyExport;
  export const DrawerDescription: AnyExport;
  export const DrawerFooter: AnyExport;
}

declare module 'input-otp' {
  export const OTPInput: AnyExport;
  export const OTPInputContext: AnyExport;
}

declare module '@radix-ui/react-aspect-ratio' {
  const AspectRatioPrimitive: { Root: ComponentType };
  export = AspectRatioPrimitive;
}

declare module '@radix-ui/react-context-menu' {
  const ContextMenuPrimitive: {
    Root: ComponentType;
    Trigger: ComponentType;
    Group: ComponentType;
    Portal: ComponentType;
    Sub: ComponentType;
    RadioGroup: ComponentType;
    SubTrigger: ComponentType;
    SubContent: ComponentType;
    Content: ComponentType;
    Item: ComponentType;
    CheckboxItem: ComponentType;
    ItemIndicator: ComponentType;
    RadioItem: ComponentType;
    Label: ComponentType;
    Separator: ComponentType;
  };
  export = ContextMenuPrimitive;
}

declare module '@radix-ui/react-hover-card' {
  const HoverCardPrimitive: { Root: ComponentType; Trigger: ComponentType; Content: ComponentType };
  export = HoverCardPrimitive;
}

declare module '@radix-ui/react-navigation-menu' {
  const NavigationMenuPrimitive: {
    Root: ComponentType;
    List: ComponentType;
    Item: ComponentType;
    Trigger: ComponentType;
    Content: ComponentType;
    Indicator: ComponentType;
    Viewport: ComponentType;
    Link: ComponentType;
  };
  export = NavigationMenuPrimitive;
}

declare module '@radix-ui/react-toggle-group' {
  const ToggleGroupPrimitive: { Root: ComponentType; Item: ComponentType };
  export = ToggleGroupPrimitive;
}

declare module '@radix-ui/react-toggle' {
  const TogglePrimitive: { Root: ComponentType };
  export = TogglePrimitive;
}

declare module 'react-resizable-panels' {
  export const Panel: AnyExport;
  export const PanelGroup: AnyExport;
  export const PanelResizeHandle: AnyExport;
}

declare module 'next-themes' {
  export const ThemeProvider: AnyExport;
  export const useTheme: AnyExport;
}

declare module 'sonner' {
  export const toast: AnyExport;
  export const Toaster: AnyExport;
}
