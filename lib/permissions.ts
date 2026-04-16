// Menu key -> required permission keys (need at least one to see the menu)
export const MENU_PERMISSION_MAP: Record<string, string[]> = {
  // 资源管理
  book: ["resource.book.list"],
  script: ["resource.script.list"],
  comic: ["resource.comic.list"],
  downloadCenter: ["resource.comic.download"],
  // 剧本创作
  scriptCreate: ["scriptCreate.list"],
  // 漫剧制作
  taskHall: ["comicMake.hall.list"],
  myTask: ["comicMake.my.list"],
  // 审核管理
  scriptReview: ["review.script.hall_list", "review.script.my_list"],
  draftReview: ["review.comic.list"],
  // 系统设置
  userMgr: ["system.user.list"],
  roleMgr: ["system.role.list"],
}

// Parent menu key -> child keys (if ANY child is visible, parent is visible)
export const PARENT_MENU_CHILDREN: Record<string, string[]> = {
  resource: ["book", "script", "comic", "downloadCenter"],
  production: ["taskHall", "myTask"],
  review: ["scriptReview", "draftReview"],
  system: ["userMgr", "roleMgr"],
}

export function hasPermission(userPerms: string[], required: string | string[]): boolean {
  const keys = Array.isArray(required) ? required : [required]
  return keys.some((k) => userPerms.includes(k))
}

export function isMenuVisible(menuKey: string, userPerms: string[]): boolean {
  const children = PARENT_MENU_CHILDREN[menuKey]
  if (children) {
    return children.some((childKey) => isMenuVisible(childKey, userPerms))
  }
  const required = MENU_PERMISSION_MAP[menuKey]
  if (!required) return true
  return hasPermission(userPerms, required)
}

export function getFirstAllowedKey(userPerms: string[]): string | null {
  const order = [
    "book", "script", "comic", "downloadCenter",
    "scriptCreate",
    "taskHall", "myTask",
    "scriptReview", "draftReview",
    "userMgr", "roleMgr",
  ]
  return order.find((k) => isMenuVisible(k, userPerms)) ?? null
}
