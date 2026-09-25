# 休息提醒功能设计文档

## 功能概述

为手环/手表电子书阅读器新增"休息提醒"功能，包含两个独立子功能：
- **周期休息提醒**：每隔一段时间提醒用户休息
- **单次最长阅读时长**：连续阅读达到上限后提醒用户停止

---

## 页面结构

```
detailsetting.ux（阅读菜单页）
  └─ 顶部新增入口："休息提醒 / 开启后定时提醒休息"
       └─ restReminder.ux（中间页）
            ├─ "周期休息提醒 / 开启后定时提醒休息" → restIntervalSetting.ux
            └─ "最长阅读时长 / 达到时长后提醒休息" → maxDurationSetting.ux
```

### 1. detailsetting.ux 修改

在 `<list>` 最顶部（第一个 `<list-item>` 之前）插入一个入口项：

```html
<list-item class="item" @click="routerTo('restReminder')" type="item">
    <div class="item-content">
        <text class="itemtext" static>休息提醒</text>
        <text class="itemtext2" static>开启后定时提醒休息</text>
    </div>
    <img src="/common/images/enter.png" style="width:32px;height: 32px;" static/>
</list-item>
```

路由会自动传 `name` 参数，子页面通过 `protected: { name: '' }` 接收。

### 2. restReminder.ux（中间页）

模仿 `detailsetting.ux` 的列表样式。包含两个 list-item，各自跳转到配置子页。

**模板：**
```html
<template>
    <div class="page" style="flex-direction: column;">
        <list class="list">
            <list-item class="item" @click="routerTo('restIntervalSetting')" type="item">
                <div class="item-content">
                    <text class="itemtext" static>周期休息提醒</text>
                    <text class="itemtext2" static>开启后定时提醒休息</text>
                </div>
                <img src="/common/images/enter.png" style="width:32px;height: 32px;" static/>
            </list-item>
            <list-item class="item" @click="routerTo('maxDurationSetting')" type="item">
                <div class="item-content">
                    <text class="itemtext" static>最长阅读时长</text>
                    <text class="itemtext2" static>达到时长后提醒休息</text>
                </div>
                <img src="/common/images/enter.png" style="width:32px;height: 32px;" static/>
            </list-item>
        </list>
        <img static src="/common/images/hd.png" style="position: absolute;left: 0px;top: 0px;width: 212px;height: 82px;" />
        <text style="position: absolute;left: 40px;top: 16px;width: 132px;line-height: 24px;font-weight:bold;font-size:16px;color:rgba(255,255,255,0.6);text-align:center;">
            {{nowTime}}
        </text>
        <text static style="position: absolute;left: 40px;top: 36px;width: 132px;line-height: 32px;font-weight:bold;font-size:20px;color:white;text-align:center;">
            休息提醒
        </text>
    </div>
</template>
```

**脚本：** 导入 `router`，实现 `routerTo`、`updateTime`、`onInit`、`onDestroy`、`back` 方法，与 `detailsetting.ux` 一致。

**样式：** 复用 `detailsetting.ux` 的 `.page`、`.list`、`.item`、`.itemtext`、`.itemtext2`、`.item-content` 样式。

### 3. restIntervalSetting.ux（周期休息提醒配置页）

模仿 `opacity.ux` 的布局：标题 + 开关 + `number_choose` 步进器。

**存储键：**
| 键名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `EBOOK_REST_INTERVAL_ENABLED` | boolean (string) | `'false'` | 周期休息提醒开关 |
| `EBOOK_REST_INTERVAL` | number (string) | `'30'` | 休息间隔（分钟） |

**number_choose 参数：**
- `name.static="时长"`
- `unit.static="分"`
- `min.static="1"`
- `max.static="999"`
- `step.static="1"`
- `value="{{restInterval}}"`

**模板布局（自上而下）：**
1. 顶部标题栏（hd.png + 时间 + 页面标题"周期休息"）
2. 开关区域：点击切换 `EBOOK_REST_INTERVAL_ENABLED`，使用 `Switch_ON.png` / `Switch_OFF.png`
3. `number_choose` 步进器：调节 `EBOOK_REST_INTERVAL` 值

**脚本逻辑：**
- `onInit()`：从 storage 加载 `EBOOK_REST_INTERVAL_ENABLED` 和 `EBOOK_REST_INTERVAL`
- `toggleEnabled()`：切换开关，写入 storage
- `onIntervalChange(e)`：步进器值变化时写入 storage
- `back()`：`router.back()`

### 4. maxDurationSetting.ux（最长阅读时长配置页）

结构与 `restIntervalSetting.ux` 完全相同，只是存储键和文案不同。

**存储键：**
| 键名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `EBOOK_MAX_DURATION_ENABLED` | boolean (string) | `'false'` | 最长时长开关 |
| `EBOOK_MAX_DURATION` | number (string) | `'60'` | 最长时长（分钟） |

**number_choose 参数：**
- `name.static="时长"`
- `unit.static="分"`
- `min.static="1"`
- `max.static="999"`
- `step.static="1"`
- `value="{{maxDuration}}"`

**页面标题：** "最长时长"

---

## 计时器逻辑（detail.ux 修改）

### 新增实例属性

在 `detail.ux` 的实例属性区域新增：
```js
restIntervalTimer: null,       // 周期休息提醒计时器
maxDurationTimer: null,         // 最长阅读时长计时器
restIntervalSeconds: 0,         // 周期休息间隔（秒）
maxDurationSeconds: 0,          // 最长阅读时长（秒）
restIntervalEnabled: false,     // 周期休息开关
maxDurationEnabled: false,      // 最长时长开关
sessionStartTime: 0,            // 本次会话开始时间戳
```

### onShow 中启动计时器

在 `loadSettings()` 中加载新增的 4 个存储键：
```js
'EBOOK_REST_INTERVAL_ENABLED', 'EBOOK_REST_INTERVAL',
'EBOOK_MAX_DURATION_ENABLED', 'EBOOK_MAX_DURATION'
```

在 `onShow` 的 `loadSettings()` 之后，启动计时器：

```js
// 记录会话开始时间
this.sessionStartTime = Date.now();

// 周期休息提醒
if (this.restIntervalEnabled && this.restIntervalSeconds > 0) {
    this.restIntervalTimer = setInterval(() => {
        prompt.showToast({ message: `已阅读 ${this.restIntervalSeconds / 60} 分钟，休息一下吧` });
    }, this.restIntervalSeconds * 1000);
}

// 最长阅读时长提醒
if (this.maxDurationEnabled && this.maxDurationSeconds > 0) {
    this.maxDurationTimer = setTimeout(() => {
        const minutes = Math.floor((Date.now() - this.sessionStartTime) / 60000);
        prompt.showToast({ message: `已连续阅读 ${minutes} 分钟，该休息了` });
    }, this.maxDurationSeconds * 1000);
}
```

**注意：**
- 周期休息用 `setInterval`，每次触发重新计算已读分钟数
- 最长时长用 `setTimeout`，只触发一次
- 两个计时器独立运行，互不影响
- 每次进入阅读页（onShow）重新从 0 开始计时

### 生命周期中清除计时器

在以下位置清除两个计时器（与现有 `readingTimeSaveTimer` 清除逻辑并列）：

- `onHide()`：`clearInterval` + `clearTimeout`
- `onDestroy()`：`clearInterval` + `clearTimeout`
- `onBackPress()`：`clearInterval` + `clearTimeout`
- `back()`：`clearInterval` + `clearTimeout`
- `exitAppForTeacherScreen()`：`clearInterval` + `clearTimeout`

清除代码模板：
```js
if (this.restIntervalTimer) { clearInterval(this.restIntervalTimer); this.restIntervalTimer = null; }
if (this.maxDurationTimer) { clearTimeout(this.maxDurationTimer); this.maxDurationTimer = null; }
```

### gotoSetting 中的处理

进入设置页时清除计时器（与 `readingTimeSaveTimer` 一致），从设置页返回后 `onShow` 会重新启动。

---

## 涉及的文件清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/pages/detailsetting/detailsetting.ux` | 修改 | 在 list 顶部插入"休息提醒"入口 |
| `src/pages/restReminder/restReminder.ux` | 新建 | 中间页，两个入口跳转 |
| `src/pages/restIntervalSetting/restIntervalSetting.ux` | 新建 | 周期休息提醒配置页 |
| `src/pages/maxDurationSetting/maxDurationSetting.ux` | 新建 | 最长阅读时长配置页 |
| `src/pages/detail/detail.ux` | 修改 | 加载设置 + 启动/清除计时器 |

---

## 用户决策汇总

| 决策项 | 结论 |
|---|---|
| 两个功能的关系 | 独立开关，共享入口，A 包含 B |
| 最长时长到期行为 | 仅 Toast 提醒，不打断阅读 |
| 计时起点 | 每次进入阅读页从 0 开始 |
| 两个计时器关系 | 独立运行，互不影响 |
| 设置页位置 | detailsetting.ux 顶部入口 → 中间页 → 两个子页 |
| UI 控件 | number_choose 步进器，name="时长"，unit="分" |
| 步进值 | 1 |
| 范围限制 | 无限制 |
| 默认值 | 间隔 30 分钟，最长 60 分钟 |
| 默认开关 | 都关闭 |
| Toast 文案 | 周期："已阅读 {X} 分钟，休息一下吧"；最长："已连续阅读 {X} 分钟，该休息了" |
| 计时器位置 | detail.ux 的 onShow |
| 提醒方式 | 仅 Toast，不震动不亮屏 |
| 页面结构 | 三层：入口 → 中间页 → 两个配置子页 |
