"use client"

import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"

let toasts = []
const subscribers = new Set()

export function toast(props) {
  const id = Date.now().toString()
  const newToast = { id, open: true, ...props }
  toasts = [newToast, ...toasts]
  subscribers.forEach(cb => cb([...toasts]))

  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    subscribers.forEach(cb => cb([...toasts]))
  }, props.duration || 3000)

  return { id }
}

export function useToast() {
  const [state, setState] = React.useState(toasts)

  React.useEffect(() => {
    subscribers.add(setState)
    return () => subscribers.delete(setState)
  }, [])

  return { toast, toasts: state }
}
