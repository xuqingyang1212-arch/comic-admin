"use client"

import { useState, useEffect, useMemo, createContext, useContext } from "react"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"
import ContentArea from "@/components/content-area"
import { getToken, setToken, authApi } from "@/lib/api"
import { isMenuVisible, getFirstAllowedKey, hasPermission } from "@/lib/permissions"

export interface MenuItem {
  key: string
  label: string
  icon: string
  children?: SubMenuItem[]
}

export interface SubMenuItem {
  key: string
  label: string
  parentKey: string
  parentLabel: string
}

export const menuData: MenuItem[] = [
  {
    key: "resource",
    label: "资源管理",
    icon: "folder",
    children: [
      { key: "book", label: "书籍管理", parentKey: "resource", parentLabel: "资源管理" },
      { key: "script", label: "剧本管理", parentKey: "resource", parentLabel: "资源管理" },
      { key: "comic", label: "漫剧管理", parentKey: "resource", parentLabel: "资源管理" },
      { key: "downloadCenter", label: "下载中心", parentKey: "resource", parentLabel: "资源管理" },
    ],
  },
  {
    key: "scriptCreate",
    label: "剧本创作",
    icon: "pen",
  },
  {
    key: "production",
    label: "漫剧制作",
    icon: "film",
    children: [
      { key: "taskHall", label: "任务大厅", parentKey: "production", parentLabel: "漫剧制作" },
      { key: "myTask", label: "我的任务", parentKey: "production", parentLabel: "漫剧制作" },
    ],
  },
  {
    key: "review",
    label: "审核管理",
    icon: "check",
    children: [
      { key: "scriptReview", label: "剧本审核", parentKey: "review", parentLabel: "审核管理" },
      { key: "draftReview", label: "漫剧审核", parentKey: "review", parentLabel: "审核管理" },
    ],
  },
  {
    key: "system",
    label: "系统设置",
    icon: "settings",
    children: [
      { key: "userMgr", label: "用户管理", parentKey: "system", parentLabel: "系统设置" },
      { key: "roleMgr", label: "角色管理", parentKey: "system", parentLabel: "系统设置" },
      { key: "registerReview", label: "注册审核", parentKey: "system", parentLabel: "系统设置" },
    ],
  },
]

// ─── Permission Context ─────────────────────────────────────────────────────
const PermContext = createContext<string[]>([])
export function usePermissions() { return useContext(PermContext) }
export function usePerm(key: string | string[]) { return hasPermission(usePermissions(), key) }

export default function AdminLayout() {
  const [authReady, setAuthReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ name: string; permissions: string[] } | null>(null)

  useEffect(() => {
    const ALL_PERMS = [
      "resource.book.list", "resource.script.list", "resource.comic.list", "resource.comic.download",
      "scriptCreate.list",
      "comicMake.hall.list", "comicMake.my.list",
      "review.script.hall_list", "review.script.my_list", "review.comic.list",
      "system.user.list", "system.role.list",
    ]

    async function initAuth() {
      const token = getToken()
      if (!token) {
        window.location.href = "/login"
        return
      }
      try {
        const data = await authApi.me()
        setCurrentUser({ name: data.user?.name || "", permissions: data.permissions || [] })
      } catch {
        window.location.href = "/login"
        return
      }
      setAuthReady(true)
    }

    initAuth()
  }, [])

  const perms = currentUser?.permissions ?? []

  const filteredMenu = useMemo(() => {
    return menuData
      .filter((item) => isMenuVisible(item.key, perms))
      .map((item) => {
        if (!item.children) return item
        return {
          ...item,
          children: item.children.filter((sub) => isMenuVisible(sub.key, perms)),
        }
      })
      .filter((item) => !item.children || item.children.length > 0)
  }, [perms])

  const defaultKey = useMemo(() => getFirstAllowedKey(perms) ?? "book", [perms])

  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    "resource",
    "production",
    "review",
    "system",
    "scriptCreate",
  ])
  const [selectedKey, setSelectedKeyRaw] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "")
      if (hash) return hash
    }
    return ""
  })

  function setSelectedKey(key: string) {
    setSelectedKeyRaw(key)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${key}`)
    }
  }

  useEffect(() => {
    if (authReady && !selectedKey) {
      setSelectedKey(defaultKey)
    }
  }, [authReady, defaultKey, selectedKey])

  // If current selectedKey becomes invisible (e.g. after role change), reset
  useEffect(() => {
    if (authReady && selectedKey && !isMenuVisible(selectedKey, perms)) {
      setSelectedKey(defaultKey)
    }
  }, [authReady, selectedKey, perms, defaultKey])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleMenuClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpand(item.key)
    } else {
      setSelectedKey(item.key)
    }
  }

  const handleSubMenuClick = (subItem: SubMenuItem) => {
    setSelectedKey(subItem.key)
  }

  const getBreadcrumb = (): { parent?: string; current: string } => {
    for (const item of filteredMenu) {
      if (!item.children && item.key === selectedKey) {
        return { current: item.label }
      }
      if (item.children) {
        const sub = item.children.find((c) => c.key === selectedKey)
        if (sub) return { parent: item.label, current: sub.label }
      }
    }
    return { current: "" }
  }

  const breadcrumb = getBreadcrumb()

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f6f7f9]">
        <p className="text-[14px] text-[#6b7280]">加载中...</p>
      </div>
    )
  }

  return (
    <PermContext.Provider value={perms}>
      <div className="flex h-screen overflow-hidden bg-[#f6f7f9]">
        <Sidebar
          menuData={filteredMenu}
          expandedKeys={expandedKeys}
          selectedKey={selectedKey}
          onMenuClick={handleMenuClick}
          onSubMenuClick={handleSubMenuClick}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header userName={currentUser?.name} />
          <ContentArea breadcrumb={breadcrumb} selectedKey={selectedKey} />
        </div>
      </div>
    </PermContext.Provider>
  )
}
