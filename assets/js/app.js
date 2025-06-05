// 班级积分管理系统 JavaScript

// 核心存储函数

// 保存数据到localStorage
function saveData(key, data) {
    try {
        // 更新内存缓存
        if (key === 'app_students') {
            window._cachedStudents = data;
        } else if (key === 'app_groups') {
            window._cachedGroups = data;
        }
        
        // 写入localStorage
        localStorage.setItem(key, JSON.stringify(data));
        
        // 如果正在保存学生或小组数据，且为空数组，相当于清除，设置重置标记
        if ((key === 'app_students' || key === 'app_groups') && 
            Array.isArray(data) && data.length === 0 && 
            !localStorage.getItem('app_system_reset')) {
            localStorage.setItem('app_system_reset', new Date().toISOString());
            console.log("检测到空数据保存，设置系统重置标记");
        }
        
        return true;
    } catch (error) {
        console.error('保存数据失败:', error);
        showAlert('保存数据失败，可能是存储空间不足');
        return false;
    }
}

// 从localStorage获取数据
function loadData(key, defaultValue = []) {
    try {
        // 优先检查系统重置标记
        if (key === 'app_students' || key === 'app_groups') {
            const resetMark = localStorage.getItem('app_system_reset');
            if (resetMark) {
                console.log(`检测到系统重置标记，"${key}"返回空数据`);
                
                // 如果系统被重置过于久远（超过30分钟），自动清除重置标记
                const resetTime = new Date(resetMark).getTime();
                const now = new Date().getTime();
                const thirtyMinutes = 30 * 60 * 1000;
                
                if (now - resetTime > thirtyMinutes) {
                    console.log("重置标记已超过30分钟，自动清除");
                    localStorage.removeItem('app_system_reset');
                    // 继续下面的正常数据加载流程
                } else {
                    // 如果系统被重置，学生和小组数据直接返回空
                    if (key === 'app_students' && window._cachedStudents !== undefined) {
                        return window._cachedStudents;
                    }
                    if (key === 'app_groups' && window._cachedGroups !== undefined) {
                        return window._cachedGroups;
                    }
                    // 初始化空数组作为缓存
                    if (key === 'app_students') {
                        window._cachedStudents = [];
                    } else if (key === 'app_groups') {
                        window._cachedGroups = [];
                    }
                    return [];
                }
            }
        }
        
        // 检查缓存
        if (key === 'app_students' && window._cachedStudents !== undefined) {
            return window._cachedStudents;
        }
        if (key === 'app_groups' && window._cachedGroups !== undefined) {
            return window._cachedGroups;
        }
        
        // 正常获取数据
        const data = localStorage.getItem(key);
        const parsedData = data ? JSON.parse(data) : defaultValue;
        
        // 缓存常用数据
        if (key === 'app_students') {
            window._cachedStudents = parsedData;
        } else if (key === 'app_groups') {
            window._cachedGroups = parsedData;
        }
        
        return parsedData;
    } catch (error) {
        console.error('读取数据失败:', error);
        return defaultValue;
    }
}

// 存储优化函数 - 按时间分割积分记录
function optimizePointLogsStorage() {
    // 获取所有积分记录
    const allPointLogs = loadData('app_pointLogs', []);
    
    // 如果记录数小于100，不需要优化
    if (allPointLogs.length < 100) {
        return;
    }
    
    console.log(`开始优化积分记录存储，当前记录数: ${allPointLogs.length}`);
    
    // 按年月分组
    const groupedLogs = {};
    
    allPointLogs.forEach(log => {
        // 提取年月（例如：2024-05）
        const date = new Date(log.createdAt);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!groupedLogs[yearMonth]) {
            groupedLogs[yearMonth] = [];
        }
        
        groupedLogs[yearMonth].push(log);
    });
    
    // 清除主存储
    localStorage.removeItem('app_pointLogs');
    
    // 保存最近3个月的数据到主存储
    const now = new Date();
    const recentMonths = [];
    
    for (let i = 0; i < 3; i++) {
        const month = now.getMonth() - i;
        const year = now.getFullYear() + Math.floor(month / 12);
        const adjustedMonth = ((month % 12) + 12) % 12; // 处理负月份
        const yearMonth = `${year}-${String(adjustedMonth + 1).padStart(2, '0')}`;
        recentMonths.push(yearMonth);
    }
    
    // 收集最近几个月的记录
    const recentLogs = [];
    recentMonths.forEach(yearMonth => {
        if (groupedLogs[yearMonth]) {
            recentLogs.push(...groupedLogs[yearMonth]);
            delete groupedLogs[yearMonth]; // 从分组中移除，避免重复存储
        }
    });
    
    // 保存最近几个月的数据到主键
    saveData('app_pointLogs', recentLogs);
    
    // 保存其他月份数据到单独的键
    Object.keys(groupedLogs).forEach(yearMonth => {
        if (groupedLogs[yearMonth].length > 0) {
            saveData(`app_pointLogs_${yearMonth}`, groupedLogs[yearMonth]);
            console.log(`已保存 ${yearMonth} 的 ${groupedLogs[yearMonth].length} 条记录`);
        }
    });
    
    // 更新存储信息
    saveData('app_storage_info', {
        lastOptimized: new Date().toISOString(),
        archivedMonths: Object.keys(groupedLogs),
        mainRecords: recentLogs.length,
        totalRecords: allPointLogs.length
    });
    
    console.log(`存储优化完成，主存储记录数: ${recentLogs.length}，归档月份数: ${Object.keys(groupedLogs).length}`);
    
    // 刷新所有视图
    refreshAllMainViews();
    
    return true;
}

// 加载所有积分记录（包括归档数据）
function loadAllPointLogs() {
    // 先获取主存储数据
    const mainLogs = loadData('app_pointLogs', []);
    let allLogs = [...mainLogs];
    
    // 获取存储信息
    const storageInfo = loadData('app_storage_info', {});
    const archivedMonths = storageInfo.archivedMonths || [];
    
    // 加载所有归档月份数据
    archivedMonths.forEach(yearMonth => {
        const monthLogs = loadData(`app_pointLogs_${yearMonth}`, []);
        allLogs = allLogs.concat(monthLogs);
    });
    
    // 按时间排序
    allLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return allLogs;
}

// 监控localStorage使用情况
function getLocalStorageUsage() {
    let totalSize = 0;
    let details = {};
    
    // 遍历所有localStorage键
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const size = (key.length + value.length) * 2; // 以字节为单位（UTF-16编码）
        
        totalSize += size;
        
        // 只记录应用相关的键
        if (key.startsWith('app_')) {
            details[key] = {
                size: Math.round(size / 1024 * 100) / 100, // 转换为KB并保留两位小数
                records: key.includes('pointLogs') ? JSON.parse(value).length : undefined
            };
        }
    }
    
    return {
        totalSize: Math.round(totalSize / 1024 * 100) / 100, // KB
        totalMB: Math.round(totalSize / 1024 / 1024 * 100) / 100, // MB
        details: details,
        percentUsed: Math.round(totalSize / (5 * 1024 * 1024) * 10000) / 100, // 假设限制为5MB
        timestamp: new Date().toISOString()
    };
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 备份所有数据
function backupAllData() {
    console.log("开始备份数据...");
    
    // 确保获取最新数据（先进行一次强制刷新）
    localStorage.removeItem('_temp_cache_marker');
    localStorage.setItem('_temp_cache_marker', new Date().toISOString());
    
    // 强制刷新所有数据对象缓存
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('app_')) {
            try {
                // 读取然后重新写入以刷新缓存
                const data = JSON.parse(localStorage.getItem(key));
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                console.error(`刷新缓存时出错 (${key}):`, e);
            }
        }
    }
    
    // 强制同步读取最新数据
    const students = loadData('app_students', []);
    const groups = loadData('app_groups', []);
    const pointRules = loadData('app_pointRules', []);
    const rewards = loadData('app_rewards', []);
    const exchanges = loadData('app_exchanges', []);
    const settings = loadData('app_settings', {});
    const storageInfo = loadData('app_storage_info', {});
    
    // 获取完整积分记录（包括归档数据）
    const allPointLogs = loadAllPointLogs();
    console.log(`获取到积分记录: ${allPointLogs.length}条`);
    
    const allData = {
        students: students,
        groups: groups,
        pointRules: pointRules,
        pointLogs: allPointLogs, // 使用合并后的完整积分记录
        rewards: rewards,
        exchanges: exchanges,
        settings: settings,
        storageInfo: storageInfo,
        timestamp: new Date().toISOString(),
        version: "2.0.0" // 添加版本信息，便于后续兼容性检查
    };
    
    // 记录数据统计信息到控制台（便于调试）
    console.log(`备份数据统计: 学生${students.length}名, 小组${groups.length}个, 积分记录${allPointLogs.length}条`);
    
    // 校验数据完整性
    if (students.length === 0 && allPointLogs.length > 0) {
        console.warn("警告：备份数据中没有学生信息但存在积分记录，可能数据不完整");
        // 使用自定义确认弹窗
        showConfirm("备份的数据中没有学生信息，但存在积分记录，是否继续备份？", 
            function() {
                // 用户确认，继续备份
                console.log("用户确认继续备份");
            }, 
            function() {
                // 用户取消备份
                console.log("用户取消了备份");
                return null;
            }
        );
        return null; // 先返回null，确认后会通过回调继续处理
    }
    
    // 构建下载功能
    const blob = new Blob([JSON.stringify(allData)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `班级积分系统备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    // 清理URL对象
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
    
    // 更新最后备份时间
    saveData('app_lastBackup', new Date().toISOString());
    updateLastBackupInfo();
    
    console.log("备份完成！");
    
    // 刷新所有视图
    refreshAllMainViews();
    
    return allData; // 返回备份的数据对象（便于调试）
}

// 恢复数据
function restoreData(jsonData) {
    try {
        // 添加错误调试信息
        console.log("开始解析恢复数据:", jsonData.substring(0, 100) + "...");
        
        const data = JSON.parse(jsonData);
        
        // 验证数据结构
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式不正确：不是有效的对象');
        }
        
        // 记录恢复前数据，方便调试
        const beforeStudentsCount = loadData('app_students').length;
        
        // 保存数据前进行简单验证
        if (data.students && Array.isArray(data.students)) saveData('app_students', data.students);
        if (data.groups && Array.isArray(data.groups)) saveData('app_groups', data.groups);
        if (data.pointRules && Array.isArray(data.pointRules)) saveData('app_pointRules', data.pointRules);
        if (data.pointLogs && Array.isArray(data.pointLogs)) saveData('app_pointLogs', data.pointLogs);
        if (data.rewards && Array.isArray(data.rewards)) saveData('app_rewards', data.rewards);
        if (data.exchanges && Array.isArray(data.exchanges)) saveData('app_exchanges', data.exchanges);
        if (data.settings && typeof data.settings === 'object') saveData('app_settings', data.settings);
        if (data.storageInfo && typeof data.storageInfo === 'object') saveData('app_storage_info', data.storageInfo);
        
        // 清除所有旧的分片存储
        clearArchivedPointLogs();
        
        // 如果数据量大，进行存储优化
        if (data.pointLogs && data.pointLogs.length > 100) {
            optimizePointLogsStorage();
        }
        
        // 记录恢复后数据，方便调试
        const afterStudentsCount = loadData('app_students').length;
        console.log(`恢复数据完成：学生数从 ${beforeStudentsCount} 变为 ${afterStudentsCount}`);
        
        showAlert('数据恢复成功！');
        saveData('app_lastBackup', new Date().toISOString());
        updateLastBackupInfo();
        
        // 添加页面刷新逻辑
        initializePages();
        refreshAllMainViews();
        
        return true;
    } catch (error) {
        console.error('恢复数据失败:', error);
        showAlert(`恢复数据失败: ${error.message}`);
        return false;
    }
}

// 清除所有归档积分记录
function clearArchivedPointLogs() {
    const storageInfo = loadData('app_storage_info', {});
    const archivedMonths = storageInfo.archivedMonths || [];
    
    archivedMonths.forEach(yearMonth => {
        localStorage.removeItem(`app_pointLogs_${yearMonth}`);
    });
    
    console.log(`已清除 ${archivedMonths.length} 个月的归档积分记录`);
}

// 更新上次备份信息
function updateLastBackupInfo() {
    const lastBackupElement = document.getElementById('last-backup-info');
    const lastBackup = loadData('app_lastBackup', null);
    
    if (lastBackup) {
        lastBackupElement.textContent = `上次备份时间: ${formatDate(lastBackup)}`;
    } else {
        lastBackupElement.textContent = '上次备份时间: 未备份';
    }
}

// 导航相关

// 页面切换函数
function showPage(pageId) {
    // 隐藏所有页面
    const pages = document.querySelectorAll('#content-container > div');
    pages.forEach(page => page.classList.add('hidden'));
    
    // 显示选定页面
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
        selectedPage.classList.remove('hidden');
    }
    
    // 更新导航按钮样式
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(button => {
        button.classList.remove('btn-nav-active');
    });
    
    // 设置对应导航按钮为激活状态
    if (pageId !== 'welcome-page') {
        const activeButton = document.getElementById(`nav-${pageId.split('-')[0]}`);
        if (activeButton) {
            activeButton.classList.add('btn-nav-active');
        }
    }
}

// 将TXT文件内容转换为CSV格式
function parseTxtToCSV(txtContent) {
    // 处理不同的行结束符
    const lines = txtContent.split(/\r\n|\r|\n/).filter(line => line.trim());
    
    // 将每行的分隔符处理为CSV格式
    return lines.map(line => {
// 检测分隔符：优先检查逗号，如果没有则尝试其他常见分隔符
let delimiter = ',';
if (!line.includes(',')) {
    if (line.includes('\t')) delimiter = '\t';
    else if (line.includes('|')) delimiter = '|';
}

// 分割并合并为CSV格式
const columns = line.split(delimiter);
return columns.map(col => {
    // 处理CSV转义：如果字段包含逗号、引号或换行符，需要用引号包裹
    if (col.includes(',') || col.includes('"') || col.includes('\n')) {
        return '"' + col.replace(/"/g, '""') + '"';
    }
    return col;
}).join(',');
    }).join('\n');
}

// 检测文本是否有编码问题（常见于GBK等编码被误识别为UTF-8）
function hasEncodingIssues(text) {
    // 检查是否包含常见的乱码字符或模式
    const suspiciousChars = /[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g;
    
    // 如果包含替换字符(�)或控制字符，可能存在编码问题
    if (suspiciousChars.test(text)) {
return true;
    }
    
    // 检查中文字符区域是否有异常
    // 正常的中文字符通常在Unicode的CJK统一表意文字区域
    // GBK编码误解析常会产生多个紧密排列的特殊字符
    const abnormalCJKPattern = /[\u00E0-\u00EF][\u0080-\u00BF]{2}/g;
    if (abnormalCJKPattern.test(text)) {
return true;
    }
    
    // 计算异常字符比例
    const totalChars = text.length;
    const abnormalChars = text.match(/[^\u0000-\u007F\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g) || [];
    const abnormalRatio = abnormalChars.length / totalChars;
    
    // 如果异常字符比例过高，可能存在编码问题
    return abnormalRatio > 0.1;
}

// 尝试修复编码问题
function fixEncodingIssues(text) {
    // 这个函数尝试使用启发式方法修复常见的编码问题
    // 特别是GBK编码被误识别为UTF-8的情况
    
    // 简单处理：替换常见的乱码序列
    let fixed = text;
    
    // 替换常见的GBK编码误识别模式
    const replacements = [
// 常见的简体中文标点符号错误编码修复
{ from: /â€œ/g, to: '\u201C' },  // 中文引号开始
{ from: /â€/g, to: '\u201D' },   // 中文引号结束
{ from: /â€˜/g, to: '\u2018' },  // 中文单引号开始
{ from: /â€™/g, to: '\u2019' },  // 中文单引号结束
{ from: /â€¦/g, to: '\u2026' },  // 省略号
{ from: /â€"/g, to: '\u2014' },  // 破折号

// 常见的中文字符错误编码修复
{ from: /Ã¦/g, to: '汉' },  // 一些常见的汉字前缀
{ from: /Ã©/g, to: '字' },
{ from: /Ã¯/g, to: '文' },
{ from: /Ã¼/g, to: '字' }
    ];
    
    // 应用所有替换规则
    replacements.forEach(rule => {
fixed = fixed.replace(rule.from, rule.to);
    });
    
    // 如果替换后的文本仍然有很多乱码，保留原文
    if (hasEncodingIssues(fixed) && countReplacementChars(fixed) > countReplacementChars(text)) {
return text;
    }
    
    return fixed;
}

// 计算替代字符的数量
function countReplacementChars(text) {
    return (text.match(/�/g) || []).length;
}

// 处理文件编码
function handleFileEncoding(file, reader) {
    try {
// 先用二进制模式读取文件的前几个字节来检测BOM
const binaryReader = new FileReader();
binaryReader.onload = function(e) {
    const bytes = new Uint8Array(e.target.result);
    
    // 检测是否含有BOM标记
    if (bytes.length >= 3 && 
        bytes[0] === 0xEF && 
        bytes[1] === 0xBB && 
        bytes[2] === 0xBF) {
        // UTF-8 with BOM
        reader.readAsText(file, 'utf-8');
    } else if (bytes.length >= 2 && 
             bytes[0] === 0xFF && 
             bytes[1] === 0xFE) {
        // UTF-16 LE BOM
        reader.readAsText(file, 'utf-16le');
    } else if (bytes.length >= 2 && 
             bytes[0] === 0xFE && 
             bytes[1] === 0xFF) {
        // UTF-16 BE BOM
        reader.readAsText(file, 'utf-16be');
    } else {
        // 没有BOM，尝试直接用UTF-8解码
        // 如果出现乱码，系统会在importStudents函数内处理
        reader.readAsText(file, 'utf-8');
    }
};

binaryReader.onerror = function() {
    // 读取失败，直接用UTF-8尝试
    reader.readAsText(file, 'utf-8');
};

// 读取文件前8个字节用于检测BOM
binaryReader.readAsArrayBuffer(file.slice(0, 8));
    } catch (e) {
// 异常处理，直接尝试UTF-8
reader.readAsText(file, 'utf-8');
    }
}

// 页面初始化
function initializePages() {
    // 只初始化欢迎页面和数据，所有功能模块懒加载
    // 这样可以提高首次加载速度
    initializeData();
    initWelcomePage(); // 初始化首页仪表盘
    showPage('welcome-page');
    
    // 添加项目标题点击事件
    document.getElementById('app-title').addEventListener('click', () => {
        showPage('welcome-page');
    });
    
    // 设置导航事件监听器
    setupNavigationListeners();
    
    // 更新上次备份信息
    updateLastBackupInfo();
    
    // 进行备份状态检查
    setTimeout(checkBackupStatus, 1000); // 延迟1秒检查，避免刚加载就弹窗
}

// 初始化欢迎页面仪表盘
function initWelcomePage() {
    try {
        console.log("初始化首页...");
        // 确保重置所有处理标志
        window._processingImport = false;         // 导入处理标志
        window._processingDialog = false;         // 弹窗处理标志
        window._processingRuleApplication = false; // 规则应用处理标志
        window._selectedRuleId = null;            // 选中的规则ID
        
        // 隐藏取消选择按钮（如果存在）
        const cancelBtn = document.getElementById('cancel-rule-selection');
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }
        
        updateDashboardStats();
        // 初始化学生积分表格
        initStudentPointsTable();
        // 初始化快速积分规则按钮
        initQuickRuleButtons();
        // 加载最近积分记录
        loadRecentPointsLogs();
        // 设置首页相关事件监听器
        setupWelcomePageListeners();
        
        // 移除学生行的可点击样式
        const tableRows = document.querySelectorAll('#student-points-table tr');
        tableRows.forEach(row => {
            row.classList.remove('cursor-pointer', 'bg-yellow-50');
        });
        
        console.log("首页初始化完成");
    } catch (error) {
        console.error("初始化首页时出错:", error);
        // 确保即使出错也重置处理标志
        window._processingImport = false;
        window._processingDialog = false;
        window._processingRuleApplication = false;
        window._selectedRuleId = null;
    }
    
    // 添加"查看全部"点击事件
    document.getElementById('more-logs-btn').addEventListener('click', () => {
        showPage('points-page');
        if (!initializedPages['points-page']) {
            initPageOnDemand('points-page');
            initializedPages['points-page'] = true;
        }
    });
    
    // 添加"查看统计"按钮事件
    document.getElementById('view-stats-btn').addEventListener('click', () => {
        showPage('stats-page');
        if (!initializedPages['stats-page']) {
            initPageOnDemand('stats-page');
            initializedPages['stats-page'] = true;
        }
    });
}

// 更新仪表盘统计数据
function updateDashboardStats() {
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    const pointLogs = loadData('app_pointLogs');
    
    // 计算总积分
    const totalPoints = students.reduce((sum, student) => sum + (student.totalPoints || 0), 0);
    
    // 更新数据
    document.getElementById('dashboard-total-students').textContent = students.length;
    document.getElementById('dashboard-total-groups').textContent = groups.length;
    document.getElementById('dashboard-total-points').textContent = totalPoints;
    document.getElementById('dashboard-avg-points').textContent = students.length > 0 
        ? Math.round(totalPoints / students.length * 10) / 10
        : 0;
}

// 绘制仪表盘图表
function drawDashboardCharts() {
    // 绘制积分趋势图
    drawDashboardTrendChart();
    
    // 更新积分分布
    updateDashboardDistribution();
}

// 绘制仪表盘趋势图
function drawDashboardTrendChart() {
    const pointLogs = loadData('app_pointLogs');
    
    if (pointLogs.length === 0) {
        document.getElementById('dashboard-trend-chart').parentNode.innerHTML = 
            '<div class="flex items-center justify-center h-64 text-gray-500">暂无积分数据</div>';
        return;
    }
    
    // 按日期分组并计算每天的积分
    const dailyPoints = {};
    
    pointLogs.forEach(log => {
        const date = log.createdAt.split('T')[0];
        if (!dailyPoints[date]) {
            dailyPoints[date] = 0;
        }
        dailyPoints[date] += parseInt(log.points);
    });
    
    // 转换为数组并按日期排序
    const sortedDates = Object.keys(dailyPoints).sort();
    
    // 计算累计积分
    let cumulative = 0;
    const cumulativePoints = [];
    
    sortedDates.forEach(date => {
        cumulative += dailyPoints[date];
        cumulativePoints.push(cumulative);
    });
    
    // 只显示最近15天的数据
    const labels = sortedDates.slice(-15);
    const data = cumulativePoints.slice(-15);
    
    // 绘制图表
    const ctx = document.getElementById('dashboard-trend-chart').getContext('2d');
    
    // 如果已经有图表，销毁它
    if (window.dashboardTrendChart) {
        window.dashboardTrendChart.destroy();
    }
    
    window.dashboardTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '班级总积分',
                data: data,
                backgroundColor: 'rgba(255, 133, 162, 0.2)',
                borderColor: 'rgba(255, 133, 162, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 133, 162, 1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].label);
                            return date.toLocaleDateString('zh-CN');
                        }
                    }
                }
            }
        }
    });
}

// 更新仪表盘积分分布
function updateDashboardDistribution() {
    const students = loadData('app_students');
    const distributionContainer = document.getElementById('dashboard-point-distribution');
    
    // 清空容器
    distributionContainer.innerHTML = '';
    
    if (students.length === 0) {
        distributionContainer.innerHTML = '<div class="text-center py-4 text-gray-500">暂无学生数据</div>';
        return;
    }
    
    // 定义积分区间
    const ranges = [
        { min: 0, max: 10, label: '0-10分', color: 'bg-red-100' },
        { min: 10, max: 30, label: '10-30分', color: 'bg-orange-100' },
        { min: 30, max: 50, label: '30-50分', color: 'bg-yellow-100' },
        { min: 50, max: 70, label: '50-70分', color: 'bg-green-100' },
        { min: 70, max: 90, label: '70-90分', color: 'bg-teal-100' },
        { min: 90, max: Infinity, label: '90分以上', color: 'bg-blue-100' }
    ];
    
    // 计算每个区间的学生数量
    ranges.forEach(range => {
        const count = students.filter(student => {
            const points = student.totalPoints || 0;
            return points >= range.min && points < range.max;
        }).length;
        
        const percentage = students.length > 0 ? Math.round(count / students.length * 100) : 0;
        
        // 创建进度条项
        const item = document.createElement('div');
        item.innerHTML = `
            <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">${range.label}</span>
                <span class="text-gray-800">${count}人 (${percentage}%)</span>
            </div>
            <div class="w-full bg-neutral-dark rounded-full h-2">
                <div class="${range.color} h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
        `;
        
        distributionContainer.appendChild(item);
    });
}

// 加载仪表盘最近积分记录
function loadDashboardRecentLogs() {
    const recentLogs = document.getElementById('dashboard-recent-logs');
    const pointLogs = loadData('app_pointLogs');
    const students = loadData('app_students');
    const rules = loadData('app_pointRules');
    
    // 清空列表
    recentLogs.innerHTML = '';
    
    if (pointLogs.length === 0) {
        recentLogs.innerHTML = '<div class="text-center py-4 text-gray-500">暂无积分记录</div>';
        return;
    }
    
    // 只显示最近的5条记录
    const latestLogs = [...pointLogs].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 5);
    
    // 创建积分记录卡片
    latestLogs.forEach(log => {
        const student = students.find(s => s.id === log.studentId);
        const rule = rules.find(r => r.id === log.pointRuleId);
        
        if (!student || !rule) return;
        
        const logCard = document.createElement('div');
        const pointsClass = parseInt(log.points) >= 0 ? 'text-green-500' : 'text-red-500';
        const pointsSign = parseInt(log.points) >= 0 ? '+' : '';
        
        logCard.className = 'bg-white border-b border-neutral-dark last:border-b-0 py-2';
        logCard.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <span class="font-medium text-gray-800">${student.name}</span>
                    <span class="text-xs text-gray-500 ml-2">${formatDate(log.createdAt)}</span>
                </div>
                <span class="${pointsClass} font-medium">${pointsSign}${log.points}</span>
            </div>
            <p class="text-sm text-gray-600 mt-1">${rule.name}</p>
        `;
        recentLogs.appendChild(logCard);
    });
}

// 加载仪表盘排行榜
function loadDashboardRankings() {
    const rankList = document.getElementById('dashboard-rank-list');
    const students = loadData('app_students');
    
    // 清空列表
    rankList.innerHTML = '';
    
    if (students.length === 0) {
        rankList.innerHTML = '<div class="text-center py-4 text-gray-500">暂无学生数据</div>';
        return;
    }
    
    // 按积分排序
    const sortedStudents = [...students].sort((a, b) => 
        (b.totalPoints || 0) - (a.totalPoints || 0)
    );
    
    // 创建表格
    const table = document.createElement('table');
    table.className = 'w-full text-sm';
    
    // 创建表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr class="bg-neutral">
            <th class="px-2 py-2 text-left">排名</th>
            <th class="px-2 py-2 text-left">姓名</th>
            <th class="px-2 py-2 text-right">积分</th>
        </tr>
    `;
    
    // 创建表体
    const tbody = document.createElement('tbody');
    tbody.innerHTML = 
        // 只显示前10名
        sortedStudents.slice(0, 10).map((student, index) => `
            <tr class="border-b border-neutral-dark hover:bg-neutral transition-colors">
                <td class="px-2 py-2 text-center">
                    <span class="inline-flex items-center justify-center w-6 h-6 ${index < 3 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'} rounded-full text-sm font-medium">
                        ${index + 1}
                    </span>
                </td>
                <td class="px-2 py-2">${student.name}</td>
                <td class="px-2 py-2 text-right font-medium">${student.totalPoints || 0}</td>
            </tr>
        `).join('');
    
    // 添加表头和表体到表格
    table.appendChild(thead);
    table.appendChild(tbody);
    
    // 添加表格到容器
    rankList.appendChild(table);
}

// 延迟初始化特定页面
function initPageOnDemand(pageId) {
    switch(pageId) {
        case 'students-page':
            initStudentsPage();
            break;
        case 'points-page':
            initPointsPage();
            break;
        case 'stats-page':
            initStatsPage();
            break;
        case 'rewards-page':
            initRewardsPage();
            break;
        case 'settings-page':
            initSettingsPage();
            break;
    }
}

// 创建一个简单的缓存对象记录每个页面是否已初始化
const initializedPages = {
    'students-page': false,
    'points-page': false,
    'stats-page': false,
    'rewards-page': false,
    'settings-page': false
};

// 添加导航事件监听器函数
function setupNavigationListeners() {
    // 绑定导航按钮点击事件
    document.getElementById('nav-students').addEventListener('click', () => {
        showPage('students-page');
        if (!initializedPages['students-page']) {
            initPageOnDemand('students-page');
            initializedPages['students-page'] = true;
        }
    });
    document.getElementById('nav-points').addEventListener('click', () => {
        showPage('points-page');
        if (!initializedPages['points-page']) {
            initPageOnDemand('points-page');
            initializedPages['points-page'] = true;
        }
    });
    document.getElementById('nav-stats').addEventListener('click', () => {
        showPage('stats-page');
        if (!initializedPages['stats-page']) {
            initPageOnDemand('stats-page');
            initializedPages['stats-page'] = true;
        }
    });
    document.getElementById('nav-rewards').addEventListener('click', () => {
        showPage('rewards-page');
        if (!initializedPages['rewards-page']) {
            initPageOnDemand('rewards-page');
            initializedPages['rewards-page'] = true;
        }
    });
    document.getElementById('nav-settings').addEventListener('click', () => {
        showPage('settings-page');
        if (!initializedPages['settings-page']) {
            initPageOnDemand('settings-page');
            initializedPages['settings-page'] = true;
        }
    });
}

// 初始化数据
function initializeData() {
    // 如果是首次使用，初始化基础数据
    if (!localStorage.getItem('app_students')) {
        saveData('app_students', []);
    }
    
    if (!localStorage.getItem('app_groups')) {
        saveData('app_groups', []);
    }
    
    if (!localStorage.getItem('app_pointRules')) {
        // 使用同一个时间戳减少Date对象创建次数
        const now = new Date().toISOString();
        
        const defaultRules = [
            {
                id: generateId(),
                name: '课堂表现优秀',
                points: 5,
                description: '积极参与课堂讨论，回答问题正确',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '作业完成出色',
                points: 3,
                description: '作业准时提交且质量高',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '迟到',
                points: -2,
                description: '上课迟到但有正当理由',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '缺席',
                points: -5,
                description: '无故缺席课堂',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '考试成绩优异',
                points: 10,
                description: '考试成绩90分以上',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '违反课堂纪律',
                points: -3,
                description: '扰乱课堂秩序，影响他人学习',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '班级活动参与',
                points: 4,
                description: '积极参与班级组织的活动',
                createdAt: now,
                updatedAt: now
            },
            {
                id: generateId(),
                name: '互助行为',
                points: 3,
                description: '主动帮助其他同学解决学习问题',
                createdAt: now,
                updatedAt: now
            }
        ];
        
        // 使用异步方式保存数据避免阻塞UI
        setTimeout(() => {
            saveData('app_pointRules', defaultRules);
        }, 0);
    }
    
    if (!localStorage.getItem('app_pointLogs')) {
        saveData('app_pointLogs', []);
    }
    
    if (!localStorage.getItem('app_rewards')) {
        saveData('app_rewards', []);
    }
    
    if (!localStorage.getItem('app_exchanges')) {
        saveData('app_exchanges', []);
    }
}

// 空方法，用于初始化奖励页面
function initRewardsPage() {
    renderRewardList();
    renderExchangeList();
    setupRewardListeners();
}

// 奖励系统相关变量
let currentEditRewardId = null;

// 渲染奖品列表
function renderRewardList() {
    const rewardList = document.getElementById('reward-list');
    const rewards = loadData('app_rewards');
    
    // 清空列表
    rewardList.innerHTML = '';
    
    if (rewards.length === 0) {
        rewardList.innerHTML = '<div class="text-center py-4 text-gray-500">暂无奖品，请添加</div>';
        return;
    }
    
    // 创建奖品卡片
    rewards.forEach(reward => {
        const rewardCard = document.createElement('div');
        rewardCard.className = 'card card-sm';
        rewardCard.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-md font-medium text-gray-800">${reward.name}</h3>
                <span class="bg-secondary text-white px-2 py-1 rounded-full text-xs">${reward.pointsCost}积分</span>
            </div>
            <p class="text-gray-500 text-xs mt-1">${reward.description || '无描述'}</p>
            <div class="mt-2 flex justify-between items-center">
                <span class="text-xs text-gray-400">库存: ${reward.stock}</span>
                <div class="flex space-x-2">
                    <button class="edit-reward-btn btn btn-primary btn-sm" data-id="${reward.id}">编辑</button>
                    <button class="delete-reward-btn btn btn-danger btn-sm" data-id="${reward.id}">删除</button>
                </div>
            </div>
        `;
        rewardList.appendChild(rewardCard);
    });
    
    // 绑定编辑和删除按钮事件
    document.querySelectorAll('.edit-reward-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const rewardId = e.currentTarget.dataset.id;
            openRewardModal('edit', rewardId);
        });
    });
    
    document.querySelectorAll('.delete-reward-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const rewardId = e.currentTarget.dataset.id;
            const reward = rewards.find(r => r.id === rewardId);
            showConfirm(`确定要删除奖品"${reward.name}"吗？`, 
                function() {
                    deleteReward(rewardId);
                }
            );
        });
    });
}

// 渲染兑换记录
function renderExchangeList() {
    const exchangeList = document.getElementById('exchange-list');
    const exchanges = loadData('app_exchanges');
    const students = loadData('app_students');
    const rewards = loadData('app_rewards');
    
    // 清空列表
    exchangeList.innerHTML = '';
    
    if (exchanges.length === 0) {
        exchangeList.innerHTML = '<div class="text-center py-4 text-gray-500">暂无兑换记录</div>';
        return;
    }
    
    // 按日期排序，最新的在前面
    const sortedExchanges = [...exchanges].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    // 创建兑换记录
    sortedExchanges.forEach(exchange => {
        const student = students.find(s => s.id === exchange.studentId);
        const reward = rewards.find(r => r.id === exchange.rewardId);
        
        if (!student || !reward) return;
        
        const exchangeItem = document.createElement('div');
        exchangeItem.className = 'card card-sm';
        exchangeItem.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <span class="text-md font-medium text-gray-800">${student.name}</span>
                    <span class="text-xs text-gray-500 ml-2">${student.studentId}</span>
                </div>
                <span class="text-xs text-gray-500">${formatDate(exchange.createdAt)}</span>
            </div>
            <div class="flex justify-between items-center mt-2">
                <div class="text-sm text-gray-700">
                    兑换: ${reward.name} × ${exchange.quantity}
                </div>
                <span class="text-xs text-red-500">-${exchange.pointsCost}积分</span>
            </div>
        `;
        exchangeList.appendChild(exchangeItem);
    });
}

// 设置奖励页面事件监听器
function setupRewardListeners() {
    // 添加奖品按钮
    document.getElementById('add-reward-btn').addEventListener('click', () => {
        openRewardModal('add');
    });
    
    // 兑换奖品按钮
    document.getElementById('new-exchange-btn').addEventListener('click', () => {
        openExchangeModal();
    });
    
    // 奖品模态框取消按钮
    document.getElementById('reward-modal-cancel').addEventListener('click', () => {
        document.getElementById('reward-modal').classList.add('hidden');
    });
    
    // 兑换模态框取消按钮
    document.getElementById('exchange-modal-cancel').addEventListener('click', () => {
        document.getElementById('exchange-modal').classList.add('hidden');
    });
    
    // 奖品表单提交
    document.getElementById('reward-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveReward();
    });
    
    // 兑换表单提交
    document.getElementById('exchange-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveExchange();
    });
    
    // 兑换时学生选择变化
    document.getElementById('exchange-student').addEventListener('change', updateExchangeInfo);
    
    // 兑换时奖品选择变化
    document.getElementById('exchange-reward').addEventListener('change', updateExchangeInfo);
    
    // 兑换时数量变化
    document.getElementById('exchange-quantity').addEventListener('input', updateExchangeInfo);
}

// 打开奖品模态框
function openRewardModal(mode, rewardId = null) {
    const modal = document.getElementById('reward-modal');
    const titleElement = document.getElementById('reward-modal-title');
    const form = document.getElementById('reward-form');
    
    // 重置表单
    form.reset();
    
    if (mode === 'edit' && rewardId) {
        // 编辑模式
        titleElement.textContent = '编辑奖品';
        currentEditRewardId = rewardId;
        
        const rewards = loadData('app_rewards');
        const reward = rewards.find(r => r.id === rewardId);
        
        if (reward) {
            document.getElementById('reward-name').value = reward.name;
            document.getElementById('reward-points').value = reward.pointsCost;
            document.getElementById('reward-stock').value = reward.stock;
            document.getElementById('reward-description').value = reward.description || '';
        }
    } else {
        // 添加模式
        titleElement.textContent = '添加奖品';
        currentEditRewardId = null;
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 打开兑换模态框
function openExchangeModal() {
    const modal = document.getElementById('exchange-modal');
    const form = document.getElementById('exchange-form');
    
    // 重置表单
    form.reset();
    
    // 填充学生下拉选项
    const studentSelect = document.getElementById('exchange-student');
    const students = loadData('app_students');
    
    // 清空现有选项（除了第一个"选择学生"）
    while (studentSelect.options.length > 1) {
        studentSelect.remove(1);
    }
    
    // 添加学生选项（按积分从高到低排序）
    const sortedStudents = [...students].sort((a, b) => 
        (b.totalPoints || 0) - (a.totalPoints || 0)
    );
    
    sortedStudents.forEach(student => {
        const option = new Option(`${student.name} (${student.totalPoints || 0}积分)`, student.id);
        studentSelect.add(option);
    });
    
    // 填充奖品下拉选项
    const rewardSelect = document.getElementById('exchange-reward');
    const rewards = loadData('app_rewards');
    
    // 清空现有选项（除了第一个"选择奖品"）
    while (rewardSelect.options.length > 1) {
        rewardSelect.remove(1);
    }
    
    // 添加奖品选项（只添加有库存的）
    const availableRewards = rewards.filter(r => r.stock > 0);
    
    if (availableRewards.length === 0) {
        rewardSelect.innerHTML = '<option value="">没有可用奖品</option>';
    } else {
        availableRewards.forEach(reward => {
            const option = new Option(`${reward.name} (${reward.pointsCost}积分，库存${reward.stock})`, reward.id);
            rewardSelect.add(option);
        });
    }
    
    // 重置兑换信息
    document.getElementById('exchange-student-points').textContent = '0';
    document.getElementById('exchange-required-points').textContent = '0';
    document.getElementById('exchange-remaining-points').textContent = '0';
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 更新兑换信息
function updateExchangeInfo() {
    const studentId = document.getElementById('exchange-student').value;
    const rewardId = document.getElementById('exchange-reward').value;
    const quantity = parseInt(document.getElementById('exchange-quantity').value) || 1;
    
    const students = loadData('app_students');
    const rewards = loadData('app_rewards');
    
    // 学生积分
    let studentPoints = 0;
    if (studentId) {
        const student = students.find(s => s.id === studentId);
        if (student) {
            studentPoints = student.totalPoints || 0;
        }
    }
    
    // 所需积分
    let requiredPoints = 0;
    let maxQuantity = 1;
    if (rewardId) {
        const reward = rewards.find(r => r.id === rewardId);
        if (reward) {
            requiredPoints = reward.pointsCost * quantity;
            maxQuantity = reward.stock;
        }
    }
    
    // 更新数量上限
    document.getElementById('exchange-quantity').max = maxQuantity;
    if (quantity > maxQuantity) {
        document.getElementById('exchange-quantity').value = maxQuantity;
        requiredPoints = requiredPoints / quantity * maxQuantity;
    }
    
    // 剩余积分
    const remainingPoints = studentPoints - requiredPoints;
    
    // 更新显示
    document.getElementById('exchange-student-points').textContent = studentPoints;
    document.getElementById('exchange-required-points').textContent = requiredPoints;
    document.getElementById('exchange-remaining-points').textContent = remainingPoints;
    
    // 检查是否可以兑换
    const exchangeButton = document.getElementById('exchange-confirm-btn');
    if (remainingPoints < 0 || requiredPoints === 0 || !studentId || !rewardId) {
        exchangeButton.disabled = true;
        exchangeButton.classList.add('opacity-50');
    } else {
        exchangeButton.disabled = false;
        exchangeButton.classList.remove('opacity-50');
    }
}

// 保存奖品
function saveReward() {
    const nameInput = document.getElementById('reward-name');
    const pointsInput = document.getElementById('reward-points');
    const stockInput = document.getElementById('reward-stock');
    const descriptionInput = document.getElementById('reward-description');
    
    const name = nameInput.value.trim();
    const pointsCost = parseInt(pointsInput.value);
    const stock = parseInt(stockInput.value);
    const description = descriptionInput.value.trim();
    
    // 验证
    if (!name || isNaN(pointsCost) || isNaN(stock) || pointsCost < 1) {
        showAlert('请填写完整的奖品信息，积分必须大于0');
        return;
    }
    
    // 获取现有奖品
    const rewards = loadData('app_rewards');
    
    // 检查奖品名称是否已存在（编辑时除外）
    if (!currentEditRewardId) {
        const rewardExists = rewards.some(r => r.name === name);
        if (rewardExists) {
            showAlert(`奖品"${name}"已存在，请使用其他名称`);
            return;
        }
    }
    
    const now = new Date().toISOString();
    
    if (currentEditRewardId) {
        // 更新现有奖品
        const index = rewards.findIndex(r => r.id === currentEditRewardId);
        if (index !== -1) {
            const updatedReward = {
                ...rewards[index],
                name,
                pointsCost,
                stock,
                description,
                updatedAt: now
            };
            rewards[index] = updatedReward;
        }
    } else {
        // 添加新奖品
        const newReward = {
            id: generateId(),
            name,
            pointsCost,
            stock,
            description,
            createdAt: now,
            updatedAt: now
        };
        rewards.push(newReward);
    }
    
    // 保存到localStorage
    saveData('app_rewards', rewards);
    
    // 关闭模态框
    document.getElementById('reward-modal').classList.add('hidden');
    
    // 刷新奖品列表
    renderRewardList();
    refreshAllMainViews();
}

// 删除奖品
function deleteReward(rewardId) {
    const rewards = loadData('app_rewards');
    const exchanges = loadData('app_exchanges');
    
    // 检查是否有兑换记录使用该奖品
    const usedInExchange = exchanges.some(e => e.rewardId === rewardId);
    if (usedInExchange) {
        showAlert('该奖品已被兑换过，无法删除');
        return;
    }
    
    // 从奖品数组中删除
    const updatedRewards = rewards.filter(reward => reward.id !== rewardId);
    
    // 保存更新后的数据
    saveData('app_rewards', updatedRewards);
    
    // 刷新奖品列表
    renderRewardList();
    refreshAllMainViews();
}

// 保存兑换记录
function saveExchange() {
    const studentId = document.getElementById('exchange-student').value;
    const rewardId = document.getElementById('exchange-reward').value;
    const quantity = parseInt(document.getElementById('exchange-quantity').value) || 1;
    
    // 验证
    if (!studentId || !rewardId || quantity < 1) {
        showAlert('请选择学生、奖品，并确保数量大于0');
        return;
    }
    
    // 获取数据
    const students = loadData('app_students');
    const rewards = loadData('app_rewards');
    const exchanges = loadData('app_exchanges');
    
    const student = students.find(s => s.id === studentId);
    const reward = rewards.find(r => r.id === rewardId);
    
    if (!student || !reward) {
        showAlert('所选学生或奖品不存在');
        return;
    }
    
    // 检查库存
    if (reward.stock < quantity) {
        showAlert(`奖品"${reward.name}"库存不足，当前库存: ${reward.stock}`);
        return;
    }
    
    // 计算所需积分
    const requiredPoints = reward.pointsCost * quantity;
    
    // 检查积分是否足够
    if ((student.totalPoints || 0) < requiredPoints) {
        showAlert(`学生"${student.name}"积分不足，当前积分: ${student.totalPoints || 0}，需要: ${requiredPoints}`);
        return;
    }
    
    // 创建兑换记录
    const now = new Date().toISOString();
    const newExchange = {
        id: generateId(),
        studentId,
        rewardId,
        pointsCost: requiredPoints,
        quantity,
        createdAt: now
    };
    
    // 更新学生积分
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
        students[studentIndex].totalPoints = students[studentIndex].totalPoints - requiredPoints;
    }
    
    // 更新奖品库存
    const rewardIndex = rewards.findIndex(r => r.id === rewardId);
    if (rewardIndex !== -1) {
        rewards[rewardIndex].stock = rewards[rewardIndex].stock - quantity;
    }
    
    // 保存数据
    exchanges.push(newExchange);
    saveData('app_exchanges', exchanges);
    saveData('app_students', students);
    saveData('app_rewards', rewards);
    
    // 关闭模态框
    document.getElementById('exchange-modal').classList.add('hidden');
    
    // 刷新列表
    renderRewardList();
    renderExchangeList();
    
    // 提示成功
                    showAlert(`兑换成功，学生"${student.name}"兑换了"${reward.name}" × ${quantity}，花费${requiredPoints}积分`);
    refreshAllMainViews();
}

// 学生管理功能
let currentEditStudentId = null;
let currentEditGroupId = null;

// 初始化学生管理页面
function initStudentsPage() {
    console.log("初始化学生管理页面开始");
    try {
        // 确保页面元素已准备好（可能是在系统重置后首次访问）
        if (document.getElementById('students-page')) {
            renderStudentList();
            renderGroupList();
            setupStudentListeners();
            // 设置统一的导入/导出监听器
            setupImportExportListeners();
            console.log("学生管理页面初始化完成");
        } else {
            console.warn("学生管理页面元素不存在，初始化延迟");
            // 如果页面元素还没准备好，延迟一段时间再次尝试
            setTimeout(initStudentsPage, 100);
        }
    } catch (error) {
        console.error("初始化学生管理页面时出错:", error);
    }
}

// 设置统一的导入/导出监听器
function setupImportExportListeners() {
    try {
        console.log("设置导入/导出监听器...");
        
        // 导入学生按钮
        const importBtn = document.getElementById('import-students-btn');
        if (importBtn) {
            // 先移除可能存在的事件监听器
            importBtn.onclick = null;
            importBtn.addEventListener('click', () => {
                // 确保处理标记被重置，允许新的导入
                window._processingImport = false;
                console.log("点击导入按钮，重置处理标记");
                
                const importModal = document.getElementById('import-modal');
                if (importModal) {
                    importModal.classList.remove('hidden');
                    // 确保文件输入框被清空
                    const fileInput = document.getElementById('import-file');
                    if (fileInput) {
                        fileInput.value = '';
                        console.log("清空文件输入框");
                    }
                }
            });
        }
        
        // 使用新的事件绑定函数设置导出相关按钮
        setupExportButtonListeners();
        
        // 设置导出模态框的事件监听
        setupExportModalListeners();
        
        // 导入模态框取消按钮
        const importCancelBtn = document.getElementById('import-modal-cancel');
        if (importCancelBtn) {
            importCancelBtn.onclick = null;
            importCancelBtn.addEventListener('click', () => {
                const importModal = document.getElementById('import-modal');
                if (importModal) {
                    importModal.classList.add('hidden');
                }
            });
        }
        
        // 导入文件提交（防止重复绑定）
        const importModalSubmitBtn = document.getElementById('import-modal-submit');
        if (importModalSubmitBtn) {
            // 先移除可能存在的事件监听器
            importModalSubmitBtn.onclick = null;
            // 添加新的事件监听器
            importModalSubmitBtn.addEventListener('click', handleImportSubmit);
        }
        
        console.log("导入/导出监听器设置完成");
    } catch (error) {
        console.error("设置导入/导出监听器时出错:", error);
    }
}

// 处理导入文件提交
function handleImportSubmit() {
    const fileInput = document.getElementById('import-file');
    if (fileInput.files.length === 0) {
        showAlert('请选择文件');
        // 确保重置处理标记，以便下次可以正常导入
        window._processingImport = false;
        return;
    }
    
    // 注意：不在此处重置处理标记，正确的做法是在importStudents中设置处理标记
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    // 立即关闭导入弹窗
    const importModal = document.getElementById('import-modal');
    if (importModal) {
        importModal.classList.add('hidden');
    }
    
    reader.onload = (e) => {
        const csvData = e.target.result;
        // 将文件内容传递给importStudents处理
        importStudents(csvData);
        
        // 在读取完成后清空文件输入框
        console.log("清空文件输入框");
        // 这里不需要立即清空，因为importStudents函数结束时会清空
        // 如果这里清空，会导致importStudents中无法获取正确的fileInput
    };
    
    reader.onerror = () => {
        showAlert('读取文件失败');
        window._processingImport = false; // 重置处理标记
        if (fileInput) {
            fileInput.value = ''; // 清空文件输入框
        }
    };
    
    // 开始读取文件
    console.log("开始读取导入文件...");
    reader.readAsText(file);
}

// 渲染学生列表
function renderStudentList(searchTerm = '') {
    const studentList = document.getElementById('student-list');
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    
    // 清空列表
    studentList.innerHTML = '';
    
    if (students.length === 0) {
        studentList.innerHTML = '<div class="text-center py-4 text-gray-500">暂无学生，请添加</div>';
        return;
    }
    
    // 过滤学生
    const filteredStudents = searchTerm 
        ? students.filter(student => 
            student.name.includes(searchTerm) || 
            student.studentId.includes(searchTerm))
        : students;
    
    if (filteredStudents.length === 0) {
        studentList.innerHTML = '<div class="text-center py-4 text-gray-500">未找到匹配的学生</div>';
        return;
    }
    
    // 创建学生卡片
    filteredStudents.forEach(student => {
        const groupName = student.groupId 
            ? groups.find(g => g.id === student.groupId)?.name || '未分组' 
            : '未分组';
        
        const studentCard = document.createElement('div');
        studentCard.className = 'bg-white rounded-lg shadow-sm p-2 hover:shadow-md transition-shadow';
        studentCard.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center">
                    <h3 class="text-sm font-medium text-gray-800">${student.name}</h3>
                    <span class="text-xs text-gray-500 ml-2">${student.studentId}</span>
            </div>
                <span class="bg-primary text-white px-2 py-0.5 rounded-full text-xs">${student.totalPoints || 0}分</span>
            </div>
            <div class="flex justify-between items-center mt-1 text-xs">
                <span class="text-gray-400">${groupName} | ${student.gender}</span>
                <div class="flex space-x-1">
                    <button class="edit-student-btn text-xs px-2 py-0.5 bg-primary text-white rounded hover:bg-primary-dark" data-id="${student.id}">编辑</button>
                    <button class="delete-student-btn text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600" data-id="${student.id}">删除</button>
                </div>
            </div>
        `;
        studentList.appendChild(studentCard);
    });
    
    // 绑定编辑和删除按钮事件
    document.querySelectorAll('.edit-student-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const studentId = e.currentTarget.dataset.id;
            openStudentModal('edit', studentId);
        });
    });
    
    document.querySelectorAll('.delete-student-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const studentId = e.currentTarget.dataset.id;
            const student = students.find(s => s.id === studentId);
                        showConfirm(`确定要删除学生"${student.name}"吗？`, function() {
        deleteStudent(studentId);
    });
        });
    });
}

// 渲染小组列表
function renderGroupList() {
    const groupList = document.getElementById('group-list');
    const groups = loadData('app_groups');
    const students = loadData('app_students');
    
    // 清空列表
    groupList.innerHTML = '';
    
    if (groups.length === 0) {
        groupList.innerHTML = '<div class="col-span-2 text-center py-4 text-gray-500">暂无小组，请添加</div>';
        return;
    }
    
    // 创建小组卡片
    groups.forEach(group => {
        const groupStudents = students.filter(student => student.groupId === group.id);
        const totalPoints = groupStudents.reduce((sum, student) => sum + (student.totalPoints || 0), 0);
        
        const groupCard = document.createElement('div');
        groupCard.className = 'card';
        groupCard.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-md font-medium text-gray-800">${group.name}</h3>
                <div class="flex space-x-2">
                    <button class="edit-group-btn btn btn-primary btn-sm" data-id="${group.id}">编辑</button>
                    <button class="delete-group-btn btn btn-danger btn-sm" data-id="${group.id}">删除</button>
                </div>
            </div>
            <div class="flex justify-between text-sm text-gray-600 mb-2">
                <div>成员数: ${groupStudents.length}</div>
                <div>总积分: ${totalPoints}</div>
            </div>
            <div class="text-xs text-gray-500">
                ${groupStudents.length > 0 
                    ? groupStudents.map(s => s.name).join(', ')
                    : '(暂无成员)'}
            </div>
        `;
        groupList.appendChild(groupCard);
    });
    
    // 绑定编辑和删除按钮事件
    document.querySelectorAll('.edit-group-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.id;
            openGroupModal('edit', groupId);
        });
    });
    
    document.querySelectorAll('.delete-group-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const groupId = e.currentTarget.dataset.id;
            const group = groups.find(g => g.id === groupId);
            const groupStudents = students.filter(student => student.groupId === groupId);
            
            if (groupStudents.length > 0) {
                showAlert(`小组"${group.name}"中还有学生，无法删除。请先将学生移出小组。`);
            } else {
                showConfirm(`确定要删除小组"${group.name}"吗？`, 
                    function() {
                        deleteGroup(groupId);
                    }
                );
            }
        });
    });
}

// 设置学生管理页面的事件监听器
function setupStudentListeners() {
    console.log("开始设置学生管理页面事件监听器");
    
    // 安全地添加事件监听器的辅助函数
    function safeAddEventListener(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(eventType, handler);
            return true;
        } else {
            console.warn(`元素不存在，无法添加事件监听器: ${elementId}`);
            return false;
        }
    }
    
    // 添加学生按钮
    safeAddEventListener('add-student-btn', 'click', () => {
        openStudentModal('add');
    });
    
    // 添加小组按钮
    safeAddEventListener('add-group-btn', 'click', () => {
        openGroupModal('add');
    });
    
    // 学生搜索
    safeAddEventListener('student-search', 'input', (e) => {
        renderStudentList(e.target.value.trim());
    });
    
    // 学生模态框取消按钮
    safeAddEventListener('student-modal-cancel', 'click', () => {
        document.getElementById('student-modal')?.classList.add('hidden');
    });
    
    // 小组模态框取消按钮
    safeAddEventListener('group-modal-cancel', 'click', () => {
        document.getElementById('group-modal')?.classList.add('hidden');
    });
    
    // 学生表单提交
    safeAddEventListener('student-form', 'submit', (e) => {
        e.preventDefault();
        saveStudent();
    });
    
    // 小组表单提交
    safeAddEventListener('group-form', 'submit', (e) => {
        e.preventDefault();
        saveGroup();
    });
    
    console.log("完成设置学生管理页面事件监听器");
    
    // 注意：导入/导出相关的事件监听已在setupImportExportListeners函数中设置，此处不再重复绑定
}

// 打开学生模态框
function openStudentModal(mode, studentId = null) {
    const modal = document.getElementById('student-modal');
    const titleElement = document.getElementById('student-modal-title');
    const form = document.getElementById('student-form');
    
    // 重置表单
    form.reset();
    
    // 填充小组下拉选项
    const groupSelect = document.getElementById('student-group');
    const groups = loadData('app_groups');
    
    // 清空现有选项（除了第一个"无小组"）
    while (groupSelect.options.length > 1) {
        groupSelect.remove(1);
    }
    
    // 添加小组选项
    groups.forEach(group => {
        const option = new Option(group.name, group.id);
        groupSelect.add(option);
    });
    
    if (mode === 'edit' && studentId) {
        // 编辑模式
        titleElement.textContent = '编辑学生';
        currentEditStudentId = studentId;
        
        const students = loadData('app_students');
        const student = students.find(s => s.id === studentId);
        
        if (student) {
            document.getElementById('student-name').value = student.name;
            document.getElementById('student-id').value = student.studentId;
            document.getElementById('student-gender').value = student.gender;
            document.getElementById('student-group').value = student.groupId || '';
        }
    } else {
        // 添加模式
        titleElement.textContent = '添加学生';
        currentEditStudentId = null;
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 打开小组模态框
function openGroupModal(mode, groupId = null) {
    const modal = document.getElementById('group-modal');
    const titleElement = document.getElementById('group-modal-title');
    const form = document.getElementById('group-form');
    
    // 重置表单
    form.reset();
    
    if (mode === 'edit' && groupId) {
        // 编辑模式
        titleElement.textContent = '编辑小组';
        currentEditGroupId = groupId;
        
        const groups = loadData('app_groups');
        const group = groups.find(g => g.id === groupId);
        
        if (group) {
            document.getElementById('group-name').value = group.name;
        }
    } else {
        // 添加模式
        titleElement.textContent = '添加小组';
        currentEditGroupId = null;
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 保存学生
function saveStudent() {
    const nameInput = document.getElementById('student-name');
    const idInput = document.getElementById('student-id');
    const genderSelect = document.getElementById('student-gender');
    const groupSelect = document.getElementById('student-group');
    
    const name = nameInput.value.trim();
    const studentId = idInput.value.trim();
    const gender = genderSelect.value;
    const groupId = groupSelect.value;
    
    // 验证
    if (!name || !studentId) {
        showAlert('请填写学生姓名和学号');
        return;
    }
    
    // 获取现有学生
    const students = loadData('app_students');
    
    // 检查学号是否已存在（编辑时除外）
    if (!currentEditStudentId) {
        const studentExists = students.some(s => s.studentId === studentId);
        if (studentExists) {
            showAlert(`学号 ${studentId} 已存在，请使用其他学号`);
            return;
        }
    }
    
    const now = new Date().toISOString();
    
    if (currentEditStudentId) {
        // 更新现有学生
        const index = students.findIndex(s => s.id === currentEditStudentId);
        if (index !== -1) {
            const updatedStudent = {
                ...students[index],
                name,
                studentId,
                gender,
                groupId: groupId || null,
                updatedAt: now
            };
            students[index] = updatedStudent;
        }
    } else {
        // 添加新学生
        const newStudent = {
            id: generateId(),
            name,
            studentId,
            gender,
            groupId: groupId || null,
            totalPoints: 0,
            createdAt: now,
            updatedAt: now
        };
        students.push(newStudent);
    }
    
    // 保存到localStorage
    saveData('app_students', students);
    
    // 关闭模态框
    document.getElementById('student-modal').classList.add('hidden');
    
    // 刷新学生列表和小组列表
    renderStudentList();
    renderGroupList();
    // 刷新首页相关内容
    updateDashboardStats();
    initStudentPointsTable();
    loadRecentPointsLogs();
    initQuickRuleButtons();
    populateGroupFilter();
    refreshAllMainViews();
}

// 保存小组
function saveGroup() {
    const nameInput = document.getElementById('group-name');
    const name = nameInput.value.trim();
    
    // 验证
    if (!name) {
        showAlert('请填写小组名称');
        return;
    }
    
    // 获取现有小组
    const groups = loadData('app_groups');
    
    // 检查小组名称是否已存在（编辑时除外）
    if (!currentEditGroupId) {
        const groupExists = groups.some(g => g.name === name);
        if (groupExists) {
            showAlert(`小组 ${name} 已存在，请使用其他名称`);
            return;
        }
    }
    
    const now = new Date().toISOString();
    
    if (currentEditGroupId) {
        // 更新现有小组
        const index = groups.findIndex(g => g.id === currentEditGroupId);
        if (index !== -1) {
            const updatedGroup = {
                ...groups[index],
                name,
                updatedAt: now
            };
            groups[index] = updatedGroup;
        }
    } else {
        // 添加新小组
        const newGroup = {
            id: generateId(),
            name,
            createdAt: now,
            updatedAt: now
        };
        groups.push(newGroup);
    }
    
    // 保存到localStorage
    saveData('app_groups', groups);
    
    // 关闭模态框
    document.getElementById('group-modal').classList.add('hidden');
    
    // 刷新小组列表
    renderGroupList();
    // 刷新首页相关内容
    updateDashboardStats();
    initStudentPointsTable();
    loadRecentPointsLogs();
    initQuickRuleButtons();
    populateGroupFilter();
    refreshAllMainViews();
}

// 删除学生
function deleteStudent(studentId) {
    const students = loadData('app_students');
    const pointLogs = loadData('app_pointLogs');
    const exchanges = loadData('app_exchanges');
    
    // 从学生数组中删除
    const updatedStudents = students.filter(student => student.id !== studentId);
    
    // 同时删除该学生的积分记录和兑换记录
    const updatedPointLogs = pointLogs.filter(log => log.studentId !== studentId);
    const updatedExchanges = exchanges.filter(exchange => exchange.studentId !== studentId);
    
    // 保存更新后的数据
    saveData('app_students', updatedStudents);
    saveData('app_pointLogs', updatedPointLogs);
    saveData('app_exchanges', updatedExchanges);
    
    // 刷新学生列表和小组列表
    renderStudentList();
    renderGroupList();
    refreshAllMainViews();
}

// 删除小组
function deleteGroup(groupId) {
    const groups = loadData('app_groups');
    
    // 从小组数组中删除
    const updatedGroups = groups.filter(group => group.id !== groupId);
    
    // 保存更新后的数据
    saveData('app_groups', updatedGroups);
    
    // 刷新小组列表
    renderGroupList();
    refreshAllMainViews();
}

// 批量导入学生
function importStudents(csvData) {
    console.log("导入状态检查:", window._processingImport);
    // 检查导入标志，如果已经在处理，则阻止再次导入
    if (window._processingImport === true) {
        console.log("正在进行导入处理，请等待当前导入完成");
        // 标记在导入过程中的特殊提示
        window._insideImportProcess = true;
        showAlert("正在进行导入处理，请等待当前导入完成");
        window._insideImportProcess = false;
        return;
    }
    
    // 确保设置处理标志，防止并发导入
    window._processingImport = true;
    // 标记当前处于导入过程中，这样导入相关的提示不会被忽略
    window._insideImportProcess = true;
    console.log("设置导入标志为true");
    
    console.log("开始处理导入数据...");
    // 移除下面的内联样式设置，仅使用CSS类控制显示/隐藏
    // importModal.style.display = 'none';
    
    // 处理可能的编码问题
    let processedData = csvData;
    
    // 检测数据中是否有乱码特征（常见于编码问题）
    if (hasEncodingIssues(csvData)) {
        console.log("检测到可能的编码问题，尝试修复...");
        try {
            // 尝试通过启发式方法修复编码问题
            processedData = fixEncodingIssues(csvData);
        } catch (e) {
            console.error("修复编码失败:", e);
            // 继续使用原始数据
        }
    }
    
    // 将CSV数据按行分割
    const rows = processedData.split(/\r?\n/).filter(row => row.trim() !== '');
    
    if (rows.length === 0) {
        showAlert('文件为空或格式不正确');
        // 重置处理标志
        window._processingImport = false;
        return;
    }
    
    // 检查是否是在清除数据后的状态 - 多重检查
    // 1. 检查localStorage中的重置标记
    // 2. 检查内存中的重置标记
    // 3. 检查学生数据是否为空
    const systemResetMark = localStorage.getItem('app_system_reset');
    const memoryResetMark = window._systemReset === true;
    const emptyStudents = !localStorage.getItem('app_students') || loadData('app_students').length === 0;
    
    // 任一条件满足即认为是全新系统
    // 设置强制判断为新系统，避免导入后再次导入时出现"已存在"的错误
    // const freshSystem = systemResetMark || memoryResetMark || emptyStudents;
    const freshSystem = true; // 强制将每次导入视为新系统，这样可以避免"学号已存在"的问题
    
    console.log("当前系统状态判断：", {
        systemResetMark: systemResetMark ? true : false,
        memoryResetMark: memoryResetMark,
        emptyStudents: emptyStudents,
        freshSystem: freshSystem
    });

    if (freshSystem) {
        console.log("导入模式：全新导入（不检查重复学号）");
    } else {
        console.log("导入模式：追加导入（检查重复学号）");
    }
    
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    const imported = [];
    const errors = [];
    
    // 记录所有出现的学号，用于检测文件内重复
    const studentIdsInFile = new Set();
    
    // 处理每一行
    rows.forEach((row, index) => {
        // 跳过可能的标题行
        if (index === 0 && row.includes('姓名') && row.includes('学号')) {
            return;
        }
        
        // 解析CSV行
        const columns = row.split(',').map(col => col.trim());
        
        if (columns.length < 2) {
            errors.push(`第${index + 1}行: 数据不完整，至少需要姓名和学号`);
            return;
        }
        
        const name = columns[0];
        const studentId = columns[1];
        const gender = columns.length > 2 ? columns[2] : '未知';
        const groupName = columns.length > 3 ? columns[3] : '';
        
        // 检查文件内学号是否重复
        if (studentIdsInFile.has(studentId)) {
            errors.push(`第${index + 1}行: 学号 ${studentId} 在导入文件中重复`);
            return;
        }
        studentIdsInFile.add(studentId);
        
        // 改进逻辑：始终检查文件内部学号重复，但忽略与已有学生的学号重复
        if (!freshSystem && students.some(s => s.studentId === studentId)) {
            console.log(`学号重复检查忽略: ${studentId} (文件第${index + 1}行)`);
            // 不再将这视为错误，允许重新导入已有学号的学生
            // errors.push(`第${index + 1}行: 学号 ${studentId} 已存在`);
            // return;
        }
        
        // 查找或创建小组
        let groupId = null;
        if (groupName) {
            const existingGroup = groups.find(g => g.name === groupName);
            if (existingGroup) {
                groupId = existingGroup.id;
            } else {
                // 创建新小组
                const newGroup = {
                    id: generateId(),
                    name: groupName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                groups.push(newGroup);
                groupId = newGroup.id;
            }
        }
        
        // 检查是否已存在相同学号的学生
        const existingStudentIndex = students.findIndex(s => s.studentId === studentId);
        
        if (existingStudentIndex >= 0) {
            // 如果存在相同学号的学生，使用新数据更新该学生
            console.log(`更新已存在的学生信息: ${studentId} - ${name}`);
            
            // 保留原有积分和ID
            const originalPoints = students[existingStudentIndex].totalPoints || 0;
            const originalId = students[existingStudentIndex].id;
            
            // 更新学生信息，但保留原积分和ID
            students[existingStudentIndex] = {
                id: originalId, // 保留原ID
                name,
                studentId,
                gender,
                groupId,
                totalPoints: originalPoints, // 保留原积分
                createdAt: students[existingStudentIndex].createdAt, // 保留原创建时间
                updatedAt: new Date().toISOString() // 更新修改时间
            };
            
            imported.push(students[existingStudentIndex]);
        } else {
            // 创建新学生对象
            const newStudent = {
                id: generateId(),
                name,
                studentId,
                gender,
                groupId,
                totalPoints: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            students.push(newStudent);
            imported.push(newStudent);
        }
    });
    
    // 保存更新后的数据
    saveData('app_students', students);
    if (groups.length > 0) {
        saveData('app_groups', groups);
    }
    
    // 这时弹窗已经关闭，可以安全显示导入结果
    let msg = '';
    if (imported.length > 0) {
        msg += `导入成功，共导入 ${imported.length} 名学生。`;
    }
    
    // 始终显示错误记录，主要是文件内部重复学号的错误
    if (errors.length > 0) {
        msg += `\n有 ${errors.length} 条错误记录:\n${errors.join('\n')}`;
    }
    
    // 如果存在系统重置标记，移除它
    if (systemResetMark) {
        localStorage.removeItem('app_system_reset');
        console.log("导入完成，已移除系统重置标记");
    }
    
    // 同样移除内存中的重置标记，确保连续导入功能正常
    if (memoryResetMark) {
        window._systemReset = false;
        console.log("导入完成，已重置内存重置标记");
    }
    
    // 首先更新和刷新视图
    // 刷新学生列表
    renderStudentList();
    renderGroupList();
    
    // 更新首页数据
    updateDashboardStats();
    initStudentPointsTable();
    loadRecentPointsLogs();
    initQuickRuleButtons(); // 刷新快速积分规则按钮
    populateGroupFilter(); // 刷新小组筛选下拉框
    
    // 不再直接调用refreshAllMainViews()，避免引起showAlert的连锁调用
    
    // 显示导入结果消息
    if (msg) {
        console.log("显示导入结果消息");
        // 使用特殊标记防止循环调用
        window._showingImportAlert = true;
        // 不再自动重新打开导入模态框，只显示导入结果
        showAlert(msg, function() {
            console.log("导入结果显示完毕");
            window._showingImportAlert = false;
            // 移除自动重新打开导入模态框的逻辑
        });
    }
    
    // 完成导入处理，重置处理标志
    console.log("导入处理完成，重置标志为false");
    window._processingImport = false;
    window._insideImportProcess = false; // 重置导入过程标记
    
    // 确保文件输入框被清空，以便下次导入
    const fileInput = document.getElementById('import-file');
    if (fileInput) {
        fileInput.value = '';
    }
}

// 导出学生数据（支持多种格式）
function exportStudents(format = 'csv') {
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    
    if (students.length === 0) {
        showAlert('没有学生数据可导出');
        return;
    }
    
    let content = '';
    let mimeType = '';
    let fileExt = '';
    
    // 根据选择的格式生成不同内容
    if (format === 'csv') {
        // CSV格式
        content = '姓名,学号,性别,小组,当前积分\n';
        
        students.forEach(student => {
            const groupName = student.groupId 
                ? groups.find(g => g.id === student.groupId)?.name || '' 
                : '';
            
            content += `${student.name},${student.studentId},${student.gender},${groupName},${student.totalPoints || 0}\n`;
        });
        
        mimeType = 'text/csv;charset=utf-8;';
        fileExt = 'csv';
    } else if (format === 'txt') {
        // TXT格式（采用逗号分隔，与导入保持一致）
        content = '姓名,学号,性别,小组,当前积分\n';
        
        students.forEach(student => {
            const groupName = student.groupId 
                ? groups.find(g => g.id === student.groupId)?.name || '' 
                : '';
            
            content += `${student.name},${student.studentId},${student.gender},${groupName},${student.totalPoints || 0}\n`;
        });
        
        mimeType = 'text/plain;charset=utf-8;';
        fileExt = 'txt';
    } else if (format === 'json') {
        // JSON格式（完整数据，包括ID等）
        const exportData = students.map(student => {
            const groupName = student.groupId 
                ? groups.find(g => g.id === student.groupId)?.name || '' 
                : '';
            
            return {
                ...student,
                groupName: groupName
            };
        });
        
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        fileExt = 'json';
    }
    
    // 创建Blob并下载
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `学生名单_${new Date().toISOString().split('T')[0]}.${fileExt}`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // 显示导出成功信息
    showAlert(`已成功导出${students.length}名学生的数据（${format.toUpperCase()}格式）`);
    
    // 导出完成后，重新绑定事件监听器以确保下次点击有效
    setTimeout(() => {
        // 确保模态框已隐藏
        const exportFormatModal = document.getElementById('export-format-modal');
        if (exportFormatModal) {
            exportFormatModal.classList.add('hidden');
            console.log("确保导出格式选择模态框已隐藏");
        }
        
        // 确保处理标志重置
        window._processingDialog = false;
        
        // 重新设置导出按钮的事件监听
        setupExportButtonListeners();
    }, 100);
}

// 兼容旧接口，默认导出CSV格式
function exportStudentsToCSV() {
    exportStudents('csv');
}

// 单独提取设置导出按钮监听器的函数，方便重用
function setupExportButtonListeners() {
    // 导出学生按钮
    const exportBtn = document.getElementById('export-students-btn');
    if (exportBtn) {
        // 先移除旧的事件监听器，避免多次绑定
        exportBtn.removeEventListener('click', handleExportStudents);
        
        // 绑定新的事件
        exportBtn.addEventListener('click', handleExportStudents);
    }
    
    // 导出积分记录按钮
    const exportPointsBtn = document.getElementById('export-points-btn');
    if (exportPointsBtn) {
        // 先移除旧的事件监听器，避免多次绑定
        exportPointsBtn.removeEventListener('click', handleExportPoints);
        
        // 绑定新的事件
        exportPointsBtn.addEventListener('click', handleExportPoints);
    }
    
    // 导出学生按钮处理函数
    function handleExportStudents(e) {
        // 防止事件冒泡
        e.preventDefault();
        e.stopPropagation();
        
        console.log("导出学生按钮被点击");
        
        // 打开导出格式选择模态框
        const exportFormatModal = document.getElementById('export-format-modal');
        if (exportFormatModal) {
            console.log("找到导出格式选择模态框，打开它");
            // 设置数据类型标记，用于区分导出学生还是积分记录
            window._exportDataType = 'students';
            exportFormatModal.classList.remove('hidden');
            
            // 确保CSV格式为默认选中
            const csvRadio = document.getElementById('format-csv');
            if (csvRadio) {
                csvRadio.checked = true;
            }
            
            // 设置模态框按钮的事件监听器
            setupExportModalListeners();
        } else {
            console.log("找不到导出格式选择模态框，需要重新加载页面");
            // 在弹窗不存在的情况下提示用户刷新页面
            showAlert("导出功能出现错误，请刷新页面后重试。", function() {
                location.reload();
            });
        }
    }
    
    // 导出积分记录按钮处理函数
    function handleExportPoints(e) {
        // 防止事件冒泡
        e.preventDefault();
        e.stopPropagation();
        
        console.log("导出积分记录按钮被点击");
        
        // 默认使用CSV导出积分记录
        exportPointLogsToCSV();
    }
}

// 设置导出模态框按钮事件监听器
function setupExportModalListeners() {
    // 导出格式选择模态框取消按钮
    const exportFormatCancelBtn = document.getElementById('export-format-cancel');
    if (exportFormatCancelBtn) {
        // 先移除旧的事件监听器，避免多次绑定
        exportFormatCancelBtn.removeEventListener('click', handleExportCancel);
        
        // 绑定新的事件监听
        exportFormatCancelBtn.addEventListener('click', handleExportCancel);
    }
    
    // 导出取消按钮处理函数
    function handleExportCancel(e) {
        // 防止事件冒泡
        e.preventDefault();
        e.stopPropagation();
        
        console.log("导出取消按钮被点击");
        
        const exportFormatModal = document.getElementById('export-format-modal');
        if (exportFormatModal) {
            // 使用classList.add添加hidden类，而不是移除元素
            exportFormatModal.classList.add('hidden');
            console.log("隐藏导出格式选择模态框（未移除）");
            
            // 确保处理标志重置
            window._processingDialog = false;
            
            // 关闭模态框后，重新设置导出按钮的事件监听器
            setTimeout(setupExportButtonListeners, 100);
        } else {
            console.log("导出格式选择模态框不存在，无法关闭");
        }
    }
    
    // 导出格式选择模态框确认按钮
    const exportFormatSubmitBtn = document.getElementById('export-format-submit');
    if (exportFormatSubmitBtn) {
        // 先移除旧的事件监听器，避免多次绑定
        exportFormatSubmitBtn.removeEventListener('click', handleExportSubmit);
        
        // 绑定新的事件监听
        exportFormatSubmitBtn.addEventListener('click', handleExportSubmit);
    }
    
    // 导出确认按钮处理函数
    function handleExportSubmit(e) {
        // 防止事件冒泡
        e.preventDefault();
        e.stopPropagation();
        
        console.log("导出确认按钮被点击");
        
        // 获取选择的格式
        const formatRadios = document.getElementsByName('export-format');
        let selectedFormat = 'csv'; // 默认CSV格式
        
        for (const radio of formatRadios) {
            if (radio.checked) {
                selectedFormat = radio.value;
                break;
            }
        }
        
        // 关闭模态框（先隐藏再导出，避免导出过程可能引起的UI问题）
        const exportFormatModal = document.getElementById('export-format-modal');
        if (exportFormatModal) {
            // 使用classList.add添加hidden类，而不是移除元素
            exportFormatModal.classList.add('hidden');
            console.log("隐藏导出格式选择模态框（未移除）");
        } else {
            console.log("导出格式选择模态框不存在，无法关闭");
        }
        
        // 根据数据类型导出不同的内容（延迟执行，确保UI先更新）
        setTimeout(() => {
            if (window._exportDataType === 'students') {
                exportStudents(selectedFormat);
            }
        }, 50);
    }
}

// 导出积分记录为CSV
function exportPointLogsToCSV() {
    // 获取所有积分记录（包括归档数据）
    const allPointLogs = loadAllPointLogs();
    const students = loadData('app_students');
    const pointRules = loadData('app_pointRules');
    
    if (allPointLogs.length === 0) {
        showAlert('没有积分记录可导出');
        return;
    }
    
    // 生成CSV内容
    let csvContent = '学生姓名,学号,积分值,积分规则,备注,操作时间\n';
    
    allPointLogs.forEach(log => {
        const student = students.find(s => s.id === log.studentId);
        const rule = pointRules.find(r => r.id === log.pointRuleId);
        
        if (!student) return; // 跳过找不到学生的记录
        
        const studentName = student.name;
        const studentId = student.studentId;
        const points = log.points;
        const ruleName = rule ? rule.name : '未知规则';
        const comment = log.comment || '';
        const createdAt = formatDate(log.createdAt);
        
        csvContent += `${studentName},${studentId},${points},${ruleName},${comment},${createdAt}\n`;
    });
    
    // 创建Blob并下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `积分记录_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    // 显示导出成功信息
    showAlert(`已成功导出${allPointLogs.length}条积分记录`);
    
    // 导出完成后，重新绑定事件监听器以确保下次点击有效
    setTimeout(() => {
        // 确保处理标志重置
        window._processingDialog = false;
        
        // 重新设置导出按钮的事件监听
        setupExportButtonListeners();
    }, 100);
}

// 积分管理功能
let currentEditRuleId = null;

// 初始化积分管理页面
function initPointsPage() {
    renderRuleList();
    renderRecentPointsLog();
    setupPointsListeners();
}

// 渲染积分规则列表
function renderRuleList() {
    const ruleList = document.getElementById('rule-list');
    const rules = loadData('app_pointRules');
    
    // 清空列表
    ruleList.innerHTML = '';
    
    if (rules.length === 0) {
        ruleList.innerHTML = '<div class="text-center py-4 text-gray-500">暂无积分规则，请添加</div>';
        return;
    }
    
    // 创建规则卡片，过滤掉"快速操作"
    rules.filter(rule => rule.name !== '快速操作').forEach(rule => {
        const ruleCard = document.createElement('div');
        const pointsClass = parseInt(rule.points) >= 0 ? 'text-green-500' : 'text-red-500';
        const pointsSign = parseInt(rule.points) >= 0 ? '+' : '';
        
        ruleCard.className = 'card card-sm';
        ruleCard.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="text-md font-medium text-gray-800">${rule.name}</h3>
                <span class="${pointsClass} font-medium">${pointsSign}${rule.points}</span>
            </div>
            <p class="text-gray-500 text-xs mt-1">${rule.description || '无描述'}</p>
            <div class="mt-2 flex justify-end items-center">
                <div class="flex space-x-2">
                    <button class="edit-rule-btn btn btn-primary btn-sm" data-id="${rule.id}">编辑</button>
                    <button class="delete-rule-btn btn btn-danger btn-sm" data-id="${rule.id}">删除</button>
                </div>
            </div>
        `;
        ruleList.appendChild(ruleCard);
    });
    
    // 绑定编辑和删除按钮事件
    document.querySelectorAll('.edit-rule-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const ruleId = e.currentTarget.dataset.id;
            openRuleModal('edit', ruleId);
        });
    });
    
    document.querySelectorAll('.delete-rule-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const ruleId = e.currentTarget.dataset.id;
            const rule = rules.find(r => r.id === ruleId);
            showConfirm(`确定要删除积分规则"${rule.name}"吗？`, 
                function() {
                    deleteRule(ruleId);
                }
            );
        });
    });
}

// 渲染最近积分记录
function renderRecentPointsLog() {
    const recentPoints = document.getElementById('recent-points');
    const pointLogs = loadData('app_pointLogs');
    const students = loadData('app_students');
    const rules = loadData('app_pointRules');
    
    // 清空列表
    recentPoints.innerHTML = '';
    
    if (pointLogs.length === 0) {
        recentPoints.innerHTML = '<div class="text-center py-4 text-gray-500">暂无积分记录</div>';
        return;
    }
    
    // 只显示最近的10条记录
    const recentLogs = [...pointLogs].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 10);
    
    // 创建积分记录卡片
    recentLogs.forEach(log => {
        const student = students.find(s => s.id === log.studentId);
        const rule = rules.find(r => r.id === log.pointRuleId);
        
        if (!student || !rule) return;
        
        const logCard = document.createElement('div');
        const pointsClass = parseInt(log.points) >= 0 ? 'text-green-500' : 'text-red-500';
        const pointsSign = parseInt(log.points) >= 0 ? '+' : '';
        
        logCard.className = 'card card-sm';
        logCard.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <span class="text-md font-medium text-gray-800">${student.name}</span>
                    <span class="text-xs text-gray-500 ml-2">${student.studentId}</span>
                </div>
                <span class="${pointsClass} font-medium">${pointsSign}${log.points}</span>
            </div>
            <p class="text-gray-700 text-sm mt-1">${rule.name}</p>
            <div class="mt-1 flex justify-between items-center">
                <span class="text-xs text-gray-500">${log.reason || '无备注'}</span>
                <span class="text-xs text-gray-400">${formatDate(log.createdAt)}</span>
            </div>
        `;
        recentPoints.appendChild(logCard);
    });
}

// 设置积分管理页面的事件监听器
function setupPointsListeners() {
    // 添加积分规则按钮
    document.getElementById('add-rule-btn').addEventListener('click', () => {
        openRuleModal('add');
    });
    
    // 规则模态框取消按钮
    document.getElementById('rule-modal-cancel').addEventListener('click', () => {
        document.getElementById('rule-modal').classList.add('hidden');
    });
    
    // 规则表单提交
    document.getElementById('rule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveRule();
    });
    
    // 单人积分按钮
    document.getElementById('student-point-btn').addEventListener('click', () => {
        openStudentPointModal();
    });
    
    // 小组积分按钮
    document.getElementById('group-point-btn').addEventListener('click', () => {
        // 使用全局小组积分模态框
        document.getElementById('group-point-modal').classList.remove('hidden');
        populateGroupPointModal();
    });
    
    // 单人积分模态框取消按钮
    document.getElementById('student-point-modal-cancel').addEventListener('click', () => {
        document.getElementById('student-point-modal').classList.add('hidden');
    });
    
    // 小组积分模态框取消按钮
    document.getElementById('group-point-modal-cancel').addEventListener('click', function() {
        document.getElementById('group-point-modal').classList.add('hidden');
    });
    
    // 单人积分表单提交
    document.getElementById('student-point-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addStudentPoints();
    });
    
    // 小组积分表单提交
    document.getElementById('group-point-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addGroupPoints();
        document.getElementById('group-point-modal').classList.add('hidden');
    });
    
    // 导入/导出相关功能已移至setupImportExportListeners函数
}

// 打开积分规则模态框
function openRuleModal(mode, ruleId = null) {
    const modal = document.getElementById('rule-modal');
    const titleElement = document.getElementById('rule-modal-title');
    const form = document.getElementById('rule-form');
    
    // 重置表单
    form.reset();
    
    if (mode === 'edit' && ruleId) {
        // 编辑模式
        titleElement.textContent = '编辑积分规则';
        currentEditRuleId = ruleId;
        
        const rules = loadData('app_pointRules');
        const rule = rules.find(r => r.id === ruleId);
        
        if (rule) {
            document.getElementById('rule-name').value = rule.name;
            document.getElementById('rule-points').value = rule.points;
            document.getElementById('rule-description').value = rule.description || '';
        }
    } else {
        // 添加模式
        titleElement.textContent = '添加积分规则';
        currentEditRuleId = null;
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 打开单人积分模态框
function openStudentPointModal() {
    const modal = document.getElementById('student-point-modal');
    const form = document.getElementById('student-point-form');
    
    // 重置表单
    form.reset();
    
    // 填充学生下拉选项
    const studentSelect = document.getElementById('point-student');
    const students = loadData('app_students');
    
    // 清空现有选项（除了第一个"选择学生"）
    while (studentSelect.options.length > 1) {
        studentSelect.remove(1);
    }
    
    // 添加学生选项
    students.forEach(student => {
        const option = new Option(`${student.name} (${student.studentId})`, student.id);
        studentSelect.add(option);
    });
    
    // 填充规则下拉选项
    const ruleSelect = document.getElementById('point-rule');
    const rules = loadData('app_pointRules');
    
    // 清空现有选项（除了第一个"选择规则"）
    while (ruleSelect.options.length > 1) {
        ruleSelect.remove(1);
    }
    
    // 添加规则选项
    rules.forEach(rule => {
        const pointsSign = parseInt(rule.points) >= 0 ? '+' : '';
        const option = new Option(`${rule.name} (${pointsSign}${rule.points}分)`, rule.id);
        ruleSelect.add(option);
    });
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 打开小组积分模态框
function openGroupPointModal() {
    const modal = document.getElementById('group-point-modal');
    const form = document.getElementById('group-point-form');
    
    // 重置表单
    form.reset();
    
    // 填充小组下拉选项
    const groupSelect = document.getElementById('point-group');
    const groups = loadData('app_groups');
    
    // 清空现有选项（除了第一个"选择小组"）
    while (groupSelect.options.length > 1) {
        groupSelect.remove(1);
    }
    
    // 添加小组选项
    groups.forEach(group => {
        const option = new Option(group.name, group.id);
        groupSelect.add(option);
    });
    
    // 填充规则下拉选项
    const ruleSelect = document.getElementById('group-point-rule');
    const rules = loadData('app_pointRules');
    
    // 清空现有选项（除了第一个"选择规则"）
    while (ruleSelect.options.length > 1) {
        ruleSelect.remove(1);
    }
    
    // 添加规则选项
    rules.forEach(rule => {
        const pointsSign = parseInt(rule.points) >= 0 ? '+' : '';
        const option = new Option(`${rule.name} (${pointsSign}${rule.points}分)`, rule.id);
        ruleSelect.add(option);
    });
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 保存积分规则
function saveRule() {
    const nameInput = document.getElementById('rule-name');
    const pointsInput = document.getElementById('rule-points');
    const descriptionInput = document.getElementById('rule-description');
    
    const name = nameInput.value.trim();
    const points = parseInt(pointsInput.value);
    const description = descriptionInput.value.trim();
    
    // 验证
    if (!name || isNaN(points)) {
        showAlert('请填写规则名称和分值');
        return;
    }
    
    // 获取现有规则
    const rules = loadData('app_pointRules');
    
    // 检查规则名称是否已存在（编辑时除外）
    if (!currentEditRuleId) {
        const ruleExists = rules.some(r => r.name === name);
        if (ruleExists) {
            showAlert(`规则 ${name} 已存在，请使用其他名称`);
            return;
        }
    }
    
    const now = new Date().toISOString();
    
    if (currentEditRuleId) {
        // 更新现有规则
        const index = rules.findIndex(r => r.id === currentEditRuleId);
        if (index !== -1) {
            const updatedRule = {
                ...rules[index],
                name,
                points,
                description,
                updatedAt: now
            };
            rules[index] = updatedRule;
        }
    } else {
        // 添加新规则
        const newRule = {
            id: generateId(),
            name,
            points,
            description,
            createdAt: now,
            updatedAt: now
        };
        rules.push(newRule);
    }
    
    // 保存到localStorage
    saveData('app_pointRules', rules);
    
    // 关闭模态框
    document.getElementById('rule-modal').classList.add('hidden');
    
    // 刷新规则列表
    renderRuleList();
    refreshAllMainViews();
}

// 删除积分规则
function deleteRule(ruleId) {
    const rules = loadData('app_pointRules');
    
    // 从规则数组中删除
    const updatedRules = rules.filter(rule => rule.id !== ruleId);
    
    // 保存更新后的数据
    saveData('app_pointRules', updatedRules);
    
    // 刷新规则列表
    renderRuleList();
    refreshAllMainViews();
}

// 为学生添加积分
function addStudentPoints() {
    const studentId = document.getElementById('point-student').value;
    const ruleId = document.getElementById('point-rule').value;
    const reason = document.getElementById('point-reason').value.trim();
    
    // 验证
    if (!studentId || !ruleId) {
        showAlert('请选择学生和积分规则');
        return;
    }
    
    // 获取学生和规则
    const students = loadData('app_students');
    const rules = loadData('app_pointRules');
    
    const student = students.find(s => s.id === studentId);
    const rule = rules.find(r => r.id === ruleId);
    
    if (!student || !rule) {
        showAlert('所选学生或规则不存在');
        return;
    }
    
    // 创建积分记录
    const pointLogs = loadData('app_pointLogs');
    const now = new Date().toISOString();
    
    const newLog = {
        id: generateId(),
        studentId,
        pointRuleId: ruleId,
        points: rule.points,
        reason,
        createdAt: now
    };
    
    pointLogs.push(newLog);
    
    // 更新学生总积分
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
        students[studentIndex].totalPoints = (students[studentIndex].totalPoints || 0) + parseInt(rule.points);
    }
    
    // 保存到localStorage
    saveData('app_pointLogs', pointLogs);
    saveData('app_students', students);
    
    // 关闭模态框
    document.getElementById('student-point-modal').classList.add('hidden');
    
    // 刷新积分记录
    renderRecentPointsLog();
    
    // 提示成功
    showAlert(`已为学生 ${student.name} ${parseInt(rule.points) >= 0 ? '增加' : '扣除'} ${Math.abs(rule.points)} 积分`);
    refreshAllMainViews();
}

// 为小组成员添加积分
function addGroupPoints() {
    // 检查是否已在处理中，避免重复点击引发的多次处理
    if (window.isProcessingGroupPoints) return;
    window.isProcessingGroupPoints = true;
    
    const groupId = document.getElementById('point-group').value;
    const ruleId = document.getElementById('group-point-rule').value;
    const reason = document.getElementById('group-point-reason').value.trim();
    
    try {
        // 验证
        if (!groupId || !ruleId) {
            showAlert('请选择小组和积分规则');
            return;
        }
        
        // 获取小组、学生和规则
        const groups = loadData('app_groups');
        const students = loadData('app_students');
        const rules = loadData('app_pointRules');
        
        const group = groups.find(g => g.id === groupId);
        const rule = rules.find(r => r.id === ruleId);
        const groupStudents = students.filter(s => s.groupId === groupId);
        
        if (!group || !rule) {
            showAlert('所选小组或规则不存在');
            return;
        }
        
        if (groupStudents.length === 0) {
            showAlert('所选小组没有学生');
            return;
        }
        
        // 为每个小组成员创建积分记录
        const pointLogs = loadData('app_pointLogs');
        const now = new Date().toISOString();
        
        groupStudents.forEach(student => {
            // 创建积分记录
            const newLog = {
                id: generateId(),
                studentId: student.id,
                pointRuleId: ruleId,
                points: rule.points,
                reason: `[小组]${reason}`,
                createdAt: now
            };
            
            pointLogs.push(newLog);
            
            // 更新学生总积分
            const studentIndex = students.findIndex(s => s.id === student.id);
            if (studentIndex !== -1) {
                students[studentIndex].totalPoints = (students[studentIndex].totalPoints || 0) + parseInt(rule.points);
            }
        });
        
        // 保存到localStorage
        saveData('app_pointLogs', pointLogs);
        saveData('app_students', students);
        
        // 关闭模态框
        document.getElementById('group-point-modal').classList.add('hidden');
        
        // 此行可以删除，因为下面会调用正确的函数
        // loadRecentPointsLogs();
        
        // 更新每个学生的积分显示，而不是刷新整个表格
        groupStudents.forEach(student => {
            updateStudentPointsInTable(student.id);
        });
        
        // 刷新积分记录和仪表盘统计
        loadRecentPointsLogs();
        updateDashboardStats();
        
        // 提示成功
        showAlert(`已为小组 ${group.name} 的 ${groupStudents.length} 名学生${parseInt(rule.points) >= 0 ? '增加' : '扣除'} ${Math.abs(rule.points)} 积分`);
    } finally {
        // 确保处理完成后重置标志，无论成功还是失败
        setTimeout(function() {
            window.isProcessingGroupPoints = false;
        }, 100);
    }
}

// 统计分析功能

// 初始化统计分析页面
function initStatsPage() {
    updateStatsOverview();
    updatePointDistribution();
    updateRankings('student');
    drawPointsTrendChart();
    
    // 绑定排行榜类型选择事件
    document.getElementById('rank-type').addEventListener('change', function(e) {
        updateRankings(e.target.value);
    });
}

// 更新统计概览
function updateStatsOverview() {
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    const pointLogs = loadData('app_pointLogs');
    
    // 计算总积分
    const totalPoints = students.reduce((sum, student) => sum + (student.totalPoints || 0), 0);
    
    // 更新数据
    document.getElementById('stats-total-students').textContent = students.length;
    document.getElementById('stats-total-groups').textContent = groups.length;
    document.getElementById('stats-total-points').textContent = totalPoints;
    document.getElementById('stats-avg-points').textContent = students.length > 0 
        ? Math.round(totalPoints / students.length * 10) / 10
        : 0;
}

// 更新积分区间分布
function updatePointDistribution() {
    const students = loadData('app_students');
    const distributionContainer = document.getElementById('stats-point-distribution');
    
    // 清空容器
    distributionContainer.innerHTML = '';
    
    if (students.length === 0) {
        distributionContainer.innerHTML = '<div class="text-center py-4 text-gray-500">暂无学生数据</div>';
        return;
    }
    
    // 定义积分区间
    const ranges = [
        { min: 0, max: 10, label: '0-10分', color: 'bg-red-100' },
        { min: 10, max: 30, label: '10-30分', color: 'bg-orange-100' },
        { min: 30, max: 50, label: '30-50分', color: 'bg-yellow-100' },
        { min: 50, max: 70, label: '50-70分', color: 'bg-green-100' },
        { min: 70, max: 90, label: '70-90分', color: 'bg-teal-100' },
        { min: 90, max: Infinity, label: '90分以上', color: 'bg-blue-100' }
    ];
    
    // 计算每个区间的学生数量
    ranges.forEach(range => {
        const count = students.filter(student => {
            const points = student.totalPoints || 0;
            return points >= range.min && points < range.max;
        }).length;
        
        const percentage = students.length > 0 ? Math.round(count / students.length * 100) : 0;
        
        // 创建进度条项
        const item = document.createElement('div');
        item.innerHTML = `
            <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">${range.label}</span>
                <span class="text-gray-800">${count}人 (${percentage}%)</span>
            </div>
            <div class="w-full bg-neutral-dark rounded-full h-2">
                <div class="${range.color} h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
        `;
        
        distributionContainer.appendChild(item);
    });
}

// 更新排行榜
function updateRankings(type) {
    const rankContainer = document.getElementById('rank-container');
    
    // 清空容器
    rankContainer.innerHTML = '';
    
    if (type === 'student') {
        // 学生排名
        const students = loadData('app_students');
        
        if (students.length === 0) {
            rankContainer.innerHTML = '<div class="text-center py-4 text-gray-500">暂无学生数据</div>';
            return;
        }
        
        // 按积分排序
        const sortedStudents = [...students].sort((a, b) => 
            (b.totalPoints || 0) - (a.totalPoints || 0)
        );
        
        // 创建排行榜
        const table = document.createElement('table');
        table.className = 'w-full';
        
        // 表头
        table.innerHTML = `
            <thead>
                <tr class="border-b border-neutral-dark">
                    <th class="px-2 py-2 text-left">排名</th>
                    <th class="px-2 py-2 text-left">姓名</th>
                    <th class="px-2 py-2 text-right">积分</th>
                </tr>
            </thead>
            <tbody>
                ${sortedStudents.map((student, index) => `
                    <tr class="border-b border-neutral-dark hover:bg-neutral transition-colors">
                        <td class="px-2 py-2 text-center">
                            <span class="inline-flex items-center justify-center w-6 h-6 ${index < 3 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'} rounded-full text-sm font-medium">
                                ${index + 1}
                            </span>
                        </td>
                        <td class="px-2 py-2">${student.name}</td>
                        <td class="px-2 py-2 text-right font-medium">${student.totalPoints || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        rankContainer.appendChild(table);
    } else {
        // 小组排名
        const groups = loadData('app_groups');
        const students = loadData('app_students');
        
        if (groups.length === 0) {
            rankContainer.innerHTML = '<div class="text-center py-4 text-gray-500">暂无小组数据</div>';
            return;
        }
        
        // 计算每个小组的总积分和平均积分
        const groupStats = groups.map(group => {
            const groupStudents = students.filter(student => student.groupId === group.id);
            const totalPoints = groupStudents.reduce((sum, student) => sum + (student.totalPoints || 0), 0);
            const avgPoints = groupStudents.length > 0 ? Math.round(totalPoints / groupStudents.length * 10) / 10 : 0;
            
            return {
                ...group,
                totalPoints,
                avgPoints,
                memberCount: groupStudents.length
            };
        });
        
        // 按总积分排序
        const sortedGroups = [...groupStats].sort((a, b) => b.totalPoints - a.totalPoints);
        
        // 创建排行榜
        const table = document.createElement('table');
        table.className = 'w-full';
        
        // 表头
        table.innerHTML = `
            <thead>
                <tr class="border-b border-neutral-dark">
                    <th class="px-2 py-2 text-left">排名</th>
                    <th class="px-2 py-2 text-left">小组</th>
                    <th class="px-2 py-2 text-right">成员数</th>
                    <th class="px-2 py-2 text-right">总积分</th>
                    <th class="px-2 py-2 text-right">平均积分</th>
                </tr>
            </thead>
            <tbody>
                ${sortedGroups.map((group, index) => `
                    <tr class="border-b border-neutral-dark hover:bg-neutral transition-colors">
                        <td class="px-2 py-2">${index + 1}</td>
                        <td class="px-2 py-2">${group.name}</td>
                        <td class="px-2 py-2 text-right">${group.memberCount}</td>
                        <td class="px-2 py-2 text-right font-medium">${group.totalPoints}</td>
                        <td class="px-2 py-2 text-right">${group.avgPoints}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        rankContainer.appendChild(table);
    }
}

// 绘制积分趋势图
function drawPointsTrendChart() {
    const pointLogs = loadData('app_pointLogs');
    
    if (pointLogs.length === 0) {
        document.getElementById('points-trend-chart').parentNode.innerHTML = 
            '<div class="flex items-center justify-center h-64 text-gray-500">暂无积分数据</div>';
        return;
    }
    
    // 按日期分组并计算每天的积分
    const dailyPoints = {};
    
    pointLogs.forEach(log => {
        const date = log.createdAt.split('T')[0];
        if (!dailyPoints[date]) {
            dailyPoints[date] = 0;
        }
        dailyPoints[date] += parseInt(log.points);
    });
    
    // 转换为数组并按日期排序
    const sortedDates = Object.keys(dailyPoints).sort();
    
    // 计算累计积分
    let cumulative = 0;
    const cumulativePoints = [];
    
    sortedDates.forEach(date => {
        cumulative += dailyPoints[date];
        cumulativePoints.push(cumulative);
    });
    
    // 只显示最近15天的数据
    const labels = sortedDates.slice(-15);
    const data = cumulativePoints.slice(-15);
    
    // 绘制图表
    const ctx = document.getElementById('points-trend-chart').getContext('2d');
    
    // 如果已经有图表，销毁它
    if (window.pointsChart) {
        window.pointsChart.destroy();
    }
    
    window.pointsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '班级总积分',
                data: data,
                backgroundColor: 'rgba(255, 133, 162, 0.2)',
                borderColor: 'rgba(255, 133, 162, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(255, 133, 162, 1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].label);
                            return date.toLocaleDateString('zh-CN');
                        }
                    }
                }
            }
        }
    });
}

// 初始化系统设置页面
function initSettingsPage() {
    // 辅助函数，用于安全地移除并重新绑定监听器
    function rebindListener(elementId, eventType, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            const newElement = element.cloneNode(true); // 克隆元素
            if (element.parentNode) {
                element.parentNode.replaceChild(newElement, element); // 替换旧元素以移除监听器
            }
            newElement.addEventListener(eventType, handler); // 在新元素上添加监听器
            return newElement; // 返回新元素以便进一步操作（如果需要）
        } else {
            console.warn(`Element with ID '${elementId}' not found. Cannot bind listener.`);
            return null;
        }
    }

    // 备份数据按钮
    rebindListener('backup-data-btn', 'click', () => {
        console.log("正在备份数据，先进行存储优化...");
        optimizePointLogsStorage(); // 确保这个函数是定义好的
        setTimeout(() => {
            console.log("存储优化完成，开始备份数据...");
            const backupData = backupAllData(); // 确保这个函数是定义好的
            if (backupData && backupData.pointLogs && backupData.students) {
                console.log(`备份数据包含 ${backupData.pointLogs.length} 条积分记录, ${backupData.students.length} 名学生`);
            }
        }, 300);
    });

    // 恢复数据按钮
    rebindListener('restore-data-btn', 'click', () => {
        const restoreModal = document.getElementById('restore-modal');
        if (restoreModal) restoreModal.classList.remove('hidden');
        updateInternalBackupInfo(); // 确保这个函数是定义好的
    });

    // 清除数据按钮
    rebindListener('clear-data-btn', 'click', function simplifiedClearDataHandler() {
        showConfirm('确定要清除所有数据吗？此操作无法撤销！', // 确保 showConfirm 是定义好的
            function() { // Yes callback
                console.log("用户确认清除所有数据");
                window._systemReset = true;
                window._processingImport = false;
                window._cachedStudents = [];
                window._cachedGroups = [];
                clearAllData(); // 确保这个函数是定义好的
                showAlert('所有数据已清除', function() { // 确保 showAlert 是定义好的
                    if (typeof setupImportExportListeners === 'function') {
                        setupImportExportListeners();
                    }
                    const fileInput = document.getElementById('import-file');
                    if (fileInput) fileInput.value = '';
                });
            }
            // 不需要 cancelCallback 来重新添加监听器，因为 rebindListener 已经处理了
        );
    });

    // 恢复模态框取消按钮
    rebindListener('restore-modal-cancel', 'click', () => {
        const restoreModal = document.getElementById('restore-modal');
        if (restoreModal) restoreModal.classList.add('hidden');
    });

    // 从文件恢复按钮
    rebindListener('restore-modal-submit', 'click', () => {
        const fileInput = document.getElementById('restore-file');
        if (!fileInput || fileInput.files.length === 0) {
            showAlert('请选择备份文件');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonData = e.target.result;
                if (!jsonData || !jsonData.trim()) {
                    showAlert('备份文件内容为空');
                    return;
                }
                let parsedData;
                try {
                    parsedData = JSON.parse(jsonData);
                } catch (parseError) {
                    showAlert(`备份文件不是有效的JSON格式: ${parseError.message}`);
                    return;
                }
                if (!parsedData || typeof parsedData !== 'object') {
                    showAlert('备份文件格式不正确：不是有效的对象结构');
                    return;
                }

                const result = restoreData(jsonData); // 确保 restoreData 是定义好的
                if (result) {
                    const restoreModal = document.getElementById('restore-modal');
                    if (restoreModal) restoreModal.classList.add('hidden');
                    fileInput.value = ''; // 清空文件输入
                }
            } catch (error) {
                showAlert(`文件处理出错：${error.message}`);
            }
        };
        reader.onerror = () => {
            showAlert('读取文件失败，请检查文件格式或大小');
        };
        reader.readAsText(file);
    });

    // 从内部备份恢复按钮
    rebindListener('restore-internal-btn', 'click', () => {
        showConfirm('确定要从内部备份恢复数据吗？这将覆盖当前的所有数据。',
            function() {
                const result = restoreFromInternalBackup(); // 确保这个函数是定义好的
                if (result) {
                    const restoreModal = document.getElementById('restore-modal');
                    if (restoreModal) restoreModal.classList.add('hidden');
                }
            }
        );
    });

    // 添加运行存储优化功能
    rebindListener('optimize-storage-btn', 'click', () => {
        optimizePointLogsStorage();
        const storageInfo = loadData('app_storage_info', {}); // 确保 loadData 是定义好的
        const usage = getLocalStorageUsage(); // 确保 getLocalStorageUsage 是定义好的
        showAlert(`存储优化完成！\n\n` +
              `主存储记录数: ${storageInfo.mainRecords || 0}\n` +
              `归档月份数: ${(storageInfo.archivedMonths || []).length}\n` +
              `总记录数: ${storageInfo.totalRecords || 0}\n` +
              `当前存储使用: ${usage.totalMB} MB (${usage.percentUsed}%)`);
    });
    
    updateSettingsForm(); // 确保这个函数是定义好的
}

// 更新设置表单
function updateSettingsForm() {
    // 获取当前设置
    const settings = loadData('app_settings', {
        backupReminder: {
            enabled: true,
            dayInterval: 7
        },
        storageOptimization: {
            enabled: true,
            threshold: 70
        },
        autoBackup: {
            enabled: true,
            intervalDays: 3,
            keepOnly: 1
        }
    });
    
    // 获取存储使用情况
    const usage = getLocalStorageUsage();
    
    // 更新存储使用情况显示
    const storageUsageElement = document.getElementById('storage-usage-info');
    if (storageUsageElement) {
        storageUsageElement.innerHTML = `
            <div class="font-medium">存储空间使用情况</div>
            <div class="mt-1 text-sm">
                <div class="flex justify-between">
                    <span>已使用</span>
                    <span>${usage.totalMB} MB (${usage.percentUsed}%)</span>
                </div>
                <div class="w-full bg-neutral-dark rounded-full h-2 mt-1">
                    <div class="bg-primary h-2 rounded-full" style="width: ${Math.min(usage.percentUsed, 100)}%"></div>
                </div>
            </div>
            <div class="mt-2 text-xs text-gray-500">浏览器通常限制每个域名的存储为5MB左右</div>
        `;
    }
    
    // 更新设置表单值
    if (document.getElementById('backup-reminder-enabled')) {
        document.getElementById('backup-reminder-enabled').checked = settings.backupReminder.enabled;
    }
    
    if (document.getElementById('backup-reminder-days')) {
        document.getElementById('backup-reminder-days').value = settings.backupReminder.dayInterval;
    }
    
    if (document.getElementById('storage-optimization-enabled')) {
        document.getElementById('storage-optimization-enabled').checked = settings.storageOptimization.enabled;
    }
    
    if (document.getElementById('storage-optimization-threshold')) {
        document.getElementById('storage-optimization-threshold').value = settings.storageOptimization.threshold;
    }
    
    // 更新自动备份设置
    if (document.getElementById('auto-backup-enabled')) {
        document.getElementById('auto-backup-enabled').checked = settings.autoBackup.enabled;
    }
    
    if (document.getElementById('auto-backup-interval')) {
        document.getElementById('auto-backup-interval').value = settings.autoBackup.intervalDays;
    }
    
    if (document.getElementById('auto-backup-keep')) {
        document.getElementById('auto-backup-keep').value = settings.autoBackup.keepOnly;
    }
    
    // 绑定设置保存事件 - 使用cloneNode模式
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm && settingsForm.parentNode) {
        const newSettingsForm = settingsForm.cloneNode(true);
        settingsForm.parentNode.replaceChild(newSettingsForm, settingsForm);
        newSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
        });
    } else {
        console.warn('settings-form not found or has no parent, cannot rebind submit listener.');
    }
}

// 更新内部备份信息
function updateInternalBackupInfo() {
    const infoElement = document.getElementById('internal-backup-info');
    const lastInternalBackup = loadData('app_lastInternalBackup', null);
    const restoreButton = document.getElementById('restore-internal-btn');
    
    if (!lastInternalBackup) {
        infoElement.textContent = '没有可用的自动内部备份。';
        restoreButton.disabled = true;
        restoreButton.classList.add('opacity-50');
        return;
    }
    
    try {
        // 检查内部备份是否存在
        const backupData = localStorage.getItem('app_internal_backup');
        if (!backupData) {
            infoElement.textContent = '找不到内部备份数据。';
            restoreButton.disabled = true;
            restoreButton.classList.add('opacity-50');
            return;
        }
        
        // 解析备份数据以获取更多信息
        const backup = JSON.parse(backupData);
        const backupDate = formatDate(backup.timestamp);
        const studentsCount = backup.students ? backup.students.length : 0;
        const pointLogsCount = backup.pointLogs ? backup.pointLogs.length : 0;
        
        infoElement.innerHTML = `
            <div>最近内部备份: ${backupDate}</div>
            <div class="text-xs text-gray-500 mt-1">
                包含 ${studentsCount} 名学生, ${pointLogsCount} 条积分记录
            </div>
        `;
        
        restoreButton.disabled = false;
        restoreButton.classList.remove('opacity-50');
    } catch (error) {
        console.error('检查内部备份出错:', error);
        infoElement.textContent = '检查内部备份时出错: ' + error.message;
        restoreButton.disabled = true;
        restoreButton.classList.add('opacity-50');
    }
}

// 清除所有数据
function clearAllData() {
    console.log("开始执行数据清除...");
    // 确保记录清除操作的结果直接清除所有本地存储数据，而不仅仅是删除特定的键
    try {
        // 先创建一个清空标志，并立即写入localStorage
        localStorage.setItem('app_system_reset', new Date().toISOString());
        console.log("已设置系统重置标记");
        
        // 清除内存缓存变量 - 这非常重要，确保内存中的数据也被清除
        window._cachedStudents = [];
        window._cachedGroups = [];
        
        // 先清除所有应用数据键
        localStorage.removeItem('app_students');
        localStorage.removeItem('app_groups');
        localStorage.removeItem('app_pointRules');
        localStorage.removeItem('app_pointLogs');
        localStorage.removeItem('app_rewards');
        localStorage.removeItem('app_exchanges');
        localStorage.removeItem('app_settings');
        localStorage.removeItem('app_storage_info');
        localStorage.removeItem('app_internal_backup');
        localStorage.removeItem('app_lastBackup');
        localStorage.removeItem('app_lastInternalBackup');
        
        // 额外清除所有可能的归档月份数据
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('app_pointLogs_')) {
                keysToRemove.push(key);
            }
        }
        
        // 单独处理删除，避免在循环中修改集合导致问题
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log("数据清除完成，共清除" + (12 + keysToRemove.length) + "个存储项");
    } catch (e) {
        console.error("清除数据出错:", e);
    }
    
    // 重置所有页面初始化状态
    for (let key in initializedPages) {
        initializedPages[key] = false;
    }
    
    // 隐藏所有页面（除了首页）
    const pages = document.querySelectorAll('#content-container > div');
    pages.forEach(page => {
        if (page.id !== 'welcome-page') {
            page.classList.add('hidden');
        }
    });
    
    // 显示首页
    const welcomePage = document.getElementById('welcome-page');
    if (welcomePage) {
        welcomePage.classList.remove('hidden');
    }
    
    // 清除导航按钮激活状态
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(button => {
        button.classList.remove('btn-nav-active');
    });
    
    // 重新初始化数据和首页
    initializeData();
    initWelcomePage();
    
    // 刷新所有视图
    refreshAllMainViews();
    
    // 使用location.reload()强制刷新页面更好，但函数调用可能不需要，由调用者决定
}

// 检查备份状态并提醒
function checkBackupStatus() {
    // 首先检查是否有学生数据，如果没有则不需要提醒备份
    const students = loadData('app_students', []);
    if (students.length === 0) {
        console.log('没有学生数据，无需备份提醒');
        return false;
    }
    
    // 检查上次提醒时间，避免频繁提醒
    const lastBackupReminder = loadData('app_lastBackupReminder', null);
    if (lastBackupReminder) {
        const lastReminderDate = new Date(lastBackupReminder);
        if (new Date() < lastReminderDate) {
            console.log('上次已提醒过备份，暂不再提醒');
            return false;
        }
    }
    
    const lastBackup = loadData('app_lastBackup', null);
    const lastInternalBackup = loadData('app_lastInternalBackup', null);
    const storageUsage = getLocalStorageUsage();
    
    // 获取备份设置
    const settings = loadData('app_settings', {
        backupReminder: {
            enabled: true,
            dayInterval: 7
        },
        storageOptimization: {
            enabled: true,
            threshold: 70 // 百分比
        },
        autoBackup: {
            enabled: true,
            intervalDays: 3,
            keepOnly: 1
        }
    });
    
    // 执行自动备份检查
    const autoBackupPerformed = checkAndAutoBackup();
    
    let needsBackup = false;
    let message = '';
    
    // 检查上次手动备份时间
    if (lastBackup) {
        const lastBackupDate = new Date(lastBackup);
        const daysSinceLastBackup = Math.floor((new Date() - lastBackupDate) / (1000 * 60 * 60 * 24));
        
        if (settings.backupReminder.enabled && daysSinceLastBackup >= settings.backupReminder.dayInterval) {
            needsBackup = true;
            message = `上次手动备份已经过去了 ${daysSinceLastBackup} 天，建议进行数据备份。`;
        }
        } else {
        // 从未手动备份过
        if (settings.backupReminder.enabled) {
            needsBackup = true;
            message = '您尚未进行手动备份，建议备份数据以防丢失。';
        }
    }
    
    // 检查存储占用情况
    if (settings.storageOptimization.enabled && storageUsage.percentUsed > settings.storageOptimization.threshold) {
        if (message) {
            message += '\n\n';
        }
        message += `存储空间已使用 ${storageUsage.percentUsed}%，建议备份数据并考虑清理旧数据。`;
        needsBackup = true;
    }
    
    // 添加自动备份信息
    if (lastInternalBackup && needsBackup) {
        const lastAutoBackupDate = new Date(lastInternalBackup);
        const formattedDate = formatDate(lastInternalBackup);
        
        message += `\n\n系统已在 ${formattedDate} 自动创建了内部备份。`;
        
        if (autoBackupPerformed) {
            message += '\n刚刚已执行新的自动备份。';
        }
    }
    
    // 如果需要备份，显示友好的提醒
    if (needsBackup) {
        // 创建一个更友好的提示框，而不是使用默认confirm
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'fixed inset-0 flex items-center justify-center z-50';
        confirmDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        confirmDiv.id = 'backup-reminder-dialog';
        
        // 对话框内容
        confirmDiv.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-medium text-gray-800 mb-4">备份提醒</h3>
                <div class="text-sm text-gray-600 mb-4">${message.replace(/\n/g, '<br>')}</div>
                <div class="flex justify-end space-x-2 mt-6">
                    <button id="backup-later-btn" 
                        class="btn btn-outline">
                        稍后备份
                    </button>
                    <button id="backup-now-btn" 
                        class="btn btn-primary">
                        立即备份
                    </button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(confirmDiv);
        
        // 绑定按钮事件
        document.getElementById('backup-now-btn').addEventListener('click', function() {
            document.body.removeChild(confirmDiv);
            backupAllData();
        });
        
        document.getElementById('backup-later-btn').addEventListener('click', function() {
            document.body.removeChild(confirmDiv);
            // 用户选择稍后备份，更新上次提醒时间以避免频繁提醒
            const nextReminderDate = new Date();
            nextReminderDate.setDate(nextReminderDate.getDate() + 1); // 至少等1天再提醒
            saveData('app_lastBackupReminder', nextReminderDate.toISOString());
        });
    }
    
    // 如果需要优化存储，自动执行
    if (settings.storageOptimization.enabled) {
        const pointLogs = loadData('app_pointLogs', []);
        if (pointLogs.length > 100) {
            optimizePointLogsStorage();
        }
    }
    
    return needsBackup;
}

// 保存设置
function saveSettings() {
    const settings = {
        backupReminder: {
            enabled: document.getElementById('backup-reminder-enabled').checked,
            dayInterval: parseInt(document.getElementById('backup-reminder-days').value) || 7
        },
        storageOptimization: {
            enabled: document.getElementById('storage-optimization-enabled').checked,
            threshold: parseInt(document.getElementById('storage-optimization-threshold').value) || 70
        },
        autoBackup: {
            enabled: document.getElementById('auto-backup-enabled').checked,
            intervalDays: parseInt(document.getElementById('auto-backup-interval').value) || 3,
            keepOnly: parseInt(document.getElementById('auto-backup-keep').value) || 1
        }
    };
    
    // 保存设置
    saveData('app_settings', settings);
    
    showAlert('设置已保存');
    
    // 刷新所有视图
    refreshAllMainViews();
}

// 执行自动内部备份
function createInternalBackup() {
    // 获取完整积分记录（包括归档数据）
    const allPointLogs = loadAllPointLogs();
    
    // 创建完整备份数据
    const backupData = {
        students: loadData('app_students'),
        groups: loadData('app_groups'),
        pointRules: loadData('app_pointRules'),
        pointLogs: allPointLogs,
        rewards: loadData('app_rewards'),
        exchanges: loadData('app_exchanges'),
        settings: loadData('app_settings'),
        storageInfo: loadData('app_storage_info'),
        timestamp: new Date().toISOString()
    };
    
    // 保存到内部备份键
    try {
        localStorage.setItem('app_internal_backup', JSON.stringify(backupData));
        saveData('app_lastInternalBackup', new Date().toISOString());
        console.log('自动内部备份已完成', new Date().toISOString());
        return true;
    } catch (error) {
        console.error('自动内部备份失败:', error);
        // 如果失败，尝试运行存储优化然后重试
        try {
            optimizePointLogsStorage();
            localStorage.setItem('app_internal_backup', JSON.stringify(backupData));
            saveData('app_lastInternalBackup', new Date().toISOString());
            console.log('优化后自动内部备份已完成', new Date().toISOString());
            return true;
        } catch (retryError) {
            console.error('优化后自动内部备份仍然失败:', retryError);
            return false;
        }
    }
}

// 从内部备份恢复
function restoreFromInternalBackup() {
    try {
        const backupData = localStorage.getItem('app_internal_backup');
        if (!backupData) {
            showAlert('没有可用的内部备份');
            return false;
        }
        
        // 使用restoreData函数恢复数据
        return restoreData(backupData);
    } catch (error) {
        console.error('从内部备份恢复失败:', error);
        showAlert('从内部备份恢复失败: ' + error.message);
        return false;
    }
    
    showAlert('从内部备份恢复成功');
    
    // 刷新首页和所有视图
    initializePages();
    refreshAllMainViews();
    
    return true;
}

// 检查并执行自动备份
function checkAndAutoBackup() {
    // 首先检查是否有学生数据，如果没有则不需要自动备份
    const students = loadData('app_students', []);
    if (students.length === 0) {
        console.log('没有学生数据，无需自动备份');
        return false;
    }
    
    // 获取备份设置
    const settings = loadData('app_settings', {
        autoBackup: {
            enabled: true,
            intervalDays: 3, // 默认3天
            keepOnly: 1  // 默认只保留最新的1个备份
        }
    });
    
    // 如果自动备份未启用，直接返回
    if (!settings.autoBackup || !settings.autoBackup.enabled) {
        return false;
    }
    
    // 获取上次自动备份时间
    const lastInternalBackup = loadData('app_lastInternalBackup', null);
    
    // 检查是否需要执行自动备份
    let needsBackup = false;
    
    if (!lastInternalBackup) {
        // 从未备份过，需要备份
        needsBackup = true;
    } else {
        // 检查是否已超过备份间隔
        const lastBackupDate = new Date(lastInternalBackup);
        const daysSinceLastBackup = Math.floor((new Date() - lastBackupDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastBackup >= (settings.autoBackup.intervalDays || 3)) {
            needsBackup = true;
        }
    }
    
    // 如果需要备份，执行自动备份
    if (needsBackup) {
        console.log('执行自动内部备份...');
        return createInternalBackup();
    }
    
    return false;
}

// 初始化学生积分表格
function initStudentPointsTable() {
    const tableBody = document.getElementById('student-points-table');
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    
    // 先检查是否处于规则选择模式，如果是则先保存状态
    const isInSelectionMode = !!window._selectedRuleId;
    const selectedRuleId = window._selectedRuleId;
    
    // 清除表格上的事件监听器，使用克隆节点替换的方式
    const oldTableBody = tableBody.cloneNode(false);
    if (tableBody.parentNode) {
        tableBody.parentNode.replaceChild(oldTableBody, tableBody);
    }
    
    // 重新获取表格主体引用
    const newTableBody = document.getElementById('student-points-table');
    
    // 清空表格
    newTableBody.innerHTML = '';
    
    if (students.length === 0) {
        newTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">暂无学生，请添加学生</td></tr>';
        return;
    }
    
    // 创建学生行
    students.forEach(student => {
        const groupName = student.groupId 
            ? groups.find(g => g.id === student.groupId)?.name || '未分组' 
            : '未分组';
        
        const totalPoints = student.totalPoints || 0;
        const pointsClass = totalPoints >= 0 ? 'text-green-600' : 'text-red-600';
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-neutral transition-colors';
        
        // 如果在规则选择模式，则添加特殊样式
        if (isInSelectionMode) {
            row.classList.add('cursor-pointer', 'bg-yellow-50');
        }
        
        row.innerHTML = `
            <td class="px-4 py-3">
                <div class="font-medium">${student.name}</div>
            </td>
            <td class="px-4 py-3 text-gray-600">${student.studentId}</td>
            <td class="px-4 py-3 text-gray-600">${groupName}</td>
            <td class="px-4 py-3 text-center">
                <span class="${pointsClass} font-medium">${totalPoints}</span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button class="quick-minus-btn bg-red-100 text-red-500 rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-200" data-id="${student.id}">
                        <i class="material-icons" style="font-size: 16px;">remove</i>
                    </button>
                    <button class="quick-add-btn bg-green-100 text-green-500 rounded-full w-7 h-7 flex items-center justify-center hover:bg-green-200" data-id="${student.id}">
                        <i class="material-icons" style="font-size: 16px;">add</i>
                    </button>
                </div>
            </td>
            <td class="px-4 py-3 text-right">
                <button class="custom-point-btn bg-primary text-white px-2 py-1 rounded hover:bg-primary-dark transition-colors" data-id="${student.id}">
                    详细操作
                </button>
            </td>
        `;
        newTableBody.appendChild(row);
    });
    
    // 创建新的事件处理函数
    const handleTableClick = function(e) {
        // 如果正在处理点击，则忽略
        if (window._processingTableClick) return;
        window._processingTableClick = true;

        try {
            // 首先检查是否有选择规则模式
            const hasActiveRule = document.querySelector('.rule-quick-btn.ring-2.ring-primary');
            
            // 如果在规则选择模式下
            if (hasActiveRule) {
                if (e.target.closest('tr') && e.target.closest('tr').classList.contains('cursor-pointer')) {
                    const detailBtn = e.target.closest('tr').querySelector('.custom-point-btn');
                    if (detailBtn) {
                        const studentId = detailBtn.getAttribute('data-id');
                        if (studentId && window._selectedRuleId) {
                            applyRuleToStudent(studentId, window._selectedRuleId);
                            cancelStudentSelectionMode();
                        }
                    }
                }
            } else {
                // 处理快速加减分和详细操作按钮
                if (e.target.closest('.quick-minus-btn')) {
                    const btn = e.target.closest('.quick-minus-btn');
                    const studentId = btn.getAttribute('data-id');
                    quickAddPoints(studentId, -1);
                } else if (e.target.closest('.quick-add-btn')) {
                    const btn = e.target.closest('.quick-add-btn');
                    const studentId = btn.getAttribute('data-id');
                    quickAddPoints(studentId, 1);
                } else if (e.target.closest('.custom-point-btn')) {
                    const btn = e.target.closest('.custom-point-btn');
                    const studentId = btn.getAttribute('data-id');
                    openQuickPointModal(studentId);
                }
            }
        } finally {
            // 重置处理标志
            setTimeout(() => {
                window._processingTableClick = false;
            }, 300);
        }
    };

    // 移除旧的事件监听器
    if (window._currentTableClickHandler) {
        newTableBody.removeEventListener('click', window._currentTableClickHandler);
    }

    // 保存新的事件处理器引用并添加监听器
    window._currentTableClickHandler = handleTableClick;
    newTableBody.addEventListener('click', handleTableClick);
    
    // 始终清除并重新绑定行点击事件
    // 移除之前可能存在的学生行点击事件监听器
    if (window._studentRowClickHandler) {
        newTableBody.removeEventListener('click', window._studentRowClickHandler);
    }
    
    // 创建或更新学生行点击事件处理函数
    window._studentRowClickHandler = function(e) {
        // 只有在规则选择模式才处理点击
        if (!window._selectedRuleId) return;
        
        // 如果正在处理点击，则忽略
        if (window._processingStudentClick) return;
        
        // 设置处理中标志
        window._processingStudentClick = true;
        
        // 找到被点击的行
        const row = e.target.closest('tr');
        if (!row || !row.classList.contains('cursor-pointer')) {
            window._processingStudentClick = false;
            return;
        }
        
        // 找到学生ID
        const detailBtn = row.querySelector('.custom-point-btn');
        if (!detailBtn) {
            window._processingStudentClick = false;
            return;
        }
        
        const studentId = detailBtn.getAttribute('data-id');
        if (!studentId) {
            window._processingStudentClick = false;
            return;
        }
        
        // 保存当前选中的规则ID（可能在处理过程中被修改）
        const currentRuleId = window._selectedRuleId;
        
        // 使用延时来处理，避免事件冒泡问题
        setTimeout(() => {
            // 应用规则到学生
            applyRuleToStudent(studentId, currentRuleId);
            
            // 取消选择模式
            cancelStudentSelectionMode();
            
            // 重置处理标志
            window._processingStudentClick = false;
        }, 10);
    };
    
    // 添加事件监听器
    newTableBody.addEventListener('click', window._studentRowClickHandler);
    
    // 特别处理：如果处于规则选择模式，需要高亮行
    if (isInSelectionMode && selectedRuleId) {
        // 重新应用选中规则视觉提示
        document.querySelectorAll('.rule-quick-btn').forEach(btn => {
            if (btn.getAttribute('data-rule-id') === selectedRuleId) {
                btn.classList.add('ring-2', 'ring-primary');
            }
        });
        
        // 显示取消选择按钮
        const cancelBtn = document.getElementById('cancel-rule-selection');
        if (cancelBtn) {
            cancelBtn.classList.remove('hidden');
        }
    }
}

// 初始化快速积分规则按钮
function initQuickRuleButtons() {
    const container = document.getElementById('quick-rule-buttons');
    const rules = loadData('app_pointRules');
    
    // 移除容器上可能存在的点击事件监听器
    const oldContainer = container.cloneNode(false);
    if (container.parentNode) {
        container.parentNode.replaceChild(oldContainer, container);
    }
    
    // 重新获取容器引用
    const newContainer = document.getElementById('quick-rule-buttons');
    
    // 清空容器
    newContainer.innerHTML = '';
    
    if (rules.length === 0) {
        newContainer.innerHTML = '<div class="text-center w-full py-2 text-gray-500">暂无积分规则</div>';
        return;
    }
    
    // 只显示常用的几个规则（最多6个），并过滤掉"快速操作"规则
    const displayRules = rules.filter(r => r.name !== '快速操作').slice(0, 6);
    
    displayRules.forEach(rule => {
        const pointsValue = parseInt(rule.points);
        const btnClass = pointsValue >= 0 ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200';
        const pointsSign = pointsValue >= 0 ? '+' : '';
        
        const btn = document.createElement('button');
        btn.className = `rule-quick-btn px-3 py-1 rounded-full text-sm ${btnClass}`;
        btn.setAttribute('data-rule-id', rule.id);
        btn.setAttribute('data-points', rule.points);
        btn.innerHTML = `${rule.name} (${pointsSign}${rule.points})`;
        
        newContainer.appendChild(btn);
    });
    
    // 如果有更多规则，添加"更多"按钮
    if (rules.length > 6) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-gray-200';
        moreBtn.id = 'more-rules-btn';
        moreBtn.textContent = '更多...';
        newContainer.appendChild(moreBtn);
        
        // 绑定"更多"按钮事件
        moreBtn.addEventListener('click', (e) => {
            // 阻止事件冒泡，避免触发规则按钮的委托事件
            e.stopPropagation();
            
            showPage('points-page');
            if (!initializedPages['points-page']) {
                initPageOnDemand('points-page');
                initializedPages['points-page'] = true;
            }
        });
    }
    
    // 在初始化后重置任何可能存在的规则选择状态
    window._selectedRuleId = null;
}

// 加载最近积分记录
function loadRecentPointsLogs() {
    const logsContainer = document.getElementById('recent-points-logs');
    const pointLogs = loadData('app_pointLogs');
    const students = loadData('app_students');
    const rules = loadData('app_pointRules');
    
    // 清空容器
    logsContainer.innerHTML = '';
    
    if (pointLogs.length === 0) {
        logsContainer.innerHTML = '<div class="text-center py-4 text-gray-500">暂无积分记录</div>';
        return;
    }
    
    // 只显示最近的10条记录
    const recentLogs = [...pointLogs].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    ).slice(0, 10);
    
    // 创建积分记录项
    recentLogs.forEach(log => {
        const student = students.find(s => s.id === log.studentId);
        const rule = rules.find(r => r.id === log.pointRuleId);
        
        if (!student || !rule) return;
        
        const logItem = document.createElement('div');
        const pointsClass = parseInt(log.points) >= 0 ? 'text-green-500' : 'text-red-500';
        const pointsSign = parseInt(log.points) >= 0 ? '+' : '';
        
        logItem.className = 'py-2 border-b border-neutral-dark last:border-b-0';
        logItem.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-medium text-gray-800">${student.name}</span>
                    <span class="${pointsClass} font-medium ml-2">${pointsSign}${log.points}</span>
                </div>
                <span class="text-xs text-gray-500">${formatDate(log.createdAt)}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-sm text-gray-600">${rule.name}</span>
                ${log.reason ? `<span class="text-xs text-gray-500">备注: ${log.reason}</span>` : ''}
            </div>
        `;
        logsContainer.appendChild(logItem);
    });
}

// 设置首页事件监听器
function setupWelcomePageListeners() {
    // 学生搜索功能
    const searchInput = document.getElementById('quick-student-search');
    if (searchInput) {
        // 先移除可能的旧事件监听器
        searchInput.removeEventListener('input', handleSearchInput);
        // 添加新的事件监听器
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    // 学生搜索输入框处理函数
    function handleSearchInput() {
        const groupFilter = document.getElementById('quick-group-filter');
        filterStudentPointsTable(this.value, groupFilter ? groupFilter.value : null);
    }
    
    // 小组筛选功能
    const groupFilter = document.getElementById('quick-group-filter');
    if (groupFilter) {
        // 先填充小组选项
        populateGroupFilter();
        // 先移除可能的旧事件监听器
        groupFilter.removeEventListener('change', handleGroupFilter);
        // 添加新的事件监听器
        groupFilter.addEventListener('change', handleGroupFilter);
    }
    
    // 小组筛选处理函数
    function handleGroupFilter() {
        filterStudentPointsTable(searchInput ? searchInput.value : '', this.value);
    }
    
    // 小组积分按钮事件
    const groupPointBtn = document.getElementById('quick-group-point-btn');
    if (groupPointBtn) {
        // 先移除可能的旧事件监听器
        groupPointBtn.removeEventListener('click', handleGroupPointBtn);
        // 添加新的事件监听器
        groupPointBtn.addEventListener('click', handleGroupPointBtn);
    }
    
    // 小组积分按钮处理函数
    function handleGroupPointBtn() {
        // 打开小组积分模态框
        const groupPointModal = document.getElementById('group-point-modal');
        if (groupPointModal) {
            groupPointModal.classList.remove('hidden');
            // 确保小组和规则选项已填充
            populateGroupPointModal();
        }
    }
    
    // 小组积分模态框取消按钮
    const groupPointModalCancel = document.getElementById('group-point-modal-cancel');
    if (groupPointModalCancel) {
        // 先移除可能的旧事件监听器
        groupPointModalCancel.removeEventListener('click', handleGroupPointModalCancel);
        // 添加新的事件监听器
        groupPointModalCancel.addEventListener('click', handleGroupPointModalCancel);
    }
    
    // 小组积分模态框取消按钮处理函数
    function handleGroupPointModalCancel() {
        const groupPointModal = document.getElementById('group-point-modal');
        if (groupPointModal) {
            groupPointModal.classList.add('hidden');
        }
    }
    
    // 小组积分表单提交
    const groupPointForm = document.getElementById('group-point-form');
    if (groupPointForm) {
        // 先移除可能的旧事件监听器
        groupPointForm.removeEventListener('submit', handleGroupPointForm);
        // 添加新的事件监听器
        groupPointForm.addEventListener('submit', handleGroupPointForm);
    }
    
    // 小组积分表单提交处理函数
    function handleGroupPointForm(e) {
        e.preventDefault();
        addGroupPoints();
        const groupPointModal = document.getElementById('group-point-modal');
        if (groupPointModal) {
            groupPointModal.classList.add('hidden');
        }
    }
    
    // 为快速积分规则按钮设置全局事件处理函数（如果不存在）
    if (!window._handleRuleQuickBtnClick) {
        window._handleRuleQuickBtnClick = function(e) {
            // 检查是否已在处理中，避免重复处理
            if (window._processingRuleClick) return;
            
            if (e.target && (e.target.classList.contains('rule-quick-btn') || 
                (e.target.parentElement && e.target.parentElement.classList.contains('rule-quick-btn')))) {
                // 设置处理标志
                window._processingRuleClick = true;
                
                // 延迟处理，防止事件冒泡导致多次处理
                setTimeout(() => {
                    const button = e.target.classList.contains('rule-quick-btn') ? e.target : e.target.parentElement;
                    const ruleId = button.getAttribute('data-rule-id');
                    // 打开学生选择模式
                    selectStudentForRule(ruleId);
                    
                    // 重置处理标志
                    window._processingRuleClick = false;
                }, 10);
            }
        };
    }
    
    // 移除并重新绑定事件处理函数
    document.removeEventListener('click', window._handleRuleQuickBtnClick);
    document.addEventListener('click', window._handleRuleQuickBtnClick);
    
    // 绑定快速积分模态框事件
    const quickPointCancel = document.getElementById('quick-point-cancel');
    if (quickPointCancel) {
        // 先移除可能的旧事件监听器
        quickPointCancel.removeEventListener('click', handleQuickPointCancel);
        // 绑定新的事件监听器
        quickPointCancel.addEventListener('click', handleQuickPointCancel);
    }
    
    // 快速积分取消按钮处理函数
    function handleQuickPointCancel() {
        const quickPointModal = document.getElementById('quick-point-modal');
        if (quickPointModal) {
            quickPointModal.classList.add('hidden');
        }
    }
    
    const quickPointConfirm = document.getElementById('quick-point-confirm');
    if (quickPointConfirm) {
        // 先移除可能的旧事件监听器
        quickPointConfirm.removeEventListener('click', handleQuickPointConfirm);
        // 绑定新的事件监听器
        quickPointConfirm.addEventListener('click', handleQuickPointConfirm);
    }
    
    // 快速积分确认按钮处理函数
    function handleQuickPointConfirm() {
        applyQuickPoints();
    }
    
    // 自定义积分切换
    const quickCustomPoint = document.getElementById('quick-custom-point');
    if (quickCustomPoint) {
        // 先移除可能的旧事件监听器
        quickCustomPoint.removeEventListener('click', handleQuickCustomPoint);
        // 添加新的事件监听器
        quickCustomPoint.addEventListener('click', handleQuickCustomPoint);
    }
    
    // 自定义积分切换处理函数
    function handleQuickCustomPoint() {
        const customInput = document.getElementById('custom-point-input');
        if (customInput) {
            customInput.classList.toggle('hidden');
            const quickPointRules = document.getElementById('quick-point-rules');
            if (quickPointRules) {
                if (!customInput.classList.contains('hidden')) {
                    quickPointRules.classList.add('hidden');
                } else {
                    quickPointRules.classList.remove('hidden');
                }
            }
        }
    }
    
    // 自定义积分加减按钮
    const customPointsMinus = document.getElementById('custom-points-minus');
    if (customPointsMinus) {
        // 先移除可能的旧事件监听器
        customPointsMinus.removeEventListener('click', handleCustomPointsMinus);
        // 添加新的事件监听器
        customPointsMinus.addEventListener('click', handleCustomPointsMinus);
    }
    
    // 自定义积分减少按钮处理函数
    function handleCustomPointsMinus() {
        const input = document.getElementById('custom-points-value');
        if (input) {
            input.value = -Math.abs(parseInt(input.value) || 1);
        }
    }
    
    const customPointsPlus = document.getElementById('custom-points-plus');
    if (customPointsPlus) {
        // 先移除可能的旧事件监听器
        customPointsPlus.removeEventListener('click', handleCustomPointsPlus);
        // 添加新的事件监听器
        customPointsPlus.addEventListener('click', handleCustomPointsPlus);
    }
    
    // 自定义积分增加按钮处理函数
    function handleCustomPointsPlus() {
        const input = document.getElementById('custom-points-value');
        if (input) {
            input.value = Math.abs(parseInt(input.value) || 1);
        }
    }
}

// 小组筛选选项填充
function populateGroupFilter() {
    const groupFilter = document.getElementById('quick-group-filter');
    const groups = loadData('app_groups');
    
    // 清空现有选项（除了第一个"所有小组"）
    while (groupFilter.options.length > 1) {
        groupFilter.remove(1);
    }
    
    // 添加小组选项
    groups.forEach(group => {
        const option = new Option(group.name, group.id);
        groupFilter.add(option);
    });
}

// 筛选学生积分表格
function filterStudentPointsTable(searchTerm, groupId) {
    const tableBody = document.getElementById('student-points-table');
    const students = loadData('app_students');
    const groups = loadData('app_groups');
    
    // 清空表格
    tableBody.innerHTML = '';
    
    // 筛选学生
    let filteredStudents = students;
    
    // 根据搜索词筛选
    if (searchTerm) {
        filteredStudents = filteredStudents.filter(student => 
            student.name.includes(searchTerm) || 
            student.studentId.includes(searchTerm)
        );
    }
    
    // 根据小组筛选
    if (groupId) {
        filteredStudents = filteredStudents.filter(student => student.groupId === groupId);
    }
    
    if (filteredStudents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">未找到匹配的学生</td></tr>';
        return;
    }
    
    // 创建学生行
    filteredStudents.forEach(student => {
        const groupName = student.groupId 
            ? groups.find(g => g.id === student.groupId)?.name || '未分组' 
            : '未分组';
        
        const totalPoints = student.totalPoints || 0;
        const pointsClass = totalPoints >= 0 ? 'text-green-600' : 'text-red-600';
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-neutral transition-colors';
        row.innerHTML = `
            <td class="px-4 py-3">
                <div class="font-medium">${student.name}</div>
            </td>
            <td class="px-4 py-3 text-gray-600">${student.studentId}</td>
            <td class="px-4 py-3 text-gray-600">${groupName}</td>
            <td class="px-4 py-3 text-center">
                <span class="${pointsClass} font-medium">${totalPoints}</span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button class="quick-minus-btn bg-red-100 text-red-500 rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-200" data-id="${student.id}">
                        <i class="material-icons" style="font-size: 16px;">remove</i>
                    </button>
                    <button class="quick-add-btn bg-green-100 text-green-500 rounded-full w-7 h-7 flex items-center justify-center hover:bg-green-200" data-id="${student.id}">
                        <i class="material-icons" style="font-size: 16px;">add</i>
                    </button>
                </div>
            </td>
            <td class="px-4 py-3 text-right">
                <button class="custom-point-btn bg-primary text-white px-2 py-1 rounded hover:bg-primary-dark transition-colors" data-id="${student.id}">
                    详细操作
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // 使用事件委托绑定按钮事件，避免重复绑定
    // 先移除之前的事件监听器
    tableBody.removeEventListener('click', handleTableButtonsClick);
    // 添加新的事件监听器
    tableBody.addEventListener('click', handleTableButtonsClick);
    
    // 表格按钮点击处理函数
    function handleTableButtonsClick(e) {
        // 首先检查是否有选择规则模式
        const hasActiveRule = document.querySelector('.rule-quick-btn.ring-2.ring-primary');
        
        // 减分按钮
        if (!hasActiveRule && e.target.closest('.quick-minus-btn')) {
            const btn = e.target.closest('.quick-minus-btn');
            const studentId = btn.getAttribute('data-id');
            quickAddPoints(studentId, -1);
            return;
        }
        
        // 加分按钮
        if (!hasActiveRule && e.target.closest('.quick-add-btn')) {
            const btn = e.target.closest('.quick-add-btn');
            const studentId = btn.getAttribute('data-id');
            quickAddPoints(studentId, 1);
            return;
        }
        
        // 详细操作按钮
        if (!hasActiveRule && e.target.closest('.custom-point-btn')) {
            const btn = e.target.closest('.custom-point-btn');
            const studentId = btn.getAttribute('data-id');
            openQuickPointModal(studentId);
            return;
        }
    }
}

// 为学生快速加减分（不需要选择积分规则，使用"快速操作"规则）
function quickAddPoints(studentId, points) {
    // 防止重复处理
    if (window._processingQuickPoints) return;
    window._processingQuickPoints = true;

    try {
        const students = loadData('app_students');
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            showAlert('找不到该学生');
            return;
        }
        
        // 获取或创建"快速操作"积分规则
        let quickRule = null;
        const rules = loadData('app_pointRules');
        quickRule = rules.find(r => r.name === '快速操作');
        
        if (!quickRule) {
            // 创建快速操作规则
            const now = new Date().toISOString();
            quickRule = {
                id: generateId(),
                name: '快速操作',
                points: 0, // 这个值会在记录时被覆盖
                description: '快速加减分操作',
                createdAt: now,
                updatedAt: now
            };
            rules.push(quickRule);
            saveData('app_pointRules', rules);
        }
        
        // 创建积分记录
        const pointLogs = loadData('app_pointLogs');
        const now = new Date().toISOString();
        
        const newLog = {
            id: generateId(),
            studentId: studentId,
            pointRuleId: quickRule.id,
            points: points,
            reason: points > 0 ? '快速加分' : '快速减分',
            createdAt: now
        };
        
        pointLogs.push(newLog);
        
        // 更新学生总积分
        const studentIndex = students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            students[studentIndex].totalPoints = (students[studentIndex].totalPoints || 0) + points;
        }
        
        // 保存到localStorage
        saveData('app_pointLogs', pointLogs);
        saveData('app_students', students);
        
        // 只更新当前学生的积分显示，而不是刷新整个表格
        updateStudentPointsInTable(studentId);
        
        // 刷新积分记录和仪表盘统计
        loadRecentPointsLogs();
        updateDashboardStats();
    } catch (error) {
        console.error('快速加减分出错:', error);
        showAlert('操作失败，请重试');
    } finally {
        // 重置处理标志
        setTimeout(() => {
            window._processingQuickPoints = false;
        }, 300); // 添加延迟以防止快速连续点击
    }
}

// 进入规则选择学生模式
function selectStudentForRule(ruleId) {
    // 如果已经在选择学生模式，先取消当前模式
    if (window._selectedRuleId) {
        // 已经有一个规则被选中，我们需要先取消它
        cancelStudentSelectionMode();
    }
    
    const rules = loadData('app_pointRules');
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
        showAlert('找不到该积分规则');
        return;
    }
    
    // 保存当前选中的规则ID
    window._selectedRuleId = ruleId;
    window._selectedRuleName = rule.name;
    window._selectedRulePoints = rule.points;
    
    // 高亮显示选中的规则按钮
    document.querySelectorAll('.rule-quick-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-primary');
        if (btn.getAttribute('data-rule-id') === ruleId) {
            btn.classList.add('ring-2', 'ring-primary');
        }
    });
    
    // 显示取消选择按钮
    const cancelBtn = document.getElementById('cancel-rule-selection');
    if (cancelBtn) {
        cancelBtn.classList.remove('hidden');
        
        // 移除可能存在的点击事件处理器
        const newCancelBtn = cancelBtn.cloneNode(true);
        if (cancelBtn.parentNode) {
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        }
        
        // 绑定新的点击事件
        document.getElementById('cancel-rule-selection').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            cancelStudentSelectionMode();
        });
    }
    
    // 提示用户选择学生
    showAlert(`已选择"${rule.name}"规则，请在下方列表中点击要操作的学生`);
    
    // 获取学生表体
    const tableBody = document.getElementById('student-points-table');
    if (!tableBody) {
        showAlert('找不到学生列表');
        return;
    }
    
    // 为每个学生行添加可点击样式
    const tableRows = tableBody.querySelectorAll('tr');
    tableRows.forEach(row => {
        // 找到详细操作按钮，获取学生ID
        const detailBtn = row.querySelector('.custom-point-btn');
        if (!detailBtn) return;
        
        // 修改行样式为可点击
        row.classList.add('cursor-pointer', 'bg-yellow-50');
    });
    
    // 移除之前可能存在的事件监听器
    if (window._studentRowClickHandler) {
        tableBody.removeEventListener('click', window._studentRowClickHandler);
    }
    
    // 创建新的事件处理函数
    window._studentRowClickHandler = function(e) {
        // 如果没有选中规则或者正在处理中，则忽略点击
        if (!window._selectedRuleId || window._processingStudentClick) return;
        
        // 设置处理中标志
        window._processingStudentClick = true;
        
        // 找到被点击的行
        const row = e.target.closest('tr');
        if (!row) {
            window._processingStudentClick = false;
            return;
        }
        
        // 如果行没有标记为可点击状态，则忽略
        if (!row.classList.contains('cursor-pointer')) {
            window._processingStudentClick = false;
            return;
        }
        
        // 找到学生ID
        const detailBtn = row.querySelector('.custom-point-btn');
        if (!detailBtn) {
            window._processingStudentClick = false;
            return;
        }
        
        const studentId = detailBtn.getAttribute('data-id');
        if (!studentId) {
            window._processingStudentClick = false;
            return;
        }
        
        // 延迟处理，避免事件冒泡和重复处理
        setTimeout(() => {
            // 应用规则到学生
            applyRuleToStudent(studentId, window._selectedRuleId);
            
            // 取消选择模式
            cancelStudentSelectionMode();
            
            // 重置处理标志
            window._processingStudentClick = false;
        }, 50);
    };
    
    // 添加事件监听器
    tableBody.addEventListener('click', window._studentRowClickHandler);
}

// 取消学生选择模式
function cancelStudentSelectionMode() {
    // 防止重复调用
    if (window._processingCancelSelection) {
        return;
    }
    
    // 设置处理标志
    window._processingCancelSelection = true;
    
    console.log("取消学生选择模式");
    
    try {
        // 移除规则按钮高亮
        document.querySelectorAll('.rule-quick-btn').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-primary');
        });
        
        // 移除学生行的可点击样式
        const tableRows = document.querySelectorAll('#student-points-table tr');
        tableRows.forEach(row => {
            row.classList.remove('cursor-pointer', 'bg-yellow-50');
        });
        
        // 隐藏取消选择按钮
        const cancelBtn = document.getElementById('cancel-rule-selection');
        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }
        
        // 重置所有选择状态
        window._selectedRuleId = null;
        window._selectedRuleName = null;
        window._selectedRulePoints = null;
        window._processingStudentClick = false;
        
    } catch (error) {
        console.error("取消学生选择模式时出错:", error);
    } finally {
        // 重置处理标志
        setTimeout(function() {
            window._processingCancelSelection = false;
        }, 100);
    }
}

// 将规则应用于学生
function applyRuleToStudent(studentId, ruleId) {
    // 防止重复调用，设置防抖标志
    if (window._processingRuleApplication) {
        console.log("正在处理规则应用，忽略重复调用");
        return;
    }
    
    // 设置处理中标志
    window._processingRuleApplication = true;
    
    // 使用规则ID获取规则信息 - 优先使用缓存的规则信息
    const students = loadData('app_students');
    
    // 查找学生
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showAlert('找不到该学生');
        window._processingRuleApplication = false;
        return;
    }
    
    // 如果已有缓存的规则名称和分数，则使用缓存值
    let rule = null;
    let pointsValue = 0;
    let ruleName = '';
    
    if (window._selectedRuleName && ruleId === window._selectedRuleId) {
        // 使用缓存的规则信息
        pointsValue = parseInt(window._selectedRulePoints);
        ruleName = window._selectedRuleName;
    } else {
        // 从数据库中读取规则信息
        const rules = loadData('app_pointRules');
        rule = rules.find(r => r.id === ruleId);
        
        if (!rule) {
            showAlert('找不到该积分规则');
            window._processingRuleApplication = false;
            return;
        }
        
        pointsValue = parseInt(rule.points);
        ruleName = rule.name;
    }
    
    try {
        // 创建积分记录
        const pointLogs = loadData('app_pointLogs');
        const now = new Date().toISOString();
        
        const newLog = {
            id: generateId(),
            studentId: studentId,
            pointRuleId: ruleId,
            points: pointsValue,
            reason: '',
            createdAt: now
        };
        
        pointLogs.push(newLog);
        
        // 更新学生总积分
        const studentIndex = students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
            students[studentIndex].totalPoints = (students[studentIndex].totalPoints || 0) + pointsValue;
        }
        
        // 保存到localStorage
        saveData('app_pointLogs', pointLogs);
        saveData('app_students', students);
        
        // 只更新当前学生的积分显示，而不是刷新整个表格
        updateStudentPointsInTable(studentId);
        
        // 刷新积分记录和仪表盘统计
        loadRecentPointsLogs();
        updateDashboardStats();
        
        // 提示用户
        const pointsSign = pointsValue >= 0 ? '+' : '';
        showAlert(`已为学生"${student.name}"${pointsValue >= 0 ? '增加' : '扣除'}积分: ${ruleName} (${pointsSign}${pointsValue})`);
    } catch (error) {
        console.error("应用规则时出错:", error);
        showAlert('应用规则时出错，请刷新页面后重试');
    } finally {
        // 确保在处理完成后重置状态标志
        setTimeout(function() {
            window._processingRuleApplication = false;
            
            // 清除缓存的规则信息
            if (window._selectedRuleId === ruleId) {
                window._selectedRuleId = null;
                window._selectedRuleName = null;
                window._selectedRulePoints = null;
            }
        }, 300); // 添加小延迟防止快速连续点击
    }
}

// 打开快速积分操作模态框
function openQuickPointModal(studentId) {
    const modal = document.getElementById('quick-point-modal');
    const students = loadData('app_students');
    const rules = loadData('app_pointRules');
    
    const student = students.find(s => s.id === studentId);
    if (!student) {
        showAlert('找不到该学生');
        return;
    }
    
    // 填充学生信息
    document.getElementById('quick-point-student-name').textContent = student.name;
    document.getElementById('quick-point-student-id').textContent = student.studentId;
    document.getElementById('quick-point-current-points').textContent = student.totalPoints || 0;
    
    // 清空积分规则选择区域
    const rulesContainer = document.getElementById('quick-point-rules');
    rulesContainer.innerHTML = '';
    
    // 填充积分规则选项
    rules.forEach(rule => {
        const pointsValue = parseInt(rule.points);
        const btnClass = pointsValue >= 0 ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200';
        const pointsSign = pointsValue >= 0 ? '+' : '';
        
        const btn = document.createElement('button');
        btn.className = `modal-rule-btn px-3 py-2 rounded border ${btnClass} text-sm`;
        btn.setAttribute('data-rule-id', rule.id);
        btn.innerHTML = `${rule.name}<br><span class="font-medium">${pointsSign}${rule.points}</span>`;
        
        rulesContainer.appendChild(btn);
    });
    
    // 绑定规则选择按钮事件（使用事件委托）
    const handleModalRuleClick = function(e) {
        if (e.target && (e.target.classList.contains('modal-rule-btn') || 
            (e.target.parentElement && e.target.parentElement.classList.contains('modal-rule-btn')))) {
            const button = e.target.classList.contains('modal-rule-btn') ? e.target : e.target.parentElement;
            
            // 移除所有按钮的选中状态
            document.querySelectorAll('.modal-rule-btn').forEach(b => b.classList.remove('ring-2', 'ring-primary'));
            // 添加当前按钮的选中状态
            button.classList.add('ring-2', 'ring-primary');
        }
    };
    
    // 先移除可能存在的事件监听器
    rulesContainer.removeEventListener('click', handleModalRuleClick);
    // 添加事件监听器到容器
    rulesContainer.addEventListener('click', handleModalRuleClick);
    
    // 重置模态框状态
    document.getElementById('custom-point-input').classList.add('hidden');
    document.getElementById('quick-point-rules').classList.remove('hidden');
    document.getElementById('custom-points-value').value = 1;
    document.getElementById('quick-point-reason').value = '';
    
    // 保存当前学生ID到模态框
    modal.setAttribute('data-student-id', studentId);
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 应用快速积分
function applyQuickPoints() {
    const modal = document.getElementById('quick-point-modal');
    const studentId = modal.getAttribute('data-student-id');
    const reason = document.getElementById('quick-point-reason').value.trim();
    
    const students = loadData('app_students');
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        showAlert('找不到该学生');
        return;
    }
    
    // 判断是使用规则还是自定义积分
    let ruleId = null;
    let points = 0;
    let ruleName = '';
    
    if (document.getElementById('custom-point-input').classList.contains('hidden')) {
        // 使用规则
        const selectedRule = document.querySelector('.modal-rule-btn.ring-2');
        if (!selectedRule) {
            showAlert('请选择积分规则或使用自定义积分');
            return;
        }
        
        ruleId = selectedRule.getAttribute('data-rule-id');
        const rules = loadData('app_pointRules');
        const rule = rules.find(r => r.id === ruleId);
        
        if (!rule) {
            showAlert('找不到该积分规则');
            return;
        }
        
        points = parseInt(rule.points);
        ruleName = rule.name;
    } else {
        // 使用自定义积分
        points = parseInt(document.getElementById('custom-points-value').value);
        
        if (isNaN(points) || points === 0) {
            showAlert('请输入有效的积分值');
            return;
        }
        
        // 获取或创建"自定义积分"规则
        let customRule = null;
        const rules = loadData('app_pointRules');
        customRule = rules.find(r => r.name === '自定义积分');
        
        if (!customRule) {
            // 创建自定义积分规则
            const now = new Date().toISOString();
            customRule = {
                id: generateId(),
                name: '自定义积分',
                points: 0, // 这个值会在记录时被覆盖
                description: '自定义加减分操作',
                createdAt: now,
                updatedAt: now
            };
            rules.push(customRule);
            saveData('app_pointRules', rules);
        }
        
        ruleId = customRule.id;
        ruleName = '自定义积分';
    }
    
    // 创建积分记录
    const pointLogs = loadData('app_pointLogs');
    const now = new Date().toISOString();
    
    const newLog = {
        id: generateId(),
        studentId: studentId,
        pointRuleId: ruleId,
        points: points,
        reason: reason,
        createdAt: now
    };
    
    pointLogs.push(newLog);
    
    // 更新学生总积分
    const studentIndex = students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
        students[studentIndex].totalPoints = (students[studentIndex].totalPoints || 0) + points;
    }
    
    // 保存到localStorage
    saveData('app_pointLogs', pointLogs);
    saveData('app_students', students);
    
    // 关闭模态框
    modal.classList.add('hidden');
    
    // 只更新当前学生的积分显示，而不是刷新整个表格
    updateStudentPointsInTable(studentId);
    
    // 刷新积分记录和仪表盘统计
    loadRecentPointsLogs();
    updateDashboardStats();
    
                            // 提示用户
                const pointsSign = points >= 0 ? '+' : '';
                showAlert(`已为学生"${student.name}"${points >= 0 ? '增加' : '扣除'}积分: ${ruleName} (${pointsSign}${points})`);
    
    // 删除自动备份代码
    // backupAllData();
}

// 填充小组积分模态框的选项
function populateGroupPointModal() {
    // 填充小组下拉选项
    const groupSelect = document.getElementById('point-group');
    const groups = loadData('app_groups');
    
    // 清空现有选项（除了第一个"选择小组"）
    while (groupSelect.options.length > 1) {
        groupSelect.remove(1);
    }
    
    // 添加小组选项
    groups.forEach(group => {
        const option = new Option(group.name, group.id);
        groupSelect.add(option);
    });
    
    // 填充规则下拉选项
    const ruleSelect = document.getElementById('group-point-rule');
    const rules = loadData('app_pointRules');
    
    // 清空现有选项（除了第一个"选择规则"）
    while (ruleSelect.options.length > 1) {
        ruleSelect.remove(1);
    }
    
    // 添加规则选项
    rules.forEach(rule => {
        const pointsSign = parseInt(rule.points) >= 0 ? '+' : '';
        const option = new Option(`${rule.name} (${pointsSign}${rule.points}分)`, rule.id);
        ruleSelect.add(option);
    });
    
    // 清空备注输入框
    document.getElementById('group-point-reason').value = '';
}

// 全局刷新所有主要视图
function refreshAllMainViews() {
    console.log("刷新所有主要视图...");
    // 首页数据刷新
    updateDashboardStats();
    initStudentPointsTable();
    loadRecentPointsLogs();
    initQuickRuleButtons();
    populateGroupFilter();
    
    // 学生管理页面刷新
    renderStudentList();
    renderGroupList();
    
    // 积分管理页面刷新
    if (typeof renderRuleList === 'function') renderRuleList();
    if (typeof renderPointLogList === 'function') renderPointLogList();
    
    // 激励兑换页面刷新
    if (typeof renderRewardList === 'function') renderRewardList();
    if (typeof renderExchangeHistory === 'function') renderExchangeHistory();
}

// 只更新表格中特定学生的积分信息
function updateStudentPointsInTable(studentId) {
    const students = loadData('app_students');
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;
    
    // 查找对应的行元素
    const row = document.querySelector(`#student-points-table .custom-point-btn[data-id="${studentId}"]`)?.closest('tr');
    if (!row) return;
    
    // 更新积分显示
    const totalPoints = student.totalPoints || 0;
    const pointsCell = row.querySelector('td:nth-child(4)');
    if (pointsCell) {
        const pointsClass = totalPoints >= 0 ? 'text-green-600' : 'text-red-600';
        pointsCell.innerHTML = `<span class="${pointsClass} font-medium">${totalPoints}</span>`;
    }
}

// 自定义Alert弹窗函数，替代原生alert
function showAlert(message, callback) {
    // 如果存在特殊标记且非导入结果提示，则不显示弹窗，避免连锁反应
    if (window._showingImportAlert === true && !window._insideImportProcess) {
        console.log("导入提示正在显示中，跳过其他弹窗显示");
        if (typeof callback === 'function') {
            setTimeout(callback, 10);
        }
        return;
    }
    
    // 如果当前已有弹窗在处理中，延迟显示以避免冲突
    if (window._processingDialog === true) {
        console.log("已有弹窗正在处理中，延迟显示新弹窗");
        setTimeout(() => showAlert(message, callback), 500);
        return;
    }
    
    // 添加时间戳防抖，避免短时间内多次调用
    const currentTime = Date.now();
    if (window._lastAlertTime && (currentTime - window._lastAlertTime < 300)) {
        console.log("弹窗调用过于频繁，合并处理");
        setTimeout(() => showAlert(message, callback), 300);
        return;
    }
    window._lastAlertTime = currentTime;
    
    // 先清除所有已存在的弹窗
    closeAllDialogs();
    
    // 标记当前正在处理弹窗
    window._processingDialog = true;
    
    // 立即处理，不使用延时
    try {
        
        // 创建弹窗容器
        const alertDiv = document.createElement('div');
        alertDiv.className = 'fixed inset-0 flex items-center justify-center z-50 alert-dialog';
        alertDiv.setAttribute('data-dialog-type', 'alert');
        alertDiv.setAttribute('data-dialog-id', currentTime.toString());
        alertDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        
        // 使用带时间戳的ID确保唯一性，避免ID冲突
        const dialogId = currentTime.toString();
        const okBtnId = 'alert-ok-btn-' + dialogId;
        
        // 弹窗内容
        alertDiv.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-medium text-gray-800 mb-4">系统提示</h3>
                <div class="text-sm text-gray-600 mb-6">${message.replace(/\n/g, '<br>')}</div>
                <div class="flex justify-end">
                    <button id="${okBtnId}" class="btn btn-primary">确定</button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(alertDiv);
        
        // 防止滚动
        document.body.style.overflow = 'hidden';
        
        // 弹窗清理函数，确保状态重置和回调执行
        const cleanupAlert = function() {
            // 先移除事件监听，防止重复触发
            if (document.getElementById(okBtnId)) {
                const okBtn = document.getElementById(okBtnId);
                okBtn.removeEventListener('click', cleanupAlert);
            }
            
            // 移除背景点击事件
            if (alertDiv) {
                alertDiv.removeEventListener('click', backgroundClickHandler);
            }
            
            // 移除弹窗元素
            if (alertDiv && alertDiv.parentNode) {
                try {
                    document.body.removeChild(alertDiv);
                } catch (e) {
                    console.error("移除Alert弹窗失败:", e);
                }
            }
            
            // 恢复页面状态
            document.body.style.overflow = '';
            window._processingDialog = false;
            
            // 执行回调，使用setTimeout确保DOM已更新
            if (typeof callback === 'function') {
                setTimeout(callback, 10);
            }
        };
        
        // 背景点击处理函数
        const backgroundClickHandler = function(e) {
            if (e.target === alertDiv) {
                cleanupAlert();
            }
        };
        
        // 绑定确定按钮事件
        const okBtn = document.getElementById(okBtnId);
        if (okBtn) {
            okBtn.addEventListener('click', cleanupAlert);
            
            // 聚焦确定按钮
            setTimeout(() => {
                try {
                    okBtn.focus();
                } catch (e) {
                    console.error("无法聚焦按钮:", e);
                }
            }, 100);
        }
        
        // 添加点击背景关闭弹窗的功能
        alertDiv.addEventListener('click', backgroundClickHandler);
        
    } catch (error) {
        console.error("显示Alert弹窗时出错:", error);
        window._processingDialog = false;
        if (typeof callback === 'function') {
            setTimeout(callback, 10);
        }
    }
}

// 关闭所有弹窗的辅助函数
function closeAllDialogs() {
    console.log("正在关闭所有已有弹窗...");
    // 关闭所有自定义弹窗，但保留系统功能模态框
    const existingAlertDialogs = document.querySelectorAll('.alert-dialog');
    const existingConfirmDialogs = document.querySelectorAll('.confirm-dialog');
    
    const dialogsToRemove = [];
    
    // 收集所有自定义警告和确认弹窗
    existingAlertDialogs.forEach(dialog => {
        if (dialog && dialog.parentNode) {
            dialogsToRemove.push(dialog);
        }
    });
    
    existingConfirmDialogs.forEach(dialog => {
        if (dialog && dialog.parentNode) {
            dialogsToRemove.push(dialog);
        }
    });
    
    console.log(`找到 ${dialogsToRemove.length} 个自定义弹窗需要移除`);
    
    if (dialogsToRemove.length === 0) {
        // 重置处理状态
        window._processingDialog = false;
        document.body.style.overflow = '';
        return;
    }
    
    // 延迟一帧后再移除，避免同时操作DOM的问题
    setTimeout(() => {
        // 依次移除收集到的弹窗
        dialogsToRemove.forEach(dialog => {
            try {
                if (dialog.parentNode === document.body) {
                    document.body.removeChild(dialog);
                } else if (dialog.parentNode) {
                    dialog.parentNode.removeChild(dialog);
                }
            } catch (e) {
                console.error("移除弹窗失败:", e);
            }
        });
        
        // 重置处理标志
        window._processingDialog = false;
        
        // 恢复滚动
        document.body.style.overflow = '';
    }, 0);
}

// 自定义Confirm弹窗函数，替代原生confirm
function showConfirm(message, confirmCallback, cancelCallback) {
    // 如果当前已有弹窗在处理中，延迟显示以避免冲突
    if (window._processingDialog === true) {
        console.log("已有弹窗正在处理中，延迟显示确认弹窗");
        setTimeout(() => showConfirm(message, confirmCallback, cancelCallback), 500);
        return;
    }
    
    // 添加时间戳防抖，避免短时间内多次调用
    const currentTime = Date.now();
    if (window._lastConfirmTime && (currentTime - window._lastConfirmTime < 300)) {
        console.log("确认弹窗调用过于频繁，合并处理");
        setTimeout(() => showConfirm(message, confirmCallback, cancelCallback), 300);
        return;
    }
    window._lastConfirmTime = currentTime;
    
    // 先清除所有已存在的弹窗
    closeAllDialogs();
    
    // 标记当前正在处理弹窗
    window._processingDialog = true;
    
    // 立即处理，不使用延时
    try {
        
        // 创建弹窗容器
        const confirmDiv = document.createElement('div');
        confirmDiv.className = 'fixed inset-0 flex items-center justify-center z-50 confirm-dialog';
        confirmDiv.setAttribute('data-dialog-type', 'confirm');
        confirmDiv.setAttribute('data-dialog-id', currentTime.toString());
        confirmDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        
        // 使用带时间戳的ID确保唯一性，避免ID冲突
        const dialogId = currentTime.toString();
        const okBtnId = 'confirm-ok-btn-' + dialogId;
        const cancelBtnId = 'confirm-cancel-btn-' + dialogId;
        
        // 弹窗内容
        confirmDiv.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                <h3 class="text-lg font-medium text-gray-800 mb-4">确认操作</h3>
                <div class="text-sm text-gray-600 mb-6">${message.replace(/\n/g, '<br>')}</div>
                <div class="flex justify-end space-x-2">
                    <button id="${cancelBtnId}" class="btn btn-outline">取消</button>
                    <button id="${okBtnId}" class="btn btn-primary">确定</button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(confirmDiv);
        
        // 防止滚动
        document.body.style.overflow = 'hidden';
        
        // 清理函数，避免重复代码
        const cleanup = function(isConfirmed) {
            // 先移除按钮事件监听，防止重复触发
            const okBtn = document.getElementById(okBtnId);
            if (okBtn) {
                okBtn.removeEventListener('click', confirmHandler);
            }
            
            const cancelBtn = document.getElementById(cancelBtnId);
            if (cancelBtn) {
                cancelBtn.removeEventListener('click', cancelHandler);
            }
            
            // 移除背景点击事件
            if (confirmDiv) {
                confirmDiv.removeEventListener('click', backgroundClickHandler);
            }
            
            // 移除弹窗元素
            if (confirmDiv && confirmDiv.parentNode) {
                try {
                    document.body.removeChild(confirmDiv);
                } catch (e) {
                    console.error("移除Confirm弹窗失败:", e);
                }
            }
            
            // 恢复页面状态
            document.body.style.overflow = '';
            window._processingDialog = false;
            
            // 执行回调，使用setTimeout确保DOM已更新
            if (isConfirmed) {
                if (typeof confirmCallback === 'function') {
                    setTimeout(() => confirmCallback(true), 10);
                }
            } else {
                if (typeof cancelCallback === 'function') {
                    setTimeout(() => cancelCallback(false), 10);
                }
            }
        };
        
        // 预先定义事件处理函数，避免重复创建闭包
        const confirmHandler = function() {
            cleanup(true);
        };
        
        const cancelHandler = function() {
            cleanup(false);
        };
        
        // 背景点击处理函数
        const backgroundClickHandler = function(e) {
            if (e.target === confirmDiv) {
                cleanup(false);
            }
        };
        
        // 绑定按钮事件
        const okBtn = document.getElementById(okBtnId);
        if (okBtn) {
            okBtn.addEventListener('click', confirmHandler);
        }
        
        const cancelBtn = document.getElementById(cancelBtnId);
        if (cancelBtn) {
            cancelBtn.addEventListener('click', cancelHandler);
        }
        
        // 点击背景时取消
        confirmDiv.addEventListener('click', backgroundClickHandler);
        
        // 聚焦确定按钮
        setTimeout(() => {
            try {
                if (okBtn) okBtn.focus();
            } catch (e) {
                console.error("无法聚焦按钮:", e);
            }
        }, 100);
    } catch (error) {
        console.error("显示Confirm弹窗时出错:", error);
        window._processingDialog = false;
        if (typeof cancelCallback === 'function') {
            setTimeout(() => cancelCallback(false), 10);
        }
    }
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('班级积分管理系统加载完成');
    
    // 初始化页面
    initializePages();
    
    // 显示默认页面
    showPage('welcome-page');
});
