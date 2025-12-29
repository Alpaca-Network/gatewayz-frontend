"use client"

// Inspired by react-hot-toast library
import * as React from "react"
import { captureHookError } from "@/lib/sentry-utils"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 4000 // 4 seconds

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  try {
    switch (action.type) {
      case "ADD_TOAST":
        return {
          ...state,
          toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
        }

      case "UPDATE_TOAST":
        return {
          ...state,
          toasts: state.toasts.map((t) =>
            t.id === action.toast.id ? { ...t, ...action.toast } : t
          ),
        }

      case "DISMISS_TOAST": {
        const { toastId } = action

        // ! Side effects ! - This could be extracted into a dismissToast() action,
        // but I'll keep it here for simplicity
        if (toastId) {
          addToRemoveQueue(toastId)
        } else {
          state.toasts.forEach((toast) => {
            addToRemoveQueue(toast.id)
          })
        }

        return {
          ...state,
          toasts: state.toasts.map((t) =>
            t.id === toastId || toastId === undefined
              ? {
                  ...t,
                  open: false,
                }
              : t
          ),
        }
      }
      case "REMOVE_TOAST":
        if (action.toastId === undefined) {
          return {
            ...state,
            toasts: [],
          }
        }
        return {
          ...state,
          toasts: state.toasts.filter((t) => t.id !== action.toastId),
        }
    }
  } catch (error) {
    captureHookError(error, {
      hookName: 'useToast',
      operation: 'reducer',
      actionType: action.type,
    });
    return state;
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  try {
    memoryState = reducer(memoryState, action)
    listeners.forEach((listener) => {
      try {
        listener(memoryState)
      } catch (error) {
        captureHookError(error, {
          hookName: 'useToast',
          operation: 'listener_dispatch',
        });
      }
    })
  } catch (error) {
    captureHookError(error, {
      hookName: 'useToast',
      operation: 'dispatch',
      actionType: action.type,
    });
  }
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  try {
    const id = genId()

    const update = (props: ToasterToast) => {
      try {
        dispatch({
          type: "UPDATE_TOAST",
          toast: { ...props, id },
        })
      } catch (error) {
        captureHookError(error, {
          hookName: 'useToast',
          operation: 'update',
          toastId: id,
        });
      }
    }

    const dismiss = () => {
      try {
        dispatch({ type: "DISMISS_TOAST", toastId: id })
      } catch (error) {
        captureHookError(error, {
          hookName: 'useToast',
          operation: 'dismiss',
          toastId: id,
        });
      }
    }

    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          try {
            if (!open) dismiss()
          } catch (error) {
            captureHookError(error, {
              hookName: 'useToast',
              operation: 'onOpenChange',
              toastId: id,
            });
          }
        },
      },
    })

    return {
      id: id,
      dismiss,
      update,
    }
  } catch (error) {
    captureHookError(error, {
      hookName: 'useToast',
      operation: 'toast',
    });
    // Return a fallback object in case of error
    return {
      id: '-1',
      dismiss: () => {},
      update: () => {},
    }
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    try {
      listeners.push(setState)
      return () => {
        try {
          const index = listeners.indexOf(setState)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        } catch (error) {
          captureHookError(error, {
            hookName: 'useToast',
            operation: 'cleanup',
          });
        }
      }
    } catch (error) {
      captureHookError(error, {
        hookName: 'useToast',
        operation: 'useEffect',
      });
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      try {
        dispatch({ type: "DISMISS_TOAST", toastId })
      } catch (error) {
        captureHookError(error, {
          hookName: 'useToast',
          operation: 'hook_dismiss',
          toastId,
        });
      }
    },
  }
}

export { useToast, toast }
