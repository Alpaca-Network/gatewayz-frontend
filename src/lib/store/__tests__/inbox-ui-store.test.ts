import { useInboxUIStore, ColumnView } from "../inbox-ui-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("useInboxUIStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useInboxUIStore.setState({
      columnView: "1",
      _hasHydrated: false,
    });
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have default column view of 1", () => {
      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
    });

    it("should have _hasHydrated as false initially", () => {
      const state = useInboxUIStore.getState();
      expect(state._hasHydrated).toBe(false);
    });
  });

  describe("setColumnView", () => {
    it("should update column view to 1", () => {
      const { setColumnView } = useInboxUIStore.getState();
      setColumnView("1");

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
    });

    it("should update column view to 2", () => {
      const { setColumnView } = useInboxUIStore.getState();
      setColumnView("2");

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("2");
    });

    it("should persist column view to localStorage", () => {
      const { setColumnView } = useInboxUIStore.getState();
      setColumnView("2");

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "gatewayz_kanban_column_view",
        "2"
      );
    });
  });

  describe("toggleColumnView", () => {
    it("should toggle from 1 to 2", () => {
      useInboxUIStore.setState({ columnView: "1" });
      const { toggleColumnView } = useInboxUIStore.getState();
      toggleColumnView();

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("2");
    });

    it("should toggle from 2 to 1", () => {
      useInboxUIStore.setState({ columnView: "2" });
      const { toggleColumnView } = useInboxUIStore.getState();
      toggleColumnView();

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
    });

    it("should persist toggled value to localStorage", () => {
      useInboxUIStore.setState({ columnView: "1" });
      const { toggleColumnView } = useInboxUIStore.getState();
      toggleColumnView();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "gatewayz_kanban_column_view",
        "2"
      );
    });
  });

  describe("syncColumnViewState", () => {
    it("should sync column view from localStorage", () => {
      localStorageMock.getItem.mockReturnValueOnce("2");
      const { syncColumnViewState } = useInboxUIStore.getState();
      syncColumnViewState();

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("2");
      expect(state._hasHydrated).toBe(true);
    });

    it("should default to 1 if localStorage is empty", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);
      const { syncColumnViewState } = useInboxUIStore.getState();
      syncColumnViewState();

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
      expect(state._hasHydrated).toBe(true);
    });

    it("should default to 1 if localStorage has invalid value", () => {
      localStorageMock.getItem.mockReturnValueOnce("invalid");
      const { syncColumnViewState } = useInboxUIStore.getState();
      syncColumnViewState();

      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
    });

    it("should only run once (idempotent)", () => {
      localStorageMock.getItem.mockReturnValueOnce("2");
      const { syncColumnViewState } = useInboxUIStore.getState();

      syncColumnViewState();
      expect(useInboxUIStore.getState().columnView).toBe("2");

      // Simulate changing value in localStorage
      localStorageMock.getItem.mockReturnValueOnce("1");
      syncColumnViewState(); // Should not change since already hydrated

      expect(useInboxUIStore.getState().columnView).toBe("2");
    });

    it("should set _hasHydrated to true after sync", () => {
      const { syncColumnViewState } = useInboxUIStore.getState();
      syncColumnViewState();

      const state = useInboxUIStore.getState();
      expect(state._hasHydrated).toBe(true);
    });
  });

  describe("localStorage error handling", () => {
    it("should handle localStorage.setItem errors gracefully", () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage quota exceeded");
      });

      const { setColumnView } = useInboxUIStore.getState();
      // Should not throw
      expect(() => setColumnView("2")).not.toThrow();

      // State should still be updated
      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("2");
    });

    it("should handle localStorage.getItem errors gracefully in sync", () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error("Access denied");
      });

      const { syncColumnViewState } = useInboxUIStore.getState();
      // Should not throw
      expect(() => syncColumnViewState()).not.toThrow();

      // Should default to 1
      const state = useInboxUIStore.getState();
      expect(state.columnView).toBe("1");
    });
  });
});
