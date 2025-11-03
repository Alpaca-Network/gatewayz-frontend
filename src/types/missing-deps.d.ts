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
  const AspectRatioPrimitive: {
    Root: React.ComponentType<any>;
  };
  export default AspectRatioPrimitive;
}

declare module '@radix-ui/react-context-menu' {
  const ContextMenuPrimitive: {
    Root: React.ComponentType<any>;
    Trigger: React.ComponentType<any>;
    Group: React.ComponentType<any>;
    Portal: React.ComponentType<any>;
    Sub: React.ComponentType<any>;
    RadioGroup: React.ComponentType<any>;
    SubTrigger: React.ComponentType<any>;
    SubContent: React.ComponentType<any>;
    Content: React.ComponentType<any>;
    Item: React.ComponentType<any>;
    CheckboxItem: React.ComponentType<any>;
    ItemIndicator: React.ComponentType<any>;
    RadioItem: React.ComponentType<any>;
    Label: React.ComponentType<any>;
    Separator: React.ComponentType<any>;
  };
  export default ContextMenuPrimitive;
}

declare module '@radix-ui/react-hover-card' {
  const HoverCardPrimitive: {
    Root: React.ComponentType<any>;
    Trigger: React.ComponentType<any>;
    Content: React.ComponentType<any>;
  };
  export default HoverCardPrimitive;
}

declare module '@radix-ui/react-navigation-menu' {
  const NavigationMenuPrimitive: {
    Root: React.ComponentType<any>;
    List: React.ComponentType<any>;
    Item: React.ComponentType<any>;
    Trigger: React.ComponentType<any>;
    Content: React.ComponentType<any>;
    Indicator: React.ComponentType<any>;
    Viewport: React.ComponentType<any>;
    Link: React.ComponentType<any>;
  };
  export default NavigationMenuPrimitive;
}

declare module '@radix-ui/react-toggle-group' {
  const ToggleGroupPrimitive: {
    Root: React.ComponentType<any>;
    Item: React.ComponentType<any>;
  };
  export default ToggleGroupPrimitive;
}

declare module '@radix-ui/react-toggle' {
  const TogglePrimitive: {
    Root: React.ComponentType<any>;
  };
  export default TogglePrimitive;
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
