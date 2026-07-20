# 美股财报 Apple 日历订阅

这是一个动态 iCalendar 服务：它从 Nasdaq Earnings Calendar 拉取未来的美股财报日期，并输出 Apple 日历可以订阅的 `.ics` 文件。

## 使用方式

- `/earnings.ics`：未来 45 天的全量财报
- `/earnings.ics?symbols=AAPL,MSFT,NVDA`：只订阅指定股票
- `/earnings.ics?symbols=AAPL&days=60`：指定股票，最多未来 60 天

把部署后的完整 HTTPS 地址粘贴到 Apple 日历的“文件 → 新建日历订阅”。事件按全天显示，标题会标注盘前、盘后或时间未公布。

## 本地运行

需要 Node.js `>=22.13.0`：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000/` 查看订阅地址生成页；构建与测试：

```bash
npm test
```

## 数据与刷新

服务端每次生成订阅时按工作日查询 Nasdaq 财报日历，并通过缓存头建议约 6 小时刷新。Apple 日历的实际刷新频率还受系统设置控制。
