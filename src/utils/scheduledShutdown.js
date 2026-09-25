import app from '@system.app';
import storage from './storage.js';

const ENABLED_KEY = 'EBOOK_SCHEDULED_SHUTDOWN_ENABLED';
const TIME_KEY = 'EBOOK_SCHEDULED_SHUTDOWN_TIME';
const DEFAULT_TIME = '23:00';
const CHECK_INTERVAL_MS = 1000;
const FORCE_EXIT_DELAY_MS = 3000;

let checkTimer = null;
let targetTimestamp = 0;
let targetTimeText = DEFAULT_TIME;
let enabled = false;
let fired = false;

function pad2(value) {
    return value < 10 ? '0' + value : '' + value;
}

function formatTime(hour, minute) {
    return pad2(hour) + ':' + pad2(minute);
}

// 解析 "23:00" / "23：00" / "9:5" 形式的定时时间，非法值返回 null
function parseTime(text) {
    if (typeof text !== 'string') return null;
    const matched = text.trim().match(/^(\d{1,2})\s*[:：]\s*(\d{1,2})$/);
    if (!matched) return null;
    const hour = parseInt(matched[1], 10);
    const minute = parseInt(matched[2], 10);
    if (isNaN(hour) || isNaN(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour: hour, minute: minute };
}

// 取“下一个”该时刻的时间戳：当天该时刻已过则顺延到第二天，避免打开即退出
function getNextTimestamp(hour, minute) {
    const now = new Date();
    const target = new Date(now.getTime());
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime();
}

// 供界面展示的“今天 23:00 / 明天 23:00”
function describeNextRun(hour, minute) {
    const now = new Date();
    const target = new Date(now.getTime());
    target.setHours(hour, minute, 0, 0);
    const isToday = target.getTime() > now.getTime();
    return (isToday ? '今天 ' : '明天 ') + formatTime(hour, minute);
}

function arm(hour, minute) {
    targetTimeText = formatTime(hour, minute);
    targetTimestamp = getNextTimestamp(hour, minute);
    fired = false;
}

function clearArm() {
    targetTimestamp = 0;
    fired = false;
}

// 与“老师屏”一致：优先走阅读页注册的安全退出（保存进度后再退出），否则直接整体退出
function fire() {
    fired = true;
    const safeExit = globalThis.__exitAppSafely;
    if (typeof safeExit === 'function') {
        try {
            safeExit();
        } catch (e) {
        }
        setTimeout(() => {
            try {
                app.terminate();
            } catch (e) {
            }
        }, FORCE_EXIT_DELAY_MS);
        return;
    }
    try {
        app.terminate();
    } catch (e) {
    }
}

function tick() {
    if (!enabled || fired || targetTimestamp <= 0) return;
    if (Date.now() >= targetTimestamp) fire();
}

function startTimer() {
    if (checkTimer !== null) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
    checkTimer = setInterval(tick, CHECK_INTERVAL_MS);
}

function loadSettings(callback) {
    storage.get({
        key: ENABLED_KEY,
        success: (enabledData) => {
            enabled = enabledData === 'true' || enabledData === true;
            storage.get({
                key: TIME_KEY,
                success: (timeData) => {
                    const parts = parseTime(timeData) || parseTime(DEFAULT_TIME);
                    if (enabled) {
                        arm(parts.hour, parts.minute);
                    } else {
                        targetTimeText = formatTime(parts.hour, parts.minute);
                        clearArm();
                    }
                    if (callback) callback();
                },
                fail: () => {
                    if (enabled) {
                        arm(23, 0);
                    } else {
                        clearArm();
                    }
                    if (callback) callback();
                }
            });
        },
        fail: () => {
            enabled = false;
            clearArm();
            if (callback) callback();
        }
    });
}

// 重新读取设置并重新计算下一次触发时间（开启/关闭/改时间后调用）
function refresh() {
    loadSettings();
    startTimer();
}

function start() {
    globalThis.rearmScheduledShutdown = refresh;
    refresh();
}

// 应用回到前台时调用：若设定时刻已在后台期间过去，按“不补触发”处理，顺延到第二天
function resume() {
    refresh();
}

function stop() {
    if (checkTimer !== null) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
    clearArm();
}

function getState() {
    return {
        enabled: enabled,
        time: targetTimeText,
        targetTimestamp: targetTimestamp,
        fired: fired
    };
}

export default {
    start: start,
    resume: resume,
    refresh: refresh,
    stop: stop,
    getState: getState,
    parseTime: parseTime,
    formatTime: formatTime,
    describeNextRun: describeNextRun,
    DEFAULT_TIME: DEFAULT_TIME,
    ENABLED_KEY: ENABLED_KEY,
    TIME_KEY: TIME_KEY
};
