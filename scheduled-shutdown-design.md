# 定时关闭功能设计文档

## 功能概述

在「阅读设置」中新增「定时关闭」：设定一个时刻（如 `23:00`），到达该时刻后**整体退出软件**，
退出动作与「老师屏」完全一致（先保存阅读进度，再 `app.terminate()`）。

---

## 页面结构

```
more.ux（设置）
  └─ readingSetting.ux（阅读设置）
       └─ "定时关闭 / 到点自动退出软件" → scheduledShutdown.ux
```

### 1. readingSetting.ux 修改

在 `休息提醒` 之后插入入口项：

```html
<list-item class="item" @click="routerTo('scheduledShutdown')" type="item">
    <div class="item-content">
        <text class="itemtext" static>定时关闭</text>
        <text class="itemtext2">{{shutdownSummary}}</text>
    </div>
    <img src="/common/images/enter.png" style="width:32px;height: 32px;" static/>
</list-item>
```

副标题 `shutdownSummary` 为动态文案：

| 状态 | 文案 |
|---|---|
| 未开启 | `到点自动退出软件` |
| 已开启 | `每天 23:00 自动退出` |

在 `loadSettings()` 中调用 `loadShutdownSummary()` 读取 `EBOOK_SCHEDULED_SHUTDOWN_ENABLED`
与 `EBOOK_SCHEDULED_SHUTDOWN_TIME`。

### 2. scheduledShutdown.ux（新建配置页）

时间用**数字键盘直接输入**（复刻 `SetPassword.ux` 的 0-9 键盘），不用加减步进器。

布局自上而下：

| 区域 | 位置 | 内容 |
|---|---|---|
| 开关卡片 | `top: 86px`，高 46px | 标题「定时关闭」+ 状态文案（已开启/已关闭）+ 开关图 |
| 时间显示区 | `top: 140px`，高 56px | `23 : 00` 两个可点选的输入框，高亮（`#0D6EFF`）的是当前编辑项 |
| 提示文案 | `top: 200px` | 已开启：`下次关闭：今天 23:00` / 关闭：`开启后每天 23:00 自动退出` |
| 数字键盘 | `top: 236px` | 4 行 × 3 列：`1-9`、`清空` / `0` / `←` |

顶部沿用全项目统一的 `hd.png` + 当前时间 + 页面标题「定时关闭」。

**输入规则（键位约束，永远不会输入非法时间）：**

| 步骤 | 规则 |
|---|---|
| 小时首位 | 只能是 `0`/`1`/`2`，按 3-9 弹提示「小时范围为 0-23」并忽略 |
| 小时次位 | 首位为 `2` 时只能 `0-3`，超过 23 同样忽略 |
| 自动跳转 | 小时输满两位后自动切到分钟 |
| 分钟首位 | 只能是 `0-5`，按 6-9 弹提示「分钟范围为 0-59」 |
| 分钟次位 | 输满两位后保存并 Toast 确认 |
| 输入中显示 | 未输完的那一位显示成 `2_`，其余显示已保存的值 |
| 点按显示区 | 切换正在编辑的是小时还是分钟，切换时丢弃未输完的那半位 |
| `←` | 删掉正在输入的那一位；分钟位已空时退回小时位 |
| `清空` | 取消本次输入，回到已保存的时间 |

**存储键：**

| 键名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `EBOOK_SCHEDULED_SHUTDOWN_ENABLED` | boolean (string) | `'false'` | 定时关闭开关 |
| `EBOOK_SCHEDULED_SHUTDOWN_TIME` | string | `'23:00'` | 关闭时刻，24 小时制 `HH:MM` |

**行为：**
- 点击开关：翻转并写入 `EBOOK_SCHEDULED_SHUTDOWN_ENABLED`，同时 Toast 提示
- 小时/分钟输满两位：写入 `EBOOK_SCHEDULED_SHUTDOWN_TIME`
- 每次写入完成后调用 `globalThis.rearmScheduledShutdown()`，让全局定时器立即按新设置重算触发时间

---

## 定时器逻辑（utils/scheduledShutdown.js）

新增 `src/utils/scheduledShutdown.js`，在 `app.ux` 中 `start()` / `resume()`。

### 触发时间算法（关键）

```js
target.setHours(hour, minute, 0, 0);
if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
```

永远是「**下一个**该时刻」：

- 20:00 设定 23:00 → 今天 23:00 触发
- 23:30 设定 23:00 → 顺延到明天 23:00（**不会一打开就退出**）
- 后台期间错过该时刻 → 回到前台时重新计算，同样顺延到第二天，**不补触发**

### 检测与退出

- `setInterval` 每秒检查一次 `Date.now() >= targetTimestamp`
- 到点后调用 `globalThis.__exitAppSafely()`；该函数由阅读页注册
- 若没有注册（当前不在阅读页），直接 `app.terminate()`
- 已调用安全退出后 3 秒仍未退出，则强制 `app.terminate()` 兜底

### 对外接口

| 接口 | 用途 |
|---|---|
| `start()` | app 启动：注册 `globalThis.rearmScheduledShutdown`，读取设置并启动检查 |
| `resume()` | app 回到前台：重新读取设置并重算触发时间 |
| `refresh()` | 立即重算（设置页改完配置后调用） |
| `parseTime(text)` | 解析 `23:00` / `23：00` / `9:5`，非法返回 `null` |
| `formatTime(h, m)` | 输出 `HH:MM` |
| `describeNextRun(h, m)` | 输出 `今天 23:00` / `明天 23:00` |

---

## 退出路径（detail.ux 修改）

复用「老师屏」的退出流程，不新增退出实现：

```js
_registerExitHandler() {
    globalThis.__exitAppSafely = () => { this.exitAppForTeacherScreen(); };
    globalThis.__exitAppSafelyOwner = this;
},
_unregisterExitHandler() {
    if (globalThis.__exitAppSafelyOwner === this) {
        globalThis.__exitAppSafely = null;
        globalThis.__exitAppSafelyOwner = null;
    }
}
```

- 阅读页 `onShow()` 注册处理器
- 阅读页 `onDestroy()` 注销处理器（带 owner 校验，避免误删其它实例的注册）
- `onHide()` 不注销：从阅读页跳进设置页时阅读页仍在页面栈中，此时到点也应先存进度再退出

到点后的完整流程（与老师屏一致）：

```
fire() → globalThis.__exitAppSafely()
       → exitAppForTeacherScreen()
       → 清除 saveDataTimeout / readingTimeSaveTimer / autoInterval / 休息提醒计时器
       → await _performSave()            // 保存章节、偏移、滚动位置
       → await readingTimeStorage.recordReadingEnd(name)
       → app.terminate()
```

---

## 涉及的文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/utils/scheduledShutdown.js` | 新建 | 全局定时器、时间解析、退出调度 |
| `src/pages/scheduledShutdown/scheduledShutdown.ux` | 新建 | 配置页：开关 + 时/分步进器 |
| `src/manifest.json` | 修改 | 注册 `pages/scheduledShutdown` 路由 |
| `src/pages/readingSetting/readingSetting.ux` | 修改 | 新增「定时关闭」入口 + 动态副标题 |
| `src/app.ux` | 修改 | `onInit` 启动、`onShow` 重算 |
| `src/pages/detail/detail.ux` | 修改 | 注册 / 注销整体退出处理器 |

---

## 用户决策汇总

| 决策项 | 结论 |
|---|---|
| 时间格式 | 24 小时制 `HH:MM`，如 `23:00` |
| 时间输入方式 | 数字键盘直接键入（复刻密码页键盘），不是加减步进器 |
| 重复方式 | 每天重复 |
| 错过时刻 | 顺延到第二天，不补触发、不在打开瞬间退出 |
| 退出前提醒 | 无提醒，到点直接退出 |
| 退出范围 | 整体退出软件（`app.terminate()`），非仅退出阅读页 |
| 退出实现 | 复用「老师屏」`exitAppForTeacherScreen()`，先存进度再退出 |
| 不在阅读页时 | 直接 `app.terminate()` |
| 入口位置 | 阅读设置 → 休息提醒 之后 |
