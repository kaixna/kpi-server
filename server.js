const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============ 静态文件 ============
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// ============ 数据存储（内存兜底） ============
let memoryData = {}; // 如果文件写入失败，用内存存储

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ratings.json');

// 尝试创建目录
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('✅ 数据目录创建成功');
    }
} catch (e) {
    console.log('⚠️ 数据目录创建失败，将使用内存存储');
}

function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (e) {
        console.log('⚠️ 读取文件失败，使用内存数据');
    }
    return memoryData;
}

function writeData(data) {
    memoryData = data; // 始终更新内存
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.log('⚠️ 写入文件失败（已保留内存数据）');
        return false;
    }
}

// ============ API ============
app.post('/api/submit', (req, res) => {
    try {
        const { rater, quarter, ratings } = req.body;
        if (!rater || !quarter || !ratings) {
            return res.status(400).json({ error: '参数错误' });
        }
        const allData = readData();
        if (!allData[quarter]) allData[quarter] = {};
        allData[quarter][rater] = {
            ratings: ratings,
            timestamp: new Date().toISOString()
        };
        writeData(allData);
        res.json({ success: true, message: `收到 ${rater} 的 ${ratings.length} 条评分` });
    } catch (err) {
        res.status(500).json({ error: '服务器错误: ' + err.message });
    }
});

app.get('/api/summary/:quarter', (req, res) => {
    try {
        const quarter = req.params.quarter;
        const allData = readData();
        res.json({
            quarter: quarter,
            totalRaters: Object.keys(allData[quarter] || {}).length,
            data: allData[quarter] || {}
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ 图片上传 ============
app.post('/api/upload-image', (req, res) => {
    try {
        const { name, image } = req.body;
        if (!name || !image) return res.status(400).json({ error: '参数错误' });
        const allData = readData();
        if (!allData._config) allData._config = {};
        if (!allData._config.employeeImages) allData._config.employeeImages = {};
        allData._config.employeeImages[name] = image;
        writeData(allData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/delete-image', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: '参数错误' });
        const allData = readData();
        if (allData._config && allData._config.employeeImages) {
            delete allData._config.employeeImages[name];
            writeData(allData);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ 根路径 ============
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(publicPath, 'index.html'));
    } catch (err) {
        res.status(500).send('页面加载失败，请稍后重试');
    }
});

// ============ 健康检查 ============
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ 启动 ============
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
});
// ============ 配置管理 API ============
let configCache = {
    employees: [],
    roleMap: {},
    guideText: '',
    currentQuarter: '2025年Q3'
};

function loadConfig() {
    try {
        const data = readData();
        if (data._config) {
            configCache = data._config;
        }
    } catch(e) {}
    return configCache;
}

function saveConfigToFile(config) {
    const allData = readData();
    allData._config = config;
    writeData(allData);
}

app.get('/api/config', (req, res) => {
    res.json(loadConfig());
});

app.post('/api/config', (req, res) => {
    try {
        const { type, value } = req.body;
        const config = loadConfig();
        config[type] = value;
        saveConfigToFile(config);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
