const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ratings.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (e) { console.error('读取数据失败', e); }
    return {};
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/submit', (req, res) => {
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
    res.json({ success: true, message: `收到 ${rater} 的评分` });
});

app.get('/api/summary/:quarter', (req, res) => {
    const quarter = req.params.quarter;
    const allData = readData();
    const quarterData = allData[quarter] || {};
    res.json({
        quarter: quarter,
        totalRaters: Object.keys(quarterData).length,
        data: quarterData
    });
});

// 根路径返回打分页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
});
