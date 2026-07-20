import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "美股财报日历订阅",
  description: "自动更新的 Apple 日历财报订阅，支持按股票代码筛选。",
};

function subscriptionPath(symbols: string) {
  const cleaned = symbols
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  return cleaned ? `/earnings.ics?symbols=${encodeURIComponent(cleaned)}` : "/earnings.ics";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ symbols?: string }>;
}) {
  const params = await searchParams;
  const symbols = typeof params.symbols === "string" ? params.symbols : "";
  const path = subscriptionPath(symbols);

  return (
    <main className="shell">
      <div className="topline">
        <span className="signal" aria-hidden="true" />
        LIVE DATA · NASDAQ EARNINGS CALENDAR
      </div>

      <section className="hero">
        <p className="eyebrow">Apple Calendar subscription</p>
        <h1>让财报日程，<em>自动来到</em>你的日历。</h1>
        <p className="lede">
          一个固定的订阅地址，持续拉取未来 45 天的美股财报日期。Apple 日历会在后台刷新，盘前、盘后和未公布时段一目了然。
        </p>
      </section>

      <section className="panel builder" aria-labelledby="builder-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">01 / Build your feed</p>
            <h2 id="builder-title">选择要关注的股票</h2>
          </div>
          <span className="badge">无需 API Key</span>
        </div>

        <form method="get" action="/" className="symbol-form">
          <label htmlFor="symbols">股票代码</label>
          <div className="input-row">
            <input
              id="symbols"
              name="symbols"
              defaultValue={symbols}
              placeholder="例如 AAPL, MSFT, NVDA"
              autoComplete="off"
            />
            <button type="submit">生成订阅地址</button>
          </div>
          <p className="hint">留空 = 全量美股财报；最多可填写 100 个代码，用英文逗号分隔。</p>
        </form>
      </section>

      <section className="panel result" aria-labelledby="result-title">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">02 / Subscribe in Apple Calendar</p>
            <h2 id="result-title">你的订阅地址</h2>
          </div>
          <span className="refresh">每 6 小时更新</span>
        </div>

        <div className="url-box">
          <code>{path}</code>
        </div>
        <p className="hint">部署后，把浏览器地址栏中的完整 HTTPS 地址复制到 Apple 日历的“订阅日历”中。</p>
      </section>

      <section className="steps" aria-label="使用步骤">
        <div className="step"><span>01</span><strong>复制完整地址</strong><p>使用部署后的 HTTPS 网址，加上上方路径。</p></div>
        <div className="step"><span>02</span><strong>打开 Apple 日历</strong><p>文件 → 新建日历订阅，粘贴地址。</p></div>
        <div className="step"><span>03</span><strong>设置刷新频率</strong><p>建议选择每天或每小时，按你的需要接收更新。</p></div>
      </section>

      <footer>
        <span>Source: Nasdaq Earnings Calendar</span>
        <span>All-day events · Asia/Shanghai calendar</span>
      </footer>
    </main>
  );
}
