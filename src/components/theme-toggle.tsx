"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { useTheme } from "./theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  // Determine current effective theme (resolve 'system' to actual theme)
  const [currentTheme, setCurrentTheme] = React.useState<'light' | 'dark'>('light')

  React.useEffect(() => {
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setCurrentTheme(systemTheme)
    } else {
      setCurrentTheme(theme as 'light' | 'dark')
    }
  }, [theme])

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  return (
    <Button
      variant="outline"
      className="bg-card border-border hover:bg-accent"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
