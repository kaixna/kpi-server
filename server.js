const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 数据存储路径
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ratings.json');

// 确保 data 目录存在
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('✅ 数据目录创建成功');
    }
} catch (err) {
    console.error('⚠️ 创建数据目录失败，将使用内存存储:', err.message);
}

// 读取数据（带容错）
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('读取数据失败，使用空数据:', e.message);
    }
    return {};
}

// 写入数据（带容错）
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error('写入数据失败:', e.message);
        return false;
    }
}

// API：提交评分
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
        res.status(500).json({ error: '服务器内部错误: ' + err.message });
    }
});

// API：获取汇总数据
app.get('/api/summary/:quarter', (req, res) => {
    try {
        const quarter = req.params.quarter;
        const allData = readData();
        const quarterData = allData[quarter] || {};
        res.json({
            quarter: quarter,
            totalRaters: Object.keys(quarterData).length,
            data: quarterData
        });
    } catch (err) {
        res.status(500).json({ error: '服务器内部错误: ' + err.message });
    }
});

// 根路径返回打分页面
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (err) {
        res.status(500).send('页面加载失败');
    }
});

// 健康检查（用于 Railway 探测服务是否存活）
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
    console.log(`📁 数据目录: ${DATA_DIR}`);
});
