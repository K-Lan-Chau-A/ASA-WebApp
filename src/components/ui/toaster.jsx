"use client"

import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { useToast } from "./use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map(t => (
        <ToastPrimitive.Root
          key={t.id}
          open={t.open}
          className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-in fade-in-90 slide-in-from-bottom-5"
        >
          <div className="font-semibold text-gray-800">{t.title}</div>
          {t.description && (
            <div className="text-sm text-gray-600 mt-1">{t.description}</div>
          )}
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport />
    </ToastPrimitive.Provider>
  )
}
